use crate::domain::{AcceptanceCriterion, ReadinessEvaluation, TaskAnalysis};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait AcceptanceCriteriaRepository: Send + Sync {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError>;
    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
    #[allow(dead_code)]
    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn delete_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
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
        organization_id: Option<Uuid>,
    ) -> Result<Option<ReadinessEvaluation>, AppError>;
}

#[async_trait]
pub trait StoryService: Send + Sync {
    async fn get_story_info(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<StoryInfo>, AppError>;
    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError>;
}

#[derive(Debug, Clone)]
pub struct StoryInfo {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub story_points: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct TaskInfo {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
}

#[async_trait]
pub trait LlmService: Send + Sync {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
}

#[async_trait]
pub trait TaskAnalysisRepository: Send + Sync {
    async fn save_analysis(&self, analysis: &TaskAnalysis) -> Result<(), AppError>;
    async fn get_latest_analysis(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskAnalysis>, AppError>;
}
