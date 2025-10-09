use crate::adapters::http::handlers::{
    complete_task_work, create_acceptance_criterion, create_story, create_task,
    delete_acceptance_criterion, delete_story, get_acceptance_criteria, get_available_tasks,
    get_stories_by_project, get_story, get_tasks_by_story, get_user_owned_tasks,
    override_story_ready, release_task_ownership, set_task_estimate, start_task_work,
    take_task_ownership, update_acceptance_criterion, update_story, update_story_status,
    update_task_status,
};
use crate::adapters::persistence::{SqlStoryRepository, SqlTaskRepository};
use crate::application::BacklogUsecases;
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{delete, get, patch, post, put};
use shuttle_axum::axum::Router;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::trace::{DefaultOnRequest, DefaultOnResponse, TraceLayer};
use tracing::Level;

pub async fn create_backlog_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    Router::new().nest(
        "/api/v1",
        create_backlog_router_unprefixed(pool, verifier).await,
    )
}

pub async fn create_backlog_router_with_readiness(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    Router::new().nest(
        "/api/v1",
        create_backlog_router_unprefixed(pool, verifier).await,
    )
}

pub async fn create_backlog_router_unprefixed(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    // Initialize repositories
    let story_repo = Arc::new(SqlStoryRepository::new(pool.clone()));
    let task_repo = Arc::new(SqlTaskRepository::new(pool.clone()));

    // Initialize use cases
    let usecases = Arc::new(BacklogUsecases::new(story_repo, task_repo));

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
        .route("/stories/{id}/ready-override", put(override_story_ready))
        .route("/stories/{id}/tasks", post(create_task))
        .route("/stories/{id}/tasks", get(get_tasks_by_story))
        .route("/stories/{id}/tasks/available", get(get_available_tasks))
        .route("/stories/{id}/status", patch(update_story_status))
        .route(
            "/stories/{id}/acceptance-criteria",
            get(get_acceptance_criteria),
        )
        .route(
            "/stories/{id}/acceptance-criteria",
            post(create_acceptance_criterion),
        )
        .route(
            "/stories/{id}/acceptance-criteria/{criterion_id}",
            patch(update_acceptance_criterion),
        )
        .route(
            "/stories/{id}/acceptance-criteria/{criterion_id}",
            delete(delete_acceptance_criterion),
        )
        // Task ownership endpoints
        .route("/tasks/owned", get(get_user_owned_tasks))
        .route("/tasks/{task_id}/ownership", put(take_task_ownership))
        .route("/tasks/{task_id}/ownership", delete(release_task_ownership))
        .route("/tasks/{task_id}/work/start", post(start_task_work))
        .route("/tasks/{task_id}/work/complete", post(complete_task_work))
        .route("/tasks/{task_id}/status", patch(update_task_status))
        .route("/tasks/{task_id}/estimate", patch(set_task_estimate))
        .with_state(usecases)
        .layer(shuttle_axum::axum::Extension(verifier))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|request: &shuttle_axum::axum::http::Request<_>| {
                    let org_id = request
                        .headers()
                        .get("x-organization-id")
                        .and_then(|value| value.to_str().ok())
                        .unwrap_or("none")
                        .to_string();
                    let user_id = request
                        .headers()
                        .get("x-user-id")
                        .and_then(|value| value.to_str().ok())
                        .unwrap_or("anonymous")
                        .to_string();

                    tracing::info_span!(
                        "backlog_http_request",
                        method = %request.method(),
                        uri = %request.uri(),
                        org_id,
                        user_id
                    )
                })
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
}
