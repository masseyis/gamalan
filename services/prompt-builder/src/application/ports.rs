use crate::domain::{PlanPack, TaskPack};
use async_trait::async_trait;
use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[async_trait]
pub trait PlanPackRepository: Send + Sync {
    async fn save_plan_pack(&self, plan_pack: &PlanPack) -> Result<(), AppError>;
    async fn get_plan_pack(&self, id: Uuid) -> Result<Option<PlanPack>, AppError>;
    async fn get_plan_pack_by_story(&self, story_id: Uuid) -> Result<Option<PlanPack>, AppError>;
    async fn delete_plan_pack(&self, id: Uuid) -> Result<(), AppError>;
}

#[async_trait]
pub trait TaskPackRepository: Send + Sync {
    async fn save_task_pack(&self, task_pack: &TaskPack) -> Result<(), AppError>;
    async fn get_task_pack(&self, id: Uuid) -> Result<Option<TaskPack>, AppError>;
    async fn get_task_pack_by_task(&self, task_id: Uuid) -> Result<Option<TaskPack>, AppError>;
    async fn delete_task_pack(&self, id: Uuid) -> Result<(), AppError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryInfo {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriterion {
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

#[async_trait]
pub trait BacklogService: Send + Sync {
    async fn get_story_info(&self, story_id: Uuid) -> Result<Option<StoryInfo>, AppError>;
    async fn get_task_info(&self, task_id: Uuid) -> Result<Option<TaskInfo>, AppError>;
}

#[async_trait]
pub trait ReadinessService: Send + Sync {
    async fn get_acceptance_criteria(
        &self,
        story_id: Uuid,
    ) -> Result<Vec<AcceptanceCriterion>, AppError>;
    async fn evaluate_readiness(&self, story_id: Uuid) -> Result<ReadinessEvaluation, AppError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadinessEvaluation {
    pub score: i32,
    pub missing_items: Vec<String>,
}

#[async_trait]
pub trait LlmService: Send + Sync {
    async fn generate_plan_pack(
        &self,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<PlanPackGeneration, AppError>;
    async fn generate_task_pack(
        &self,
        task: &TaskInfo,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<TaskPackGeneration, AppError>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanPackGeneration {
    pub proposed_tasks: Vec<ProposedTaskGeneration>,
    pub architecture_impact: Option<String>,
    pub risks: Vec<String>,
    pub unknowns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposedTaskGeneration {
    pub title: String,
    pub description: String,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_effort: Option<String>,
    pub technical_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPackGeneration {
    pub objectives: String,
    pub non_goals: Vec<String>,
    pub file_paths: Vec<String>,
    pub ports_to_implement: Vec<String>,
    pub dtos_to_create: Vec<String>,
    pub architecture_notes: String,
    pub unit_tests: Vec<String>,
    pub integration_tests: Vec<String>,
    pub contract_tests: Vec<String>,
    pub coverage_threshold: Option<i32>,
    pub forbidden_actions: Vec<String>,
    pub no_shortcuts: Vec<String>,
    pub required_practices: Vec<String>,
    pub commit_message_template: String,
    pub pre_commit_checks: Vec<String>,
    pub run_instructions: Vec<String>,
}
