use crate::domain::{AcceptanceCriteria, Story, StoryStatus, Task, TaskStatus};
use chrono::{DateTime, Utc};
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
    pub labels: Vec<String>,
    pub story_points: Option<i32>, // Using i32 for PostgreSQL compatibility
    pub sprint_id: Option<Uuid>,
    pub assigned_to_user_id: Option<Uuid>,
    pub readiness_override: bool,
    pub readiness_override_by: Option<Uuid>,
    pub readiness_override_reason: Option<String>,
    pub readiness_override_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<StoryRow> for Story {
    fn from(row: StoryRow) -> Self {
        let status = StoryStatus::from_str(&row.status).unwrap_or(StoryStatus::Draft);
        Story {
            id: row.id,
            project_id: row.project_id,
            organization_id: row.organization_id,
            title: row.title,
            description: row.description,
            status,
            labels: row.labels,
            acceptance_criteria: Vec::new(), // ACs loaded separately
            story_points: row.story_points.map(|p| p as u32),
            sprint_id: row.sprint_id,
            assigned_to_user_id: row.assigned_to_user_id,
            readiness_override: row.readiness_override,
            readiness_override_by: row.readiness_override_by,
            readiness_override_reason: row.readiness_override_reason,
            readiness_override_at: row.readiness_override_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
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
    pub status: String,
    pub owner_user_id: Option<Uuid>,
    pub estimated_hours: Option<i32>, // Using i32 for PostgreSQL compatibility
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub owned_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        let status = TaskStatus::from_str(&row.status).unwrap_or(TaskStatus::Available);
        Task {
            id: row.id,
            story_id: row.story_id,
            organization_id: row.organization_id,
            title: row.title,
            description: row.description,
            acceptance_criteria_refs: row.acceptance_criteria_refs,
            status,
            owner_user_id: row.owner_user_id,
            estimated_hours: row.estimated_hours.map(|h| h as u32),
            created_at: row.created_at,
            updated_at: row.updated_at,
            owned_at: row.owned_at,
            completed_at: row.completed_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct AcceptanceCriteriaRow {
    pub id: Uuid,
    pub story_id: Uuid,
    pub description: String,
    pub given: String,
    pub when_clause: String,
    pub then_clause: String,
    pub created_at: DateTime<Utc>,
}

impl From<AcceptanceCriteriaRow> for AcceptanceCriteria {
    fn from(row: AcceptanceCriteriaRow) -> Self {
        AcceptanceCriteria {
            id: row.id,
            description: row.description,
            given: row.given,
            when: row.when_clause,
            then: row.then_clause,
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct ProjectRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub organization_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ProjectRow> for crate::domain::Project {
    fn from(row: ProjectRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            description: row.description,
            team_id: row.team_id,
            organization_id: row.organization_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Debug, FromRow)]
pub struct LabelRow {
    #[allow(dead_code)]
    pub id: Uuid,
    pub name: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn acceptance_criteria_row_conversion_preserves_fields() {
        let row = AcceptanceCriteriaRow {
            id: Uuid::new_v4(),
            story_id: Uuid::new_v4(),
            description: "System responds accurately".to_string(),
            given: "a user is authenticated".to_string(),
            when_clause: "they request data".to_string(),
            then_clause: "the system returns a 200 response".to_string(),
            created_at: Utc::now(),
        };

        let ac = AcceptanceCriteria::from(row);

        assert_eq!(ac.description, "System responds accurately");
        assert_eq!(ac.given, "a user is authenticated");
        assert_eq!(ac.when, "they request data");
        assert_eq!(ac.then, "the system returns a 200 response");
    }
}
