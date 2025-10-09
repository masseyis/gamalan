use anyhow::Context;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::HeaderValue;
use axum::http::Method;
use shuttle_axum::axum::{routing::get, Router};
use shuttle_axum::ShuttleAxum;
use shuttle_shared_db::Postgres;
use sqlx::PgPool;
use std::env;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

mod migrations;

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

    // Run all service migrations
    migrations::run_all_migrations(&pool)
        .await
        .context("Failed to run database migrations")?;

    // Initialize shared JWT verifier - Use secrets directly
    let verifier = if std::env::var("USE_MOCK_AUTH").unwrap_or_default() == "true" {
        Arc::new(Mutex::new(JwtVerifier::new_test_verifier()))
    } else {
        let clerk_jwks_url = secrets
            .get("CLERK_JWKS_URL")
            .context("CLERK_JWKS_URL must be set")?;
        let clerk_domain = secrets
            .get("CLERK_DOMAIN")
            .context("CLERK_DOMAIN must be set")?;
        let clerk_issuer = format!("https://{}", clerk_domain);
        let clerk_audience = secrets
            .get("CLERK_AUDIENCE")
            .context("CLERK_AUDIENCE must be set")?;

        Arc::new(Mutex::new(JwtVerifier::new(
            clerk_jwks_url,
            clerk_issuer,
            Some(clerk_audience),
        )))
    };

    // Create service routers with shared resources
    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let backlog_router =
        backlog::create_backlog_router_unprefixed(pool.clone(), verifier.clone()).await;
    let readiness_router = readiness::create_readiness_router(pool.clone(), verifier.clone()).await;
    let prompt_builder_router =
        prompt_builder::create_prompt_builder_router(pool.clone(), verifier.clone()).await;
    let context_orchestrator_router =
        context_orchestrator::create_context_orchestrator_router(pool.clone(), verifier.clone())
            .await;

    // Create unified router with path-based routing
    let cors_origins = env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000".to_string())
        .split(',')
        .map(|s| s.parse::<HeaderValue>().unwrap())
        .collect::<Vec<HeaderValue>>();

    let cors = CorsLayer::new()
        .allow_origin(cors_origins)
        .allow_methods(vec![
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            ACCEPT,
            AUTHORIZATION,
            CONTENT_TYPE,
            "X-User-Id".parse().unwrap(),
            "X-Context-Type".parse().unwrap(),
            "X-Organization-Id".parse().unwrap(),
        ])
        .allow_credentials(true);

    let app = Router::new()
        // Health checks at root level
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        // Service-specific routes with prefixes
        .nest("/api/v1", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1", backlog_router)
        .nest("/api/v1", readiness_router)
        .nest("/api/v1", prompt_builder_router)
        .nest("/api/v1/context", context_orchestrator_router)
        // Add CORS and tracing
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn readiness_check() -> &'static str {
    "READY"
}
