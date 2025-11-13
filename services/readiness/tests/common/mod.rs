use auth_clerk::JwtVerifier;
use axum::{routing::post, Extension, Router};
use readiness::adapters::http::handlers::{
    add_criteria, evaluate_readiness, generate_criteria, get_criteria, ReadinessAppState,
};
use readiness::application::ports::LlmService;
use readiness::domain::AcceptanceCriterion;
use sqlx::{Executor, PgPool};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use tokio::sync::Mutex;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

/// Setup test database with targeted data cleanup
pub async fn setup_test_db() -> PgPool {
    // Use TEST_DATABASE_URL environment variable for integration tests
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Run migrations (only once per test run)
    static MIGRATIONS_RUN: AtomicBool = AtomicBool::new(false);
    if !MIGRATIONS_RUN.load(Ordering::Relaxed) {
        run_migrations(&pool)
            .await
            .expect("Failed to run migrations");
        MIGRATIONS_RUN.store(true, Ordering::Relaxed);
    }

    // Clean test data to ensure test isolation
    clean_test_data(&pool)
        .await
        .expect("Failed to clean test data");

    pool
}

async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Drop existing tables and views to ensure clean slate (test environment only!)
    // Drop tables that might be views or tables
    let _ = sqlx::query("DROP VIEW IF EXISTS criteria CASCADE")
        .execute(pool)
        .await;

    let _ = sqlx::query("DROP TABLE IF EXISTS criteria CASCADE")
        .execute(pool)
        .await;

    let _ = sqlx::query("DROP VIEW IF EXISTS readiness_evals CASCADE")
        .execute(pool)
        .await;

    let _ = sqlx::query("DROP TABLE IF EXISTS readiness_evals CASCADE")
        .execute(pool)
        .await;

    sqlx::query("DROP TABLE IF EXISTS task_analyses CASCADE")
        .execute(pool)
        .await?;

    sqlx::query("DROP TABLE IF EXISTS readiness_evaluations CASCADE")
        .execute(pool)
        .await?;

    sqlx::query("DROP TABLE IF EXISTS acceptance_criteria CASCADE")
        .execute(pool)
        .await?;

    sqlx::query("DROP TABLE IF EXISTS readiness_story_projections CASCADE")
        .execute(pool)
        .await?;

    sqlx::query("DROP TABLE IF EXISTS readiness_task_projections CASCADE")
        .execute(pool)
        .await?;

    sqlx::query("DROP TABLE IF EXISTS stories CASCADE")
        .execute(pool)
        .await?;

    // Read and execute the migration file
    let migration_sql = include_str!("../../migrations/0001_initial_schema.sql");

    // Get a connection from the pool and execute multiple statements
    let mut conn = pool.acquire().await?;

    // Execute the entire migration script (postgres supports multiple statements via PgConnection)
    conn.execute(migration_sql).await?;

    Ok(())
}

async fn clean_test_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Clean readiness-specific tables in dependency order

    // First disable triggers to avoid constraint issues during cleanup
    sqlx::query("SET session_replication_role = replica;")
        .execute(pool)
        .await?;

    // Clean readiness tables
    sqlx::query("TRUNCATE TABLE IF EXISTS task_analyses CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE IF EXISTS readiness_evaluations CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE IF EXISTS acceptance_criteria CASCADE")
        .execute(pool)
        .await
        .ok();

    // Clean story projections and stories
    sqlx::query("TRUNCATE TABLE IF EXISTS readiness_story_projections CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE IF EXISTS stories CASCADE")
        .execute(pool)
        .await
        .ok();

    // Re-enable triggers
    sqlx::query("SET session_replication_role = DEFAULT;")
        .execute(pool)
        .await?;

    Ok(())
}

/// Mock LLM service for testing
#[derive(Clone)]
pub struct MockLlmService {
    pub criteria_response: Arc<
        StdMutex<
            Vec<(
                String, // ac_id
                String, // given
                String, // when
                String, // then
            )>,
        >,
    >,
}

impl MockLlmService {
    pub fn new() -> Self {
        Self {
            criteria_response: Arc::new(StdMutex::new(vec![
                (
                    "ac_1".to_string(),
                    "I am viewing a task in the backlog".to_string(),
                    "The task readiness analysis runs".to_string(),
                    "I should see a clarity score indicating how well-defined the task is"
                        .to_string(),
                ),
                (
                    "ac_2".to_string(),
                    "A task description lacks specific technical details".to_string(),
                    "The analysis evaluates the task".to_string(),
                    "The system should recommend adding file paths, functions, and technical details".to_string(),
                ),
            ])),
        }
    }

    #[allow(dead_code)]
    pub fn set_criteria_response(&self, criteria: Vec<(String, String, String, String)>) {
        let mut response = self.criteria_response.lock().unwrap();
        *response = criteria;
    }
}

#[async_trait::async_trait]
impl LlmService for MockLlmService {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &readiness::application::ports::StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, common::AppError> {
        let criteria_tuples = self.criteria_response.lock().unwrap().clone();
        let mut criteria = Vec::new();

        for (ac_id, given, when, then) in criteria_tuples {
            let criterion =
                AcceptanceCriterion::new(story_info.id, None, ac_id, given, when, then)?;
            criteria.push(criterion);
        }

        Ok(criteria)
    }

    async fn analyze_task(
        &self,
        task_info: &readiness::application::ports::TaskInfo,
        _ac_refs: &[AcceptanceCriterion],
    ) -> Result<readiness::domain::TaskClarityAnalysis, common::AppError> {
        // Simple mock for integration tests
        Ok(readiness::domain::TaskClarityAnalysis::new(
            task_info.id,
            75,
            vec![],
            vec![],
            vec![],
        ))
    }

    async fn suggest_tasks(
        &self,
        _story_info: &readiness::application::ports::StoryInfo,
        _github_context: &str,
        _existing_tasks: &[readiness::application::ports::TaskInfo],
    ) -> Result<Vec<readiness::domain::TaskSuggestion>, common::AppError> {
        // Simple mock for integration tests
        Ok(vec![])
    }
}

pub async fn build_readiness_router_for_tests(pool: PgPool) -> Router {
    let verifier =
        Arc::new(Mutex::new(JwtVerifier::new_test_verifier())) as Arc<Mutex<JwtVerifier>>;
    let event_bus = Arc::new(event_bus::EventBus::new());

    // Create mock LLM service
    let llm_service = Arc::new(MockLlmService::new()) as Arc<dyn LlmService>;

    // Build usecases
    let usecases = readiness::build_usecases(pool.clone(), event_bus, llm_service).await;

    // Wrap in ReadinessAppState
    let state = ReadinessAppState {
        usecases,
        pool: Arc::new(pool),
    };

    Router::new()
        .route("/readiness/{story_id}/evaluate", post(evaluate_readiness))
        .route("/criteria/{story_id}/generate", post(generate_criteria))
        .route("/criteria/{story_id}", axum::routing::get(get_criteria))
        .route("/criteria/{story_id}", post(add_criteria))
        .with_state(state)
        .layer(Extension(verifier))
        .layer(TraceLayer::new_for_http())
}

pub async fn setup_app() -> Router {
    let pool = setup_test_db().await;
    build_readiness_router_for_tests(pool).await
}

pub async fn setup_app_with_pool() -> (Router, PgPool) {
    let pool = setup_test_db().await;
    let router = build_readiness_router_for_tests(pool.clone()).await;
    (router, pool)
}

/// Helper to create a test story in both stories and projection tables
pub async fn create_test_story(
    pool: &PgPool,
    org_id: Uuid,
    title: &str,
    description: Option<&str>,
) -> Uuid {
    let story_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    // Insert into stories table (used by joins in criteria queries)
    sqlx::query(
        r#"
        INSERT INTO stories
        (id, project_id, organization_id, title, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        "#,
    )
    .bind(story_id)
    .bind(project_id)
    .bind(org_id)
    .bind(title)
    .bind(description)
    .bind("draft")
    .execute(pool)
    .await
    .expect("Failed to create test story in stories table");

    // Also insert into readiness projections
    sqlx::query(
        r#"
        INSERT INTO readiness_story_projections
        (id, project_id, organization_id, title, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        "#,
    )
    .bind(story_id)
    .bind(project_id)
    .bind(org_id)
    .bind(title)
    .bind(description)
    .bind("draft")
    .execute(pool)
    .await
    .expect("Failed to create test story in readiness_story_projections");

    story_id
}

/// Helper to create test acceptance criteria
pub async fn create_test_criteria(
    pool: &PgPool,
    story_id: Uuid,
    org_id: Uuid,
    ac_id: &str,
    given: &str,
    when: &str,
    then: &str,
) -> Uuid {
    let id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO criteria
        (id, story_id, organization_id, ac_id, description, given, "when", "then")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(id)
    .bind(story_id)
    .bind(org_id)
    .bind(ac_id)
    .bind(format!("Acceptance criteria {ac_id}"))
    .bind(given)
    .bind(when)
    .bind(then)
    .execute(pool)
    .await
    .expect("Failed to create test criteria");

    id
}

/// Helper to create a test task in readiness_task_projections
#[allow(dead_code)]
pub async fn create_test_task(
    pool: &PgPool,
    story_id: Uuid,
    org_id: Uuid,
    title: &str,
    description: Option<&str>,
    acceptance_criteria_refs: &[&str],
    estimated_hours: Option<u32>,
) -> Uuid {
    let task_id = Uuid::new_v4();

    // Convert acceptance_criteria_refs to a Vec<String> for the TEXT[] array
    let ac_refs: Vec<String> = acceptance_criteria_refs
        .iter()
        .map(|s| s.to_string())
        .collect();

    sqlx::query(
        r#"
        INSERT INTO readiness_task_projections
        (id, story_id, organization_id, title, description, status, acceptance_criteria_refs, estimated_hours, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        "#,
    )
    .bind(task_id)
    .bind(story_id)
    .bind(org_id)
    .bind(title)
    .bind(description)
    .bind("available")
    .bind(&ac_refs) // Bind as &Vec<String> for TEXT[] type
    .bind(estimated_hours.map(|h| h as i32))
    .execute(pool)
    .await
    .expect("Failed to create test task");

    task_id
}
