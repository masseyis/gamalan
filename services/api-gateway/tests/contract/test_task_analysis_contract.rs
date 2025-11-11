use std::collections::HashSet;
use std::sync::{Arc, OnceLock};

use auth_clerk::JwtVerifier;
use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use axum::Router;
use common::init_tracing;
use event_bus::{EventBus, EventPublisher};
use serde_json::{json, Value};
use sqlx::{types::Json, PgPool};
use tokio::sync::Mutex;
use tokio::task::JoinSet;
use tower::util::ServiceExt;
use uuid::Uuid;

use prompt_builder::application::ports as prompt_ports;

static DB_LOCK: OnceLock<Arc<Mutex<()>>> = OnceLock::new();
static TRACING_INIT: OnceLock<()> = OnceLock::new();

pub fn shared_db_lock() -> &'static Arc<Mutex<()>> {
    DB_LOCK.get_or_init(|| Arc::new(Mutex::new(())))
}

async fn build_gateway_app_with_pool() -> (Router, PgPool) {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    TRACING_INIT.get_or_init(|| {
        init_tracing("api-gateway-contract-tests");
    });

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Ensure schema is up to date for contract tests
    if let Err(err) = sqlx::migrate!("../../db/migrations").run(&pool).await {
        eprintln!("Migration attempt failed (continuing with compatibility patches): {err}");
    }

    // Apply minimal schema patches for legacy snapshots used in tests
    sqlx::query(
        r#"
        ALTER TABLE IF EXISTS projects
            ADD COLUMN IF NOT EXISTS organization_id UUID,
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS team_id UUID,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        "#,
    )
    .execute(&pool)
    .await
    .ok();

    sqlx::query(
        r#"
        ALTER TABLE IF EXISTS stories
            ADD COLUMN IF NOT EXISTS project_id UUID,
            ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS story_points INTEGER,
            ADD COLUMN IF NOT EXISTS sprint_id UUID,
            ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}'::TEXT[],
            ADD COLUMN IF NOT EXISTS readiness_override BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS readiness_override_by UUID,
            ADD COLUMN IF NOT EXISTS readiness_override_reason TEXT,
            ADD COLUMN IF NOT EXISTS readiness_override_at TIMESTAMPTZ;
        "#,
    )
    .execute(&pool)
    .await
    .ok();

    ensure_acceptance_criteria_schema(&pool).await;
    ensure_task_analysis_storage(&pool).await;

    // Clean tables to ensure deterministic state for specification tests
    let tables = [
        "task_analyses",
        "readiness_task_projections",
        "readiness_story_projections",
        "acceptance_criteria",
        "readiness_evaluations",
        "tasks",
        "stories",
        "project_settings",
        "projects",
    ];

    for table in tables {
        // Best-effort cleanup; ignore if table is missing in local dev snapshots
        let query = format!("TRUNCATE TABLE {} CASCADE", table);
        let _ = sqlx::query(&query).execute(&pool).await;
    }

    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    let event_bus = Arc::new(EventBus::new());
    let event_publisher: Arc<dyn EventPublisher> = event_bus.clone();
    let backlog_usecases = backlog::build_usecases(pool.clone(), event_publisher.clone());

    let readiness_llm: Arc<dyn readiness::application::ports::LlmService> =
        Arc::new(readiness::adapters::integrations::MockLlmService);
    let readiness_usecases =
        readiness::build_usecases(pool.clone(), event_bus.clone(), readiness_llm).await;

    let prompt_backlog_service = Arc::new(api_gateway::PromptBacklogServiceAdapter {
        backlog: backlog_usecases.clone(),
    });
    let prompt_readiness_service = Arc::new(api_gateway::PromptReadinessServiceAdapter {
        readiness: readiness_usecases.clone(),
    });
    let prompt_llm: Arc<dyn prompt_ports::LlmService> =
        Arc::new(prompt_builder::adapters::integrations::MockLlmService);

    let prompt_builder_usecases = prompt_builder::build_usecases(
        pool.clone(),
        event_bus.clone(),
        prompt_backlog_service,
        prompt_readiness_service,
        prompt_llm,
    );

    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let backlog_router =
        api_gateway::build_backlog_router(backlog_usecases, pool.clone(), verifier.clone());
    let readiness_router =
        api_gateway::build_readiness_router(pool.clone(), readiness_usecases, verifier.clone());
    let prompt_builder_router =
        api_gateway::build_prompt_builder_router(prompt_builder_usecases, verifier.clone());
    let context_orchestrator_router = context_orchestrator::create_context_orchestrator_router(
        pool.clone(),
        verifier.clone(),
        event_bus.clone(),
    )
    .await;

    let router = Router::new()
        .route("/health", axum::routing::get(|| async { "OK" }))
        .route("/ready", axum::routing::get(|| async { "READY" }))
        .nest("/auth", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1/context", context_orchestrator_router)
        .merge(backlog_router)
        .merge(readiness_router)
        .merge(prompt_builder_router);

    (router, pool)
}

async fn ensure_acceptance_criteria_schema(pool: &PgPool) {
    sqlx::query(
        r#"
        ALTER TABLE IF EXISTS acceptance_criteria
            ADD COLUMN IF NOT EXISTS organization_id UUID,
            ADD COLUMN IF NOT EXISTS ac_id TEXT,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        UPDATE acceptance_criteria
        SET ac_id = id::text
        WHERE ac_id IS NULL
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_acceptance_criteria_story_ac_id
            ON acceptance_criteria(story_id, ac_id)
            WHERE ac_id IS NOT NULL
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query("DROP TABLE IF EXISTS criteria CASCADE")
        .execute(pool)
        .await
        .ok();
    sqlx::query("DROP VIEW IF EXISTS criteria CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query(
        r#"
        CREATE VIEW criteria AS
        SELECT
            id,
            story_id,
            organization_id,
            ac_id,
            description,
            given,
            when_clause AS "when",
            then_clause AS "then",
            created_at,
            updated_at
        FROM acceptance_criteria
        "#,
    )
    .execute(pool)
    .await
    .ok();
}

async fn ensure_task_analysis_storage(pool: &PgPool) {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS task_analyses (
            id UUID PRIMARY KEY,
            task_id UUID NOT NULL,
            story_id UUID NOT NULL,
            organization_id UUID,
            analysis_json JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .ok();

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_task_analyses_task_id ON task_analyses(task_id)")
        .execute(pool)
        .await
        .ok();
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_task_analyses_story_id ON task_analyses(story_id)")
        .execute(pool)
        .await
        .ok();
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_task_analyses_org_id ON task_analyses(organization_id)",
    )
    .execute(pool)
    .await
    .ok();
}

async fn seed_task_with_analysis_gaps(pool: &PgPool, organization_id: Uuid) -> (Uuid, Uuid) {
    let project_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();
    let task_id = Uuid::new_v4();

    // Insert project placeholder
    sqlx::query(
        r#"
        INSERT INTO projects (id, name, team_id)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(project_id)
    .bind("Spec Test Project")
    .bind(Option::<Uuid>::None)
    .execute(pool)
    .await
    .expect("Failed to insert spec test project");

    let story_description = "Implement the analytics intake; create helper module, build UI shell, add placeholder logging, and fix flaky behaviour";

    sqlx::query(
        r#"
        INSERT INTO stories
            (id, project_id, organization_id, title, description, status, story_points, sprint_id, assigned_to_user_id, created_at, updated_at, deleted_at, labels)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NOW(), NOW(), NULL, $8)
        "#,
    )
    .bind(story_id)
    .bind(project_id)
    .bind(organization_id)
    .bind("Spec Test Story")
    .bind(story_description)
    .bind("ready")
    .bind(5_i32)
    .bind(Vec::<String>::new())
    .execute(pool)
    .await
    .expect("Failed to insert spec test story");

    let task_description = "Implement the new task analysis pipeline. Create services without specifying file paths, build helper utilities, add improvements later, and fix issues as discovered.";

    sqlx::query(
        r#"
        INSERT INTO tasks
            (id, story_id, organization_id, title, description, acceptance_criteria_refs, status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, NOW(), NOW(), NULL, NULL)
        "#,
    )
    .bind(task_id)
    .bind(story_id)
    .bind(organization_id)
    .bind("Spec Test Task Missing Detail")
    .bind(task_description)
    .bind(vec!["AC-MISSING".to_string()])
    .bind("available")
    .execute(pool)
    .await
    .expect("Failed to insert spec test task");

    // Seed readiness projections to expose story/task context to the readiness service
    sqlx::query(
        r#"
        INSERT INTO readiness_story_projections
            (id, project_id, organization_id, title, description, status, story_points, acceptance_criteria, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        "#,
    )
    .bind(story_id)
    .bind(project_id)
    .bind(organization_id)
    .bind("Spec Test Story")
    .bind(story_description)
    .bind("ready")
    .bind(Some(5_i32))
    .bind(Json(json!([
        {
            "acId": "AC-READY-1",
            "given": "Given a poorly defined task",
            "when": "When readiness analysis runs",
            "then": "Then recommend linking to AC-READY-1"
        }
    ])))
    .execute(pool)
    .await
    .expect("Failed to insert readiness story projection");

    sqlx::query(
        r#"
        INSERT INTO readiness_task_projections
            (id, story_id, organization_id, title, description, status, acceptance_criteria_refs, estimated_hours, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        "#,
    )
    .bind(task_id)
    .bind(story_id)
    .bind(organization_id)
    .bind("Spec Test Task Missing Detail")
    .bind(task_description)
    .bind("available")
    .bind(Vec::<String>::new())
    .bind(Option::<i32>::None)
    .execute(pool)
    .await
    .expect("Failed to insert readiness task projection");

    sqlx::query(
        r#"
        INSERT INTO criteria
            (id, story_id, organization_id, ac_id, description, given, "when", "then")
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(story_id)
    .bind(organization_id)
    .bind("AC-READY-1")
    .bind("AC coverage for readiness contract tests")
    .bind("Given a poorly defined task")
    .bind("When readiness analysis runs")
    .bind("Then recommend linking to AC-READY-1")
    .execute(pool)
    .await
    .expect("Failed to insert acceptance criteria");

    (story_id, task_id)
}

fn apply_auth_headers(
    builder: axum::http::request::Builder,
    org_id: Uuid,
    user_id: Uuid,
) -> axum::http::request::Builder {
    builder
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-context-type", "organization")
        .header("x-user-id", user_id.to_string())
}

#[tokio::test]
async fn task_analysis_requires_authorization() {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869
    // This test validates the contract. Expected to FAIL until implementation.
    let _guard = shared_db_lock().lock().await;
    let (app, _pool) = build_gateway_app_with_pool().await;

    let task_id = Uuid::new_v4();

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .body(Body::empty())
                .expect("failed to build request"),
        )
        .await
        .expect("request execution failed");

    assert_eq!(
        response.status(),
        StatusCode::UNAUTHORIZED,
        "Task analysis endpoint must require authorization",
    );
}

#[tokio::test]
async fn analyze_task_returns_required_contract_fields() {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869, 81054dee-14c5-455f-a580-7d8870ba34ee, 30639999-a0b1-4381-b92b-173a7d946bc8, 5649e91e-043f-4097-916b-9907620bff3e, 3f42fa09-1117-463b-b523-08dc03a2f4a4, bbd83897-f34c-4c09-a280-a965c0937d04
    // This test validates the contract. Expected to FAIL until implementation.
    let _guard = shared_db_lock().lock().await;
    let (app, pool) = build_gateway_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let (_story_id, task_id) = seed_task_with_analysis_gaps(&pool, org_id).await;
    let user_id = Uuid::new_v4();

    let response = app
        .clone()
        .oneshot(
            apply_auth_headers(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id)),
                org_id,
                user_id,
            )
            .body(Body::from("{}"))
            .expect("failed to build request"),
        )
        .await
        .expect("request execution failed");

    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read response body");
    if status != StatusCode::OK {
        panic!(
            "Analysis must return 200 on success. Got {} with body: {}",
            status,
            String::from_utf8_lossy(&body)
        );
    }
    let analysis: Value = serde_json::from_slice(&body).expect("analysis response must be JSON");

    let clarity_score = analysis
        .get("clarityScore")
        .expect("clarityScore is required for AC e0261453");
    let clarity_value = clarity_score
        .get("score")
        .and_then(Value::as_i64)
        .expect("clarityScore.score must be a number");
    assert!(
        (0..=100).contains(&clarity_value),
        "clarityScore.score must be within 0-100 inclusive"
    );
    assert!(
        clarity_score.get("level").and_then(Value::as_str).is_some(),
        "clarityScore.level must be present"
    );

    let recommendations = analysis
        .get("recommendations")
        .and_then(Value::as_array)
        .expect("recommendations must be an array");
    assert!(
        !recommendations.is_empty(),
        "readiness analysis must return actionable recommendations"
    );
    assert!(
        recommendations.iter().any(|rec| {
            rec.get("autoApplyable")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        }),
        "analysis should expose at least one autoApplyable recommendation to enable one-click enhancements"
    );

    let tech_recs = analysis
        .get("technicalDetailRecommendations")
        .and_then(Value::as_array)
        .expect("technicalDetailRecommendations must be an array");
    let tech_types: HashSet<&str> = tech_recs
        .iter()
        .filter_map(|rec| rec.get("type").and_then(Value::as_str))
        .collect();
    assert!(
        tech_types.contains("file-path"),
        "Must recommend adding file paths"
    );
    assert!(
        tech_types.contains("function") || tech_types.contains("component"),
        "Must recommend specific functions or components"
    );
    assert!(
        tech_types.contains("input-output"),
        "Must recommend defining inputs/outputs"
    );
    assert!(
        tech_types.contains("architecture"),
        "Must recommend stating architecture decisions"
    );

    let vague_terms = analysis
        .get("vagueTerms")
        .and_then(Value::as_array)
        .expect("vagueTerms must be an array");
    for term in ["implement", "create", "build", "add", "fix"] {
        assert!(
            vague_terms.iter().any(|entry| {
                entry
                    .get("term")
                    .and_then(Value::as_str)
                    .map(|value| value.eq_ignore_ascii_case(term))
                    .unwrap_or(false)
            }),
            "Analysis must flag vague term '{term}'"
        );
    }

    let ac_recommendations = analysis
        .get("acRecommendations")
        .and_then(Value::as_array)
        .expect("acRecommendations must be an array");
    assert!(
        ac_recommendations
            .iter()
            .any(|rec| rec.get("acId") == Some(&Value::from("AC-READY-1"))),
        "Analysis must map tasks to concrete acceptance criteria IDs"
    );

    let ai_issues = analysis
        .get("aiCompatibilityIssues")
        .and_then(Value::as_array)
        .expect("aiCompatibilityIssues must be an array");
    let ai_issue_text: Vec<String> = ai_issues
        .iter()
        .filter_map(|issue| issue.as_str().map(|s| s.to_lowercase()))
        .collect();
    for keyword in [
        "success criteria",
        "dependencies",
        "environment",
        "test",
        "definition of done",
    ] {
        assert!(
            ai_issue_text.iter().any(|entry| entry.contains(keyword)),
            "AI compatibility checklist must cover {keyword}"
        );
    }

    let examples = analysis
        .get("examples")
        .and_then(Value::as_array)
        .expect("examples must be an array");
    assert!(
        !examples.is_empty(),
        "Examples of well-defined tasks must accompany recommendations"
    );
    assert!(
        examples.iter().all(|example| {
            example.get("title").and_then(Value::as_str).is_some()
                && example.get("description").and_then(Value::as_str).is_some()
                && example.get("source").and_then(Value::as_str).is_some()
        }),
        "Each example must include title, description, and source"
    );
}

#[tokio::test]
async fn get_task_analysis_returns_latest_result() {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869, bbd83897-f34c-4c09-a280-a965c0937d04
    // This test validates the contract. Expected to FAIL until implementation.
    let _guard = shared_db_lock().lock().await;
    let (app, pool) = build_gateway_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let (_story_id, task_id) = seed_task_with_analysis_gaps(&pool, org_id).await;
    let user_id = Uuid::new_v4();

    let analyze_response = app
        .clone()
        .oneshot(
            apply_auth_headers(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id)),
                org_id,
                user_id,
            )
            .body(Body::from("{}"))
            .expect("failed to build analysis request"),
        )
        .await
        .expect("analysis request failed");

    let analyze_status = analyze_response.status();
    let analyze_body = to_bytes(analyze_response.into_body(), usize::MAX)
        .await
        .expect("analysis body should deserialize");
    if analyze_status != StatusCode::OK {
        panic!(
            "Analyze request failed with status {} body: {}",
            analyze_status,
            String::from_utf8_lossy(&analyze_body)
        );
    }
    let analyze_json: Value = serde_json::from_slice(&analyze_body).expect("analysis JSON parse");
    let expected_clarity = analyze_json["clarityScore"]["score"]
        .as_i64()
        .expect("clarity score");

    let get_response = app
        .clone()
        .oneshot(
            apply_auth_headers(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/readiness/tasks/{}/analysis", task_id)),
                org_id,
                user_id,
            )
            .body(Body::empty())
            .expect("failed to build get analysis request"),
        )
        .await
        .expect("get analysis request failed");

    let get_status = get_response.status();
    let persisted_body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .expect("failed to read persisted analysis body");
    if get_status != StatusCode::OK {
        panic!(
            "GET analysis must return 200. Got {} with body: {}",
            get_status,
            String::from_utf8_lossy(&persisted_body)
        );
    }
    let persisted_json: Value =
        serde_json::from_slice(&persisted_body).expect("persisted analysis JSON parse");

    assert_eq!(
        persisted_json["clarityScore"]["score"].as_i64(),
        Some(expected_clarity),
        "GET endpoint must return the latest clarity score. Persisted body: {}, Analyze body: {}",
        persisted_json,
        analyze_json
    );
    assert_eq!(
        persisted_json["recommendations"], analyze_json["recommendations"],
        "Persisted recommendations should match the last analysis result.\nPersisted: {}\nAnalyzed: {}",
        persisted_json["recommendations"],
        analyze_json["recommendations"]
    );
}

#[tokio::test]
async fn concurrent_task_analysis_requests_are_consistent() {
    // @spec-test: e0261453-8f72-4b08-8290-d8fb7903c869, 3f42fa09-1117-463b-b523-08dc03a2f4a4
    // This test validates the contract. Expected to FAIL until implementation.
    let _guard = shared_db_lock().lock().await;
    let (app, pool) = build_gateway_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let (_story_id, task_id) = seed_task_with_analysis_gaps(&pool, org_id).await;
    let user_id = Uuid::new_v4();
    let app = Arc::new(app);

    let mut join_set = JoinSet::new();
    for _ in 0..5 {
        let app_clone = app.clone();
        join_set.spawn({
            async move {
                let response = (*app_clone)
                    .clone()
                    .oneshot(
                        apply_auth_headers(
                            Request::builder()
                                .method("POST")
                                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id)),
                            org_id,
                            user_id,
                        )
                        .body(Body::from("{}"))
                        .expect("failed to build concurrent analysis request"),
                    )
                    .await
                    .expect("concurrent analysis request failed");

                let status = response.status();
                let body = to_bytes(response.into_body(), usize::MAX)
                    .await
                    .expect("failed to read concurrent analysis body");
                (status, body)
            }
        });
    }

    let mut clarity_scores = Vec::new();
    while let Some(result) = join_set.join_next().await {
        let (status, body) = result.expect("concurrent join must succeed");
        if status != StatusCode::OK {
            eprintln!(
                "Concurrent analysis failed with status {} body: {}",
                status,
                String::from_utf8_lossy(&body)
            );
            panic!("Concurrent analysis must succeed");
        }
        let json: Value = serde_json::from_slice(&body).expect("analysis JSON parse");
        let clarity = json["clarityScore"]["score"]
            .as_i64()
            .expect("clarity score");
        clarity_scores.push(clarity);
    }

    assert!(
        clarity_scores
            .windows(2)
            .all(|window| window[0] == window[1]),
        "Clarity score must be deterministic across concurrent requests. Scores: {:?}",
        clarity_scores
    );
}

#[tokio::test]
async fn ai_enrichment_provides_task_suggestion_with_context() {
    // @spec-test: dd7b8a3c-2689-4a11-9c0d-e46843a0be1d, bbd83897-f34c-4c09-a280-a965c0937d04
    // This test validates the contract. Expected to FAIL until implementation.
    let _guard = shared_db_lock().lock().await;
    let (app, pool) = build_gateway_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let (story_id, task_id) = seed_task_with_analysis_gaps(&pool, org_id).await;
    let user_id = Uuid::new_v4();

    let enrichment_request = json!({
        "taskId": task_id,
        "storyId": story_id,
        "includeStoryContext": true,
        "includeRelatedTasks": true,
        "includeCodebaseContext": true
    });

    let response = app
        .clone()
        .oneshot(
            apply_auth_headers(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/readiness/tasks/{}/enrich", task_id))
                    .header("content-type", "application/json"),
                org_id,
                user_id,
            )
            .body(Body::from(enrichment_request.to_string()))
            .expect("failed to build enrichment request"),
        )
        .await
        .expect("enrichment request failed");

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "AI enrichment must return 200"
    );
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("failed to read enrichment body");
    let enrichment: Value = serde_json::from_slice(&body).expect("enrichment JSON parse");

    assert_eq!(
        enrichment.get("taskId"),
        Some(&Value::from(task_id.to_string())),
        "Enrichment response must target the requested task"
    );
    assert!(
        enrichment
            .get("suggestedDescription")
            .and_then(Value::as_str)
            .filter(|text| text.contains("Spec Test Story"))
            .is_some(),
        "Suggested description must incorporate story context"
    );
    assert!(
        enrichment
            .get("reasoning")
            .and_then(Value::as_str)
            .filter(|text| text.contains("AC-READY-1"))
            .is_some(),
        "Enrichment reasoning must reference acceptance criteria context"
    );
    let confidence = enrichment
        .get("confidence")
        .and_then(Value::as_f64)
        .expect("Enrichment must include confidence score");
    assert!(
        (0.0..=1.0).contains(&confidence),
        "Confidence must be normalized between 0 and 1"
    );
    assert!(
        enrichment
            .get("generatedAt")
            .and_then(Value::as_str)
            .filter(|timestamp| !timestamp.is_empty())
            .is_some(),
        "Enrichment must include generation timestamp"
    );
}
