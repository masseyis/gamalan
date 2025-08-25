use crate::adapters::http::handlers::{evaluate_readiness, generate_criteria, get_criteria};
use auth_clerk::JwtVerifier;
use axum::routing::{get, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn app_router(_pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    axum::routing::Router::new()
        .route("/readiness/:storyId/evaluate", post(evaluate_readiness))
        .route("/criteria/:storyId/generate", post(generate_criteria))
        .route("/criteria/:storyId", get(get_criteria))
        .layer(axum::Extension(verifier))
}