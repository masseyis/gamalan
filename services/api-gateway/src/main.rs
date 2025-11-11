use anyhow::Context;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::{HeaderValue, Method};
use axum::middleware;
use axum::routing::get;
use axum::Router;
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

use api_gateway::{
    build_backlog_router, build_prompt_builder_router, build_readiness_router, build_sprint_router,
    PromptBacklogServiceAdapter, PromptReadinessServiceAdapter,
};
use event_bus::{EventBus, EventPublisher};

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

    // Core usecases
    let event_bus = Arc::new(EventBus::new());
    let event_publisher: Arc<dyn EventPublisher> = event_bus.clone();
    let backlog_usecases = backlog::build_usecases(pool.clone(), event_publisher);

    let readiness_llm: Arc<dyn readiness::application::ports::LlmService> =
        Arc::new(readiness::adapters::integrations::MockLlmService);
    let readiness_usecases =
        readiness::build_usecases(pool.clone(), event_bus.clone(), readiness_llm).await;

    let prompt_backlog_service = Arc::new(PromptBacklogServiceAdapter {
        backlog: backlog_usecases.clone(),
    });
    let prompt_readiness_service = Arc::new(PromptReadinessServiceAdapter {
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

    let sprint_usecases = Arc::new(sprint::SprintsUsecases::new(Arc::new(pool.clone())));

    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let context_orchestrator_router = context_orchestrator::create_context_orchestrator_router(
        pool.clone(),
        verifier.clone(),
        event_bus.clone(),
    )
    .await;

    let backlog_router =
        build_backlog_router(backlog_usecases.clone(), pool.clone(), verifier.clone());
    let readiness_router =
        build_readiness_router(pool.clone(), readiness_usecases.clone(), verifier.clone());
    let prompt_builder_router =
        build_prompt_builder_router(prompt_builder_usecases.clone(), verifier.clone());
    let sprint_router = build_sprint_router(sprint_usecases.clone(), verifier.clone());

    let api_key_state = api_gateway::auth::ApiKeyState::new(Arc::new(pool.clone()));

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
            "X-Organization-External-Id".parse().unwrap(),
            "X-Organization-Name".parse().unwrap(),
            "X-Api-Key".parse().unwrap(),
        ])
        .allow_credentials(true);

    let app = Router::new()
        // Health checks at root level
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        // Service-specific routes with prefixes
        .nest("/api/v1", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1/context", context_orchestrator_router)
        .merge(backlog_router)
        .merge(readiness_router)
        .merge(prompt_builder_router)
        .merge(sprint_router)
        // Add CORS and tracing
        .layer(middleware::from_fn_with_state(
            api_key_state,
            api_gateway::auth::api_key_auth,
        ))
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
