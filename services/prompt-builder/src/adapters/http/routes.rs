use crate::adapters::http::handlers::{
    generate_plan_pack_from_story, generate_task_pack_from_task, get_plan_pack_by_story,
    get_task_pack_by_task, get_task_pack_json, get_task_pack_markdown, regenerate_plan_pack,
    regenerate_task_pack,
};
use crate::adapters::integrations::{
    HttpBacklogService, HttpReadinessService, MockLlmService, OpenAiLlmService,
};
use crate::adapters::persistence::{SqlPlanPackRepository, SqlTaskPackRepository};
use crate::application::PromptBuilderUsecases;
use auth_clerk::JwtVerifier;
use axum::routing::{get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_prompt_builder_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> axum::routing::Router {
    // Initialize repositories
    let plan_pack_repo = Arc::new(SqlPlanPackRepository::new(pool.clone()));
    let task_pack_repo = Arc::new(SqlTaskPackRepository::new(pool.clone()));

    // Initialize integrations
    let backlog_base_url = std::env::var("BACKLOG_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8001".to_string());
    let backlog_service = Arc::new(HttpBacklogService::new(backlog_base_url));

    let readiness_base_url = std::env::var("READINESS_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8002".to_string());
    let readiness_service = Arc::new(HttpReadinessService::new(readiness_base_url));

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
    let usecases = Arc::new(PromptBuilderUsecases::new(
        plan_pack_repo,
        task_pack_repo,
        backlog_service,
        readiness_service,
        llm_service,
    ));

    axum::routing::Router::new()
        // Plan Pack endpoints
        .route(
            "/plans/from-story/:story_id",
            post(generate_plan_pack_from_story),
        )
        .route("/plans/story/:story_id", get(get_plan_pack_by_story))
        .route(
            "/plans/story/:story_id/regenerate",
            put(regenerate_plan_pack),
        )
        // Task Pack endpoints
        .route(
            "/work-packets/from-task/:task_id",
            post(generate_task_pack_from_task),
        )
        .route("/work-packets/task/:task_id", get(get_task_pack_by_task))
        .route(
            "/work-packets/task/:task_id/markdown",
            get(get_task_pack_markdown),
        )
        .route("/work-packets/task/:task_id/json", get(get_task_pack_json))
        .route(
            "/work-packets/task/:task_id/regenerate",
            put(regenerate_task_pack),
        )
        .with_state(usecases)
        .layer(axum::Extension(verifier))
}
