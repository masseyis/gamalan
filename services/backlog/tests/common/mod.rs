use auth_clerk::JwtVerifier;
use axum::{
    routing::{delete, get, patch, post, put},
    Extension, Router,
};
use backlog::adapters::http::handlers as backlog_handlers;
use backlog::adapters::http::BacklogAppState;
use backlog::adapters::websocket::WebSocketManager;
use event_bus::{EventBus, EventPublisher};
use sqlx::{
    migrate::{MigrateError, Migrator},
    PgPool,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::Mutex;
use tower_http::trace::TraceLayer;

static EXTENSIONS_ENABLED: AtomicBool = AtomicBool::new(false);
static MIGRATOR: Migrator = sqlx::migrate!("../../db/migrations");

/// Setup test database with targeted data cleanup
/// This function connects to the TEST_DATABASE_URL and ensures clean test state without being too aggressive
pub async fn setup_test_db() -> PgPool {
    // Use TEST_DATABASE_URL environment variable for integration tests
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Ensure database extensions are enabled (only once per test run)
    if !EXTENSIONS_ENABLED.load(Ordering::Relaxed) {
        enable_database_extensions(&pool).await.ok();
        EXTENSIONS_ENABLED.store(true, Ordering::Relaxed);
    }

    // Apply migrations with automatic repair for drifted local databases
    run_migrations_with_repair(&pool).await;

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

    // Use full cleanup to ensure test isolation - each test must set up its own data
    clean_test_data(&pool)
        .await
        .expect("Failed to clean test data");

    pool
}

async fn run_migrations_with_repair(pool: &PgPool) {
    if let Err(err) = MIGRATOR.run(pool).await {
        eprintln!(
            "Backlog test migration attempt failed (continuing with compatibility patches): {err}"
        );

        if should_reset_schema(&err) {
            reset_database_schema(pool)
                .await
                .expect("Failed to reset backlog test schema");
            enable_database_extensions(pool).await.ok();
            MIGRATOR
                .run(pool)
                .await
                .expect("Failed to run backlog migrations after schema reset");
        }
    }
}

fn should_reset_schema(err: &MigrateError) -> bool {
    matches!(
        err,
        MigrateError::VersionMissing(_)
            | MigrateError::VersionMismatch(_)
            | MigrateError::VersionNotPresent(_)
            | MigrateError::VersionTooOld(_, _)
            | MigrateError::VersionTooNew(_, _)
            | MigrateError::Dirty(_)
    )
}

async fn reset_database_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DROP SCHEMA IF EXISTS public CASCADE")
        .execute(pool)
        .await?;
    sqlx::query("CREATE SCHEMA public").execute(pool).await?;
    sqlx::query("GRANT ALL ON SCHEMA public TO postgres")
        .execute(pool)
        .await?;
    sqlx::query("GRANT ALL ON SCHEMA public TO public")
        .execute(pool)
        .await?;
    Ok(())
}

async fn enable_database_extensions(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Enable UUID extension if not already enabled
    sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        .execute(pool)
        .await
        .ok(); // Ignore errors, extension might already exist

    Ok(())
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

pub async fn build_backlog_router_for_tests(pool: PgPool) -> Router {
    let verifier =
        Arc::new(Mutex::new(JwtVerifier::new_test_verifier())) as Arc<Mutex<JwtVerifier>>;
    let event_bus = Arc::new(EventBus::new());
    let event_publisher: Arc<dyn EventPublisher> = event_bus.clone();
    let usecases = backlog::build_usecases(pool, event_publisher);

    // Create WebSocketManager for tests (capacity doesn't matter for tests)
    let ws_manager = Arc::new(WebSocketManager::new(100));

    // Wrap in BacklogAppState
    let state = Arc::new(BacklogAppState::new(usecases, ws_manager));

    Router::new()
        .route(
            "/api/v1/projects/{project_id}/stories",
            post(backlog_handlers::create_story),
        )
        .route(
            "/api/v1/projects/{project_id}/stories",
            get(backlog_handlers::get_stories_by_project),
        )
        .route("/api/v1/stories/{id}", get(backlog_handlers::get_story))
        .route(
            "/api/v1/stories/{id}",
            patch(backlog_handlers::update_story),
        )
        .route(
            "/api/v1/stories/{id}",
            delete(backlog_handlers::delete_story),
        )
        .route(
            "/api/v1/stories/{id}/ready-override",
            put(backlog_handlers::override_story_ready),
        )
        .route(
            "/api/v1/stories/{id}/tasks",
            post(backlog_handlers::create_task),
        )
        .route(
            "/api/v1/stories/{id}/tasks",
            get(backlog_handlers::get_tasks_by_story),
        )
        .route(
            "/api/v1/stories/{id}/tasks/available",
            get(backlog_handlers::get_available_tasks),
        )
        .route(
            "/api/v1/stories/{id}/status",
            patch(backlog_handlers::update_story_status),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria",
            get(backlog_handlers::get_acceptance_criteria),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria",
            post(backlog_handlers::create_acceptance_criterion),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria/{criterion_id}",
            patch(backlog_handlers::update_acceptance_criterion),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria/{criterion_id}",
            delete(backlog_handlers::delete_acceptance_criterion),
        )
        .route(
            "/api/v1/tasks/owned",
            get(backlog_handlers::get_user_owned_tasks),
        )
        .route(
            "/api/v1/tasks/{task_id}/ownership",
            put(backlog_handlers::take_task_ownership),
        )
        .route(
            "/api/v1/tasks/{task_id}/ownership",
            delete(backlog_handlers::release_task_ownership),
        )
        .route(
            "/api/v1/tasks/{task_id}/work/start",
            post(backlog_handlers::start_task_work),
        )
        .route(
            "/api/v1/tasks/{task_id}/work/complete",
            post(backlog_handlers::complete_task_work),
        )
        .route(
            "/api/v1/tasks/{task_id}/status",
            patch(backlog_handlers::update_task_status),
        )
        .route(
            "/api/v1/tasks/{task_id}/estimate",
            patch(backlog_handlers::set_task_estimate),
        )
        .route(
            "/api/v1/sprints/{sprint_id}/tasks",
            get(backlog_handlers::get_sprint_task_board),
        )
        .with_state(state)
        .layer(Extension(verifier))
        .layer(TraceLayer::new_for_http())
}

async fn clean_test_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Clean all test data in dependency order
    // This approach ensures complete test isolation

    // First disable triggers to avoid constraint issues during cleanup
    sqlx::query("SET session_replication_role = replica;")
        .execute(pool)
        .await?;

    // Clean backlog tables in dependency order
    sqlx::query("TRUNCATE TABLE story_labels CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE acceptance_criteria CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE tasks CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE stories CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE labels CASCADE")
        .execute(pool)
        .await
        .ok();

    // Clean sprint-related tables
    sqlx::query("TRUNCATE TABLE sprints CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE teams CASCADE")
        .execute(pool)
        .await
        .ok();

    // Clean projects tables if they exist
    sqlx::query("TRUNCATE TABLE project_settings CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE projects CASCADE")
        .execute(pool)
        .await
        .ok();

    // Clean organizations last (referenced by many tables)
    sqlx::query("TRUNCATE TABLE organizations CASCADE")
        .execute(pool)
        .await
        .ok();

    // Re-enable triggers
    sqlx::query("SET session_replication_role = DEFAULT;")
        .execute(pool)
        .await?;

    Ok(())
}

/// Create a test database pool with proper cleanup
pub struct TestDatabase {
    pool: PgPool,
}

impl TestDatabase {
    pub async fn new() -> Self {
        let pool = setup_test_db().await;
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        // Cleanup is handled by clean_test_data in setup_test_db
        // No special cleanup needed for shared database approach
    }
}
