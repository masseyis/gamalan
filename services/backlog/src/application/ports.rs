use crate::domain::{Story, Task};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait StoryRepository: Send + Sync {
    async fn create_story(&self, story: &Story) -> Result<(), AppError>;
    async fn get_story(&self, id: Uuid) -> Result<Option<Story>, AppError>;
    async fn update_story(&self, story: &Story) -> Result<(), AppError>;
    async fn delete_story(&self, id: Uuid) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_stories_by_project(&self, project_id: Uuid) -> Result<Vec<Story>, AppError>;
}

#[async_trait]
pub trait TaskRepository: Send + Sync {
    async fn create_task(&self, task: &Task) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn get_task(&self, id: Uuid) -> Result<Option<Task>, AppError>;
    async fn get_tasks_by_story(&self, story_id: Uuid) -> Result<Vec<Task>, AppError>;
    #[allow(dead_code)]
    async fn update_task(&self, task: &Task) -> Result<(), AppError>;
    #[allow(dead_code)]
    async fn delete_task(&self, id: Uuid) -> Result<(), AppError>;
}

#[async_trait]
pub trait ReadinessService: Send + Sync {
    async fn validate_acceptance_criteria_refs(
        &self,
        story_id: Uuid,
        ac_refs: &[String],
    ) -> Result<Vec<String>, AppError>;
}
