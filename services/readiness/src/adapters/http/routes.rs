use crate::adapters::http::handlers::{
    add_criteria, evaluate_readiness, generate_criteria, get_criteria,
};
use crate::adapters::integrations::{HttpBacklogService, MockLlmService, OpenAiLlmService};
use crate::adapters::persistence::{
    SqlAcceptanceCriteriaRepository, SqlReadinessEvaluationRepository,
};
use crate::application::ReadinessUsecases;
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{get, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_readiness_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    // Initialize repositories
    let criteria_repo = Arc::new(SqlAcceptanceCriteriaRepository::new(pool.clone()));
    let readiness_repo = Arc::new(SqlReadinessEvaluationRepository::new(pool.clone()));

    // Initialize integrations
    let backlog_base_url = std::env::var("BACKLOG_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8001".to_string());
    let backlog_service = Arc::new(HttpBacklogService::new(backlog_base_url));

    // Initialize LLM service (OpenAI if key is available, otherwise mock)
    let llm_service: Arc<dyn crate::application::LlmService> =
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            Arc::new(OpenAiLlmService::new(
                api_key,
                std::env::var("OPENAI_MODEL").ok(),
            ))
        } else {
            Arc::new(MockLlmService)
        };

    // Initialize use cases
    let usecases = Arc::new(ReadinessUsecases::new(
        criteria_repo,
        readiness_repo,
        backlog_service,
        llm_service,
    ));

    shuttle_axum::axum::Router::new()
        // Business endpoints
        .route("/readiness/{story_id}/evaluate", post(evaluate_readiness))
        .route("/criteria/{story_id}/generate", post(generate_criteria))
        .route("/criteria/{story_id}", get(get_criteria))
        .route("/criteria/{story_id}", post(add_criteria))
        .with_state(usecases)
        .layer(shuttle_axum::axum::Extension(verifier))
}
