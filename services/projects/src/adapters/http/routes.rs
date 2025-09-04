use crate::adapters::http::handlers::{
    create_project, get_project, get_projects, update_project_settings,
};
use auth_clerk::JwtVerifier;
#[allow(unused_imports)] // post is used in route! macro calls but not detected by rustc
use axum::routing::{get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(_pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    axum::routing::Router::new()
        .route("/health", get(common::health_check))
        .route("/health/detailed", get(common::detailed_health_check))
        .route("/ready", get(ready))
        .route("/projects", get(get_projects).post(create_project))
        .route("/projects/:id/settings", put(update_project_settings))
        .route("/projects/:id", get(get_project))
        .layer(axum::Extension(verifier))
}

async fn ready() -> &'static str {
    "READY"
}

pub async fn create_projects_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> axum::routing::Router {
    app_router(pool, verifier).await
}
