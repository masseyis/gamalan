use crate::adapters::http::handlers::{
    create_story, create_task, delete_story, get_story, update_story, update_story_status,
};
use auth_clerk::JwtVerifier;
use axum::routing::{delete, get, patch, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(_pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    axum::routing::Router::new()
        .route("/stories", post(create_story))
        .route("/stories/:id", get(get_story))
        .route("/stories/:id", patch(update_story))
        .route("/stories/:id", delete(delete_story))
        .route("/stories/:id/tasks", post(create_task))
        .route("/stories/:id/status", patch(update_story_status))
        .layer(axum::Extension(verifier))
}
