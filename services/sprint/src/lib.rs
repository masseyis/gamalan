pub mod adapters;
pub mod domain;

use common::AppError;
use domain::{GroupedTasks, Sprint, SprintMetadata, SprintStats, SprintTaskBoardResponse};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct SprintsUsecases {
    pool: Arc<PgPool>,
}

impl SprintsUsecases {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn get_active_sprint(&self, project_id: Uuid) -> Result<Option<Sprint>, AppError> {
        adapters::persistence::repo::get_active_sprint(&self.pool, project_id).await
    }

    /// Get sprint task board with all tasks from stories in the sprint
    pub async fn get_sprint_task_board(
        &self,
        sprint_id: Uuid,
        status_filter: Option<String>,
        owner_filter: Option<Uuid>,
        group_by: Option<String>,
    ) -> Result<SprintTaskBoardResponse, AppError> {
        // Fetch sprint
        let sprint = adapters::persistence::repo::get_sprint_by_id(&self.pool, sprint_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Sprint not found".to_string()))?;

        // Fetch tasks with filters
        let tasks = adapters::persistence::repo::get_sprint_tasks(
            &self.pool,
            sprint_id,
            status_filter,
            owner_filter,
        )
        .await?;

        // Calculate stats
        let total_stories =
            adapters::persistence::repo::count_sprint_stories(&self.pool, sprint_id).await?;
        let total_tasks = tasks.len();
        let completed_tasks = tasks.iter().filter(|t| t.status == "completed").count();

        let stats = SprintStats::new(total_stories, total_tasks, completed_tasks);

        // Group tasks if requested
        let grouped_tasks = group_by.as_ref().and_then(|group| match group.as_str() {
            "story" => Some(GroupedTasks::by_story(&tasks)),
            "status" => Some(GroupedTasks::by_status(&tasks)),
            _ => None,
        });

        Ok(SprintTaskBoardResponse {
            sprint: SprintMetadata::from(sprint),
            stats,
            tasks,
            grouped_tasks,
        })
    }
}
