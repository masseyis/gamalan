use crate::adapters::http::handlers::{clerk_webhooks, ready};
use crate::adapters::persistence::repo::UserRepositoryImpl;
use crate::application::usecases::UserUsecases;
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{get, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_auth_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    let user_repo = Arc::new(UserRepositoryImpl::new(pool));
    let user_usecases = Arc::new(UserUsecases::new(user_repo));

    shuttle_axum::axum::Router::new()
        .route("/clerk/webhooks", post(clerk_webhooks))
        .route("/health", get(|| async { "OK" }))
        .route("/ready", get(ready))
        .layer(shuttle_axum::axum::Extension(user_usecases))
        .layer(shuttle_axum::axum::Extension(verifier))
}
