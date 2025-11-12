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
use event_bus::{EventBus, EventPublisher};

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

    let event_bus = Arc::new(EventBus::new());
    let event_publisher: Arc<dyn EventPublisher> = event_bus.clone();
    let backlog_usecases = backlog::build_usecases(pool.clone(), event_publisher);
    let readiness_llm: Arc<dyn readiness::application::ports::LlmService> =
        Arc::new(readiness::adapters::integrations::MockLlmService);
    let readiness_usecases =
        readiness::build_usecases(pool.clone(), event_bus.clone(), readiness_llm).await;

    let prompt_backlog_service = Arc::new(api_gateway::PromptBacklogServiceAdapter {
        backlog: backlog_usecases.clone(),
    });
    let prompt_readiness_service = Arc::new(api_gateway::PromptReadinessServiceAdapter {
        readiness: readiness_usecases.clone(),
    });
    let prompt_llm: Arc<dyn prompt_builder::application::ports::LlmService> =
        Arc::new(prompt_builder::adapters::integrations::MockLlmService);
    let prompt_builder_usecases = prompt_builder::build_usecases(
        pool.clone(),
        event_bus.clone(),
        prompt_backlog_service,
        prompt_readiness_service,
        prompt_llm,
    );

    // Create service routers with shared resources
    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let context_orchestrator_router = context_orchestrator::create_context_orchestrator_router(
        pool.clone(),
        verifier.clone(),
        event_bus.clone(),
    )
    .await;

    let backlog_router = api_gateway::build_backlog_router(backlog_usecases, pool.clone(), verifier.clone());
    let readiness_router =
        api_gateway::build_readiness_router(pool.clone(), readiness_usecases, verifier.clone());
    let prompt_builder_router = api_gateway::build_prompt_builder_router(
        prompt_builder_usecases,
        verifier.clone(),
    );

    // Create unified router with path-based routing
    let app = Router::new()
        // Health checks at root level
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        // Service-specific routes with prefixes
        .nest("/auth", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1/context", context_orchestrator_router)
        .merge(backlog_router)
        .merge(readiness_router)
        .merge(prompt_builder_router)
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
