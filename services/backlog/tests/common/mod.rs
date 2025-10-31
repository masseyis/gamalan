use auth_clerk::JwtVerifier;
use axum::{
    routing::{delete, get, patch, post, put},
    Extension, Router,
};
use backlog::adapters::http::handlers as backlog_handlers;
use backlog::adapters::http::BacklogAppState;
use backlog::adapters::websocket::WebSocketManager;
use event_bus::{EventBus, EventPublisher};
use sqlx::PgPool;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::Mutex;
use tower_http::trace::TraceLayer;

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
    static EXTENSIONS_ENABLED: AtomicBool = AtomicBool::new(false);
    if !EXTENSIONS_ENABLED.load(Ordering::Relaxed) {
        enable_database_extensions(&pool).await.ok();
        EXTENSIONS_ENABLED.store(true, Ordering::Relaxed);
    }

    // Use full cleanup to ensure test isolation - each test must set up its own data
    clean_test_data(&pool)
        .await
        .expect("Failed to clean test data");

    pool
}

async fn enable_database_extensions(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Enable UUID extension if not already enabled
    sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        .execute(pool)
        .await
        .ok(); // Ignore errors, extension might already exist

    Ok(())
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
