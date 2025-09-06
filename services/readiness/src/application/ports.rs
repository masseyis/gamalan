use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait AcceptanceCriteriaRepository: Send + Sync {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError>;
    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
    #[allow(dead_code)]
    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn delete_criteria_by_story(&self, story_id: Uuid) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        ac_id: &str,
    ) -> Result<Option<AcceptanceCriterion>, AppError>;
}

#[async_trait]
pub trait ReadinessEvaluationRepository: Send + Sync {
    async fn save_evaluation(&self, eval: &ReadinessEvaluation) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_latest_evaluation(
        &self,
        story_id: Uuid,
    ) -> Result<Option<ReadinessEvaluation>, AppError>;
}

#[async_trait]
pub trait StoryService: Send + Sync {
    async fn get_story_info(&self, story_id: Uuid) -> Result<Option<StoryInfo>, AppError>;
    async fn get_tasks_for_story(&self, story_id: Uuid) -> Result<Vec<TaskInfo>, AppError>;
}

#[derive(Debug, Clone)]
pub struct StoryInfo {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TaskInfo {
    #[allow(dead_code)]
    pub id: Uuid,
    #[allow(dead_code)]
    pub story_id: Uuid,
    #[allow(dead_code)]
    pub title: String,
    pub acceptance_criteria_refs: Vec<String>,
}

#[async_trait]
pub trait LlmService: Send + Sync {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
}
