use crate::adapters::http::handlers::{create_project, get_project, get_projects, update_project_settings};
use auth_clerk::JwtVerifier;
use axum::routing::{get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_projects_router(_pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    axum::routing::Router::new()
        .route("/projects", get(get_projects).post(create_project))
        .route("/projects/:id/settings", put(update_project_settings))
        .route("/projects/:id", get(get_project))
        .layer(axum::Extension(verifier))
}
