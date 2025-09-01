use anyhow::Context;
use axum::middleware;
use qdrant_client::client::QdrantClient;
use shuttle_axum::ShuttleAxum;
use shuttle_qdrant::Qdrant;
use shuttle_runtime::SecretStore;
use shuttle_shared_db::Postgres;
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::trace::TraceLayer;

mod adapters;
mod application;
mod domain;

use crate::adapters::{
    http::create_routes,
    integrations::{HttpBacklogClient, HttpPromptBuilderClient, HttpReadinessClient, OpenAILlmClient},
    persistence::{PostgresRepository, QdrantRepository},
};
use common::{correlation_id_extractor, init_tracing};

#[derive(Clone)]
pub struct AppState {
    pub postgres_repo: Arc<PostgresRepository>,
    pub qdrant_repo: Arc<QdrantRepository>,
    pub llm_client: Arc<OpenAILlmClient>,
    pub backlog_client: Arc<HttpBacklogClient>,
    pub prompt_builder_client: Arc<HttpPromptBuilderClient>,
    pub readiness_client: Arc<HttpReadinessClient>,
}

#[shuttle_runtime::main]
async fn main(
    #[Postgres(local_uri = "postgres://postgres:password@localhost:5432/gamalan")] 
    db_uri: String,
    #[Qdrant(local_url = "http://localhost:6334")] 
    qdrant_client: QdrantClient,
    #[shuttle_runtime::Secrets] 
    secrets: SecretStore,
) -> ShuttleAxum {
    init_tracing();

    // Setup PostgreSQL connection
    let pool = PgPool::connect(&db_uri)
        .await
        .context("Failed to connect to database")?;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("Failed to run migrations")?;

    // Initialize repositories
    let postgres_repo = Arc::new(PostgresRepository::new(pool));
    let qdrant_repo = Arc::new(QdrantRepository::new(qdrant_client));
    
    // Bootstrap Qdrant collection
    qdrant_repo
        .bootstrap_collection()
        .await
        .context("Failed to bootstrap Qdrant collection")?;

    // Initialize LLM client
    let openai_api_key = secrets
        .get("OPENAI_API_KEY")
        .context("OPENAI_API_KEY not found in secrets")?;
    let llm_client = Arc::new(OpenAILlmClient::new(openai_api_key));

    // Initialize service clients
    let backlog_url = secrets
        .get("BACKLOG_SERVICE_URL")
        .unwrap_or_else(|| "http://localhost:8001".to_string());
    let prompt_builder_url = secrets
        .get("PROMPT_BUILDER_SERVICE_URL")
        .unwrap_or_else(|| "http://localhost:8002".to_string());
    let readiness_url = secrets
        .get("READINESS_SERVICE_URL")
        .unwrap_or_else(|| "http://localhost:8003".to_string());

    let backlog_client = Arc::new(HttpBacklogClient::new(backlog_url));
    let prompt_builder_client = Arc::new(HttpPromptBuilderClient::new(prompt_builder_url));
    let readiness_client = Arc::new(HttpReadinessClient::new(readiness_url));

    // Setup application state
    let state = AppState {
        postgres_repo,
        qdrant_repo,
        llm_client,
        backlog_client,
        prompt_builder_client,
        readiness_client,
    };

    // Build router with middleware
    let app = create_routes()
        .with_state(state)
        .layer(middleware::from_fn(correlation_id_extractor))
        .layer(TraceLayer::new_for_http());

    Ok(app.into())
}