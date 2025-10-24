pub mod adapters;
pub mod application;
pub mod config;
pub mod domain;
mod projections;

use adapters::persistence::repo::{SqlPlanPackRepository, SqlTaskPackRepository};
use application::{
    ports::{BacklogService, LlmService, PlanPackRepository, ReadinessService, TaskPackRepository},
    PromptBuilderUsecases,
};
use event_bus::EventBus;
use sqlx::PgPool;
use std::sync::Arc;

pub use config::AppConfig;

pub fn build_usecases(
    pool: PgPool,
    event_bus: Arc<EventBus>,
    backlog_service: Arc<dyn BacklogService>,
    readiness_service: Arc<dyn ReadinessService>,
    llm_service: Arc<dyn LlmService>,
) -> Arc<PromptBuilderUsecases> {
    let pool = Arc::new(pool);
    projections::SprintProjectionWorker::spawn(pool.clone(), event_bus);
    let plan_pack_repo: Arc<dyn PlanPackRepository> = Arc::new(SqlPlanPackRepository::new((*pool).clone()));
    let task_pack_repo: Arc<dyn TaskPackRepository> = Arc::new(SqlTaskPackRepository::new((*pool).clone()));

    Arc::new(PromptBuilderUsecases::new(
        plan_pack_repo,
        task_pack_repo,
        backlog_service,
        readiness_service,
        llm_service,
    ))
}
