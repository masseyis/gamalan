use crate::adapters::http::handlers::{
    create_project, get_project, get_projects, update_project_settings,
};
use auth_clerk::JwtVerifier;
#[allow(unused_imports)] // post is used in route! macro calls but not detected by rustc
use shuttle_axum::axum::routing::{get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(
    _pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    shuttle_axum::axum::Router::new()
        .route("/ready", get(ready))
        .route("/projects", get(get_projects).post(create_project))
        .route("/projects/{id}/settings", put(update_project_settings))
        .route("/projects/{id}", get(get_project))
        .layer(shuttle_axum::axum::Extension(verifier))
}

async fn ready() -> &'static str {
    "READY"
}

pub async fn create_projects_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    app_router(pool, verifier).await
}
