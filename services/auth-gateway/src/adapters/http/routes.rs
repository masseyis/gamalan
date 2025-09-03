use crate::adapters::http::handlers::{clerk_webhooks, health, ready};
use crate::adapters::persistence::repo::UserRepositoryImpl;
use crate::application::usecases::UserUsecases;
use auth_clerk::JwtVerifier;
use axum::routing::{get, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_auth_router(pool: PgPool, verifier: Arc<Mutex<JwtVerifier>>) -> axum::routing::Router {
    let user_repo = Arc::new(UserRepositoryImpl::new(pool));
    let user_usecases = Arc::new(UserUsecases::new(user_repo));

    axum::routing::Router::new()
        .route("/clerk/webhooks", post(clerk_webhooks))
        .route("/health", get(health))
        .route("/ready", get(ready))
        .layer(axum::Extension(user_usecases))
        .layer(axum::Extension(verifier))
}
