use crate::domain::{Story, Task};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait StoryRepository: Send + Sync {
    async fn create_story(&self, story: &Story) -> Result<(), AppError>;
    async fn get_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Story>, AppError>;
    async fn update_story(&self, story: &Story) -> Result<(), AppError>;
    async fn delete_story(&self, id: Uuid, organization_id: Option<Uuid>) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_stories_by_project(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Story>, AppError>;
}

#[async_trait]
pub trait TaskRepository: Send + Sync {
    async fn create_task(&self, task: &Task) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_task(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Task>, AppError>;
    async fn get_tasks_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError>;
    #[allow(dead_code)]
    async fn update_task(&self, task: &Task) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn delete_task(&self, id: Uuid, organization_id: Option<Uuid>) -> Result<(), AppError>;
    async fn get_tasks_by_owner(
        &self,
        user_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError>;
    /// Atomically take ownership of a task if it's available
    /// Returns true if successful, false if task was already taken
    async fn take_task_ownership_atomic(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<bool, AppError>;
}

#[async_trait]
pub trait ReadinessService: Send + Sync {
    async fn validate_acceptance_criteria_refs(
        &self,
        story_id: Uuid,
        ac_refs: &[String],
    ) -> Result<Vec<String>, AppError>;
}
