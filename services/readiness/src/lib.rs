pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;
mod projections;

use application::{
    ports::{
        AcceptanceCriteriaRepository, GitHubService, LlmService, ReadinessEvaluationRepository,
        StoryAnalysisSummaryRepository, TaskAnalysisRepository, TaskClarityRepository,
        TaskSuggestionRepository,
    },
    ReadinessUsecases,
};
use event_bus::EventBus;
use sqlx::PgPool;
use std::sync::Arc;

pub use config::AppConfig;

pub async fn build_usecases(
    pool: PgPool,
    event_bus: Arc<EventBus>,
    llm_service: Arc<dyn LlmService>,
) -> Arc<ReadinessUsecases> {
    let pool = Arc::new(pool);
    let store = projections::ProjectionStore::new(pool.clone());
    store.hydrate().await;
    projections::ProjectionWorker::spawn(store.clone(), event_bus);

    let story_service = Arc::new(projections::ProjectionStoryService::new(pool.clone()))
        as Arc<dyn application::ports::StoryService>;
    let criteria_repo: Arc<dyn AcceptanceCriteriaRepository> = pool.clone();
    let readiness_repo: Arc<dyn ReadinessEvaluationRepository> = pool.clone();
    let task_analysis_repo: Arc<dyn TaskAnalysisRepository> = pool.clone();
    let task_clarity_repo: Arc<dyn TaskClarityRepository> = pool.clone();
    let story_summary_repo: Arc<dyn StoryAnalysisSummaryRepository> = pool.clone();
    let task_suggestion_repo: Arc<dyn TaskSuggestionRepository> = pool.clone();

    // Use MockGitHubService for development
    let github_service =
        Arc::new(adapters::integrations::MockGitHubService) as Arc<dyn GitHubService>;

    Arc::new(ReadinessUsecases::new(
        criteria_repo,
        readiness_repo,
        task_analysis_repo,
        task_clarity_repo,
        story_summary_repo,
        task_suggestion_repo,
        story_service,
        llm_service,
        github_service,
    ))
}

pub async fn rebuild_projections(pool: Arc<PgPool>) {
    let store = projections::ProjectionStore::new(pool);
    store.hydrate().await;
}
