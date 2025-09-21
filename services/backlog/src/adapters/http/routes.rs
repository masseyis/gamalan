use crate::adapters::http::handlers::{
    complete_task_work, create_story, create_task, delete_story, get_available_tasks,
    get_stories_by_project, get_story, get_tasks_by_story, get_user_owned_tasks,
    release_task_ownership, set_task_estimate, start_task_work, take_task_ownership, update_story,
    update_story_status,
};
use crate::adapters::integrations::HttpReadinessService;
use crate::adapters::persistence::{SqlStoryRepository, SqlTaskRepository};
use crate::application::BacklogUsecases;
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{delete, get, patch, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_backlog_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
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

    shuttle_axum::axum::Router::new()
        // Authenticated project-scoped endpoints
        .route("/projects/{project_id}/stories", post(create_story))
        .route(
            "/projects/{project_id}/stories",
            get(get_stories_by_project),
        )
        .route("/stories/{id}", get(get_story))
        .route("/stories/{id}", patch(update_story))
        .route("/stories/{id}", delete(delete_story))
        .route("/stories/{id}/tasks", post(create_task))
        .route("/stories/{id}/tasks", get(get_tasks_by_story))
        .route("/stories/{id}/tasks/available", get(get_available_tasks))
        .route("/stories/{id}/status", patch(update_story_status))
        // Task ownership endpoints
        .route("/tasks/owned", get(get_user_owned_tasks))
        .route("/tasks/{task_id}/ownership", put(take_task_ownership))
        .route("/tasks/{task_id}/ownership", delete(release_task_ownership))
        .route("/tasks/{task_id}/work/start", post(start_task_work))
        .route("/tasks/{task_id}/work/complete", post(complete_task_work))
        .route("/tasks/{task_id}/estimate", patch(set_task_estimate))
        .with_state(usecases)
        .layer(shuttle_axum::axum::Extension(verifier))
}
