pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;
mod projections;

use application::{
    ports::{
        AcceptanceCriteriaRepository, LlmService, ReadinessEvaluationRepository,
        TaskAnalysisRepository,
    },
    ReadinessUsecases,
};
use event_bus::EventBus;
use sqlx::PgPool;
use std::sync::Arc;

pub use config::AppConfig;

pub fn build_usecases(
    pool: PgPool,
    event_bus: Arc<EventBus>,
    llm_service: Arc<dyn LlmService>,
) -> Arc<ReadinessUsecases> {
    let pool = Arc::new(pool);
    projections::ProjectionWorker::spawn(pool.clone(), event_bus);

    let story_service = Arc::new(projections::ProjectionStoryService::new(pool.clone()))
        as Arc<dyn application::ports::StoryService>;
    let criteria_repo: Arc<dyn AcceptanceCriteriaRepository> = pool.clone();
    let readiness_repo: Arc<dyn ReadinessEvaluationRepository> = pool.clone();
    let task_analysis_repo: Arc<dyn TaskAnalysisRepository> = pool.clone();

    Arc::new(ReadinessUsecases::new(
        criteria_repo,
        readiness_repo,
        task_analysis_repo,
        story_service,
        llm_service,
    ))
}

pub async fn rebuild_projections(pool: Arc<PgPool>) {
    let store = projections::ProjectionStore::new(pool);
    store.hydrate().await;
}
