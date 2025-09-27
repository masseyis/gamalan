use anyhow::Context;
use axum::{routing::get, Extension, Router};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use auth_clerk::JwtVerifier;
use common::init_tracing;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing("api-gateway-test");

    // Get database URL from environment
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    println!("Connecting to database: {}", database_url);

    // Initialize shared database pool
    let pool = PgPool::connect(&database_url)
        .await
        .context("Failed to connect to database")?;

    println!("Connected to database successfully");

    // Initialize test JWT verifier
    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    // Create service routers with shared resources
    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let backlog_router = backlog::create_backlog_router(pool.clone(), verifier.clone()).await;
    let readiness_router = readiness::create_readiness_router(pool.clone(), verifier.clone()).await;
    let prompt_builder_router =
        prompt_builder::create_prompt_builder_router(pool.clone(), verifier.clone()).await;
    let context_orchestrator_router =
        context_orchestrator::create_context_orchestrator_router(pool.clone(), verifier.clone())
            .await;

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
        .nest("/api/v1/context", context_orchestrator_router)
        // Add CORS and tracing
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .layer(Extension(verifier));

    println!("Starting test server on port 8000...");

    // Start the server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000").await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn readiness_check() -> &'static str {
    "READY"
}
