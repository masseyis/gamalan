use anyhow::Context;
use axum::{routing::get, Router};
use shuttle_axum::ShuttleAxum;
use shuttle_shared_db::Postgres;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use auth_clerk::JwtVerifier;
use common::init_tracing;

#[shuttle_runtime::main]
async fn main(
    #[Postgres(local_uri = "postgres://postgres:password@localhost:5432/gamalan")] db_uri: String,
) -> ShuttleAxum {
    init_tracing();

    // Initialize shared database pool
    let pool = PgPool::connect(&db_uri)
        .await
        .context("Failed to connect to database")?;

    // Initialize shared JWT verifier
    let clerk_jwks_url = std::env::var("CLERK_JWKS_URL")
        .unwrap_or_else(|_| "https://your-clerk-domain/.well-known/jwks.json".to_string());
    let clerk_issuer = std::env::var("CLERK_ISSUER")
        .unwrap_or_else(|_| "https://your-clerk-domain".to_string());
    let clerk_audience = std::env::var("CLERK_AUDIENCE")
        .unwrap_or_else(|_| "your-application-audience".to_string());

    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        clerk_jwks_url,
        clerk_issuer,
        clerk_audience,
    )));

    // Create service routers with shared resources
    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let backlog_router = backlog::create_backlog_router(pool.clone(), verifier.clone()).await;
    let readiness_router = readiness::create_readiness_router(pool.clone(), verifier.clone()).await;
    let prompt_builder_router = prompt_builder::create_prompt_builder_router(pool.clone(), verifier.clone()).await;

    // Create unified router with path-based routing
    let app = Router::new()
        // Health checks at root level
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        // Service-specific routes with prefixes
        .nest("/auth", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1", backlog_router)
        .nest("/api/v1", readiness_router)
        .nest("/api/v1", prompt_builder_router)
        // Add CORS and tracing
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn readiness_check() -> &'static str {
    "READY"
}