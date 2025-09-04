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
    #[shuttle_runtime::Secrets] secrets: shuttle_runtime::SecretStore,
) -> ShuttleAxum {
    init_tracing("api-gateway");

    // Initialize shared database pool
    let pool = PgPool::connect(&db_uri)
        .await
        .context("Failed to connect to database")?;

    // Initialize shared JWT verifier - Use secrets directly
    let clerk_jwks_url = secrets
        .get("CLERK_JWKS_URL")
        .context("CLERK_JWKS_URL must be set")?;
    let clerk_domain = secrets
        .get("CLERK_DOMAIN")
        .context("CLERK_DOMAIN must be set")?;
    // For Clerk, the issuer is typically the same as the JWKS URL domain
    let clerk_issuer = format!("https://{}.clerk.accounts.dev", clerk_domain);
    let clerk_audience = secrets
        .get("CLERK_AUDIENCE")
        .unwrap_or_else(|| format!("{}.clerk.accounts.dev", clerk_domain)); // Use proper domain format

    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        clerk_jwks_url,
        clerk_issuer,
        Some(clerk_audience),
    )));

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
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn readiness_check() -> &'static str {
    "READY"
}
