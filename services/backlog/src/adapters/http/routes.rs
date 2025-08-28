use crate::adapters::http::handlers::{
    create_story, create_task, delete_story, get_story, get_tasks_by_story, update_story,
    update_story_status,
};
use crate::adapters::integrations::HttpReadinessService;
use crate::adapters::persistence::{SqlStoryRepository, SqlTaskRepository};
use crate::application::BacklogUsecases;
use auth_clerk::JwtVerifier;
use axum::routing::{delete, get, patch, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    // Initialize repositories
    let story_repo = Arc::new(SqlStoryRepository::new(pool.clone()));
    let task_repo = Arc::new(SqlTaskRepository::new(pool.clone()));

    // Initialize readiness service client
    let readiness_base_url = std::env::var("READINESS_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8002".to_string());
    let readiness_service = Arc::new(HttpReadinessService::new(readiness_base_url));

    // Initialize use cases
    let usecases = Arc::new(BacklogUsecases::new(
        story_repo,
        task_repo,
        readiness_service,
    ));

    axum::routing::Router::new()
        .route("/stories", post(create_story))
        .route("/stories/:id", get(get_story))
        .route("/stories/:id", patch(update_story))
        .route("/stories/:id", delete(delete_story))
        .route("/stories/:id/tasks", post(create_task))
        .route("/stories/:id/tasks", get(get_tasks_by_story))
        .route("/stories/:id/status", patch(update_story_status))
        .with_state(usecases)
        .layer(axum::Extension(verifier))
}
