use crate::adapters::http::handlers::{create_project, get_project, update_project_settings};
use auth_clerk::JwtVerifier;
use axum::routing::{get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(_pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    axum::routing::Router::new()
        .route("/projects", post(create_project))
        .route("/projects/:id/settings", put(update_project_settings))
        .route("/projects/:id", get(get_project))
        .layer(axum::Extension(verifier))
}