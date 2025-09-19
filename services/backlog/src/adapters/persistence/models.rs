use crate::domain::{Story, StoryStatus, Task};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct StoryRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
}

impl From<StoryRow> for Story {
    fn from(row: StoryRow) -> Self {
        let status = StoryStatus::from_str(&row.status).unwrap_or(StoryStatus::Ready);
        Story {
            id: row.id,
            project_id: row.project_id,
            organization_id: row.organization_id,
            title: row.title,
            description: row.description,
            status,
            labels: Vec::new(), // Labels loaded separately
        }
    }
}

#[derive(Debug, FromRow)]
pub struct TaskRow {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Task {
            id: row.id,
            story_id: row.story_id,
            organization_id: row.organization_id,
            title: row.title,
            description: row.description,
            acceptance_criteria_refs: row.acceptance_criteria_refs,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct LabelRow {
    #[allow(dead_code)]
    pub id: Uuid,
    pub name: String,
}
