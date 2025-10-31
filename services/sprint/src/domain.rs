use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct Sprint {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub goal: Option<String>,
    pub status: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Sprint metadata for task board response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprintMetadata {
    pub id: Uuid,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub days_remaining: i64,
    pub status: String,
}

impl From<Sprint> for SprintMetadata {
    fn from(sprint: Sprint) -> Self {
        let now = Utc::now();
        let days_remaining = (sprint.end_date - now).num_days();

        Self {
            id: sprint.id,
            name: sprint.name,
            start_date: sprint.start_date,
            end_date: sprint.end_date,
            days_remaining,
            status: sprint.status,
        }
    }
}

/// Sprint statistics for progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprintStats {
    pub total_stories: usize,
    pub total_tasks: usize,
    pub completed_tasks: usize,
    pub completion_percentage: f64,
}

impl SprintStats {
    pub fn new(total_stories: usize, total_tasks: usize, completed_tasks: usize) -> Self {
        let completion_percentage = if total_tasks > 0 {
            (completed_tasks as f64 / total_tasks as f64) * 100.0
        } else {
            0.0
        };

        Self {
            total_stories,
            total_tasks,
            completed_tasks,
            completion_percentage,
        }
    }
}

/// Task with story information for sprint board
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskWithStory {
    pub task_id: Uuid,
    pub title: String,
    pub status: String,
    pub owner_user_id: Option<Uuid>,
    pub owner_name: Option<String>,
    pub story_id: Uuid,
    pub story_title: String,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Grouped tasks by story or status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupedTasks {
    pub groups: std::collections::HashMap<String, Vec<TaskWithStory>>,
    pub counts: std::collections::HashMap<String, usize>,
}

impl GroupedTasks {
    pub fn by_story(tasks: &[TaskWithStory]) -> Self {
        let mut groups: std::collections::HashMap<String, Vec<TaskWithStory>> =
            std::collections::HashMap::new();

        for task in tasks {
            groups
                .entry(task.story_title.clone())
                .or_default()
                .push(task.clone());
        }

        let counts = groups.iter().map(|(k, v)| (k.clone(), v.len())).collect();

        Self { groups, counts }
    }

    pub fn by_status(tasks: &[TaskWithStory]) -> Self {
        let mut groups: std::collections::HashMap<String, Vec<TaskWithStory>> =
            std::collections::HashMap::new();

        for task in tasks {
            groups
                .entry(task.status.clone())
                .or_default()
                .push(task.clone());
        }

        let counts = groups.iter().map(|(k, v)| (k.clone(), v.len())).collect();

        Self { groups, counts }
    }
}

/// Sprint task board response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SprintTaskBoardResponse {
    pub sprint: SprintMetadata,
    pub stats: SprintStats,
    pub tasks: Vec<TaskWithStory>,
    pub grouped_tasks: Option<GroupedTasks>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_task(
        task_id: Uuid,
        story_id: Uuid,
        story_title: &str,
        status: &str,
    ) -> TaskWithStory {
        TaskWithStory {
            task_id,
            title: "Test Task".to_string(),
            status: status.to_string(),
            owner_user_id: None,
            owner_name: None,
            story_id,
            story_title: story_title.to_string(),
            acceptance_criteria_refs: vec!["AC1".to_string()],
            estimated_hours: Some(8),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_sprint_metadata_calculates_days_remaining() {
        let sprint = Sprint {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            name: "Sprint 1".to_string(),
            goal: Some("Test goal".to_string()),
            status: "active".to_string(),
            start_date: Utc::now(),
            end_date: Utc::now() + chrono::Duration::days(7),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let metadata = SprintMetadata::from(sprint);
        assert!(metadata.days_remaining >= 6 && metadata.days_remaining <= 7);
    }

    #[test]
    fn test_sprint_stats_calculates_completion_percentage() {
        let stats = SprintStats::new(3, 10, 7);
        assert_eq!(stats.total_stories, 3);
        assert_eq!(stats.total_tasks, 10);
        assert_eq!(stats.completed_tasks, 7);
        assert_eq!(stats.completion_percentage, 70.0);
    }

    #[test]
    fn test_sprint_stats_handles_zero_tasks() {
        let stats = SprintStats::new(2, 0, 0);
        assert_eq!(stats.completion_percentage, 0.0);
    }

    #[test]
    fn test_grouped_tasks_by_story() {
        let story_id_1 = Uuid::new_v4();
        let story_id_2 = Uuid::new_v4();

        let tasks = vec![
            create_test_task(Uuid::new_v4(), story_id_1, "Story 1", "available"),
            create_test_task(Uuid::new_v4(), story_id_1, "Story 1", "inprogress"),
            create_test_task(Uuid::new_v4(), story_id_2, "Story 2", "completed"),
        ];

        let grouped = GroupedTasks::by_story(&tasks);
        assert_eq!(grouped.groups.len(), 2);
        assert_eq!(grouped.groups.get("Story 1").unwrap().len(), 2);
        assert_eq!(grouped.groups.get("Story 2").unwrap().len(), 1);
        assert_eq!(*grouped.counts.get("Story 1").unwrap(), 2);
        assert_eq!(*grouped.counts.get("Story 2").unwrap(), 1);
    }

    #[test]
    fn test_grouped_tasks_by_status() {
        let story_id = Uuid::new_v4();

        let tasks = vec![
            create_test_task(Uuid::new_v4(), story_id, "Story 1", "available"),
            create_test_task(Uuid::new_v4(), story_id, "Story 1", "available"),
            create_test_task(Uuid::new_v4(), story_id, "Story 1", "inprogress"),
            create_test_task(Uuid::new_v4(), story_id, "Story 2", "completed"),
        ];

        let grouped = GroupedTasks::by_status(&tasks);
        assert_eq!(grouped.groups.len(), 3);
        assert_eq!(grouped.groups.get("available").unwrap().len(), 2);
        assert_eq!(grouped.groups.get("inprogress").unwrap().len(), 1);
        assert_eq!(grouped.groups.get("completed").unwrap().len(), 1);
    }
}
