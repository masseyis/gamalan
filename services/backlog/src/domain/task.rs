use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Task status representing the lifecycle with self-selection ownership model
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    /// Task is created and available for contributors to take ownership
    Available,
    /// Task is owned by a contributor ("I'm on it")
    Owned,
    /// Task work is in progress
    InProgress,
    /// Task is completed
    Completed,
}

impl TaskStatus {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "available" => Some(Self::Available),
            "owned" => Some(Self::Owned),
            "inprogress" => Some(Self::InProgress),
            "completed" => Some(Self::Completed),
            _ => None,
        }
    }

    /// Get valid transition states from current status
    pub fn valid_transitions(&self) -> Vec<TaskStatus> {
        match self {
            Self::Available => vec![Self::Owned],
            Self::Owned => vec![Self::InProgress, Self::Available], // Can release ownership
            Self::InProgress => vec![Self::Completed, Self::Owned], // Can go back to owned if need to pause
            Self::Completed => vec![],                              // Terminal state
        }
    }

    /// Check if transition to target status is valid
    pub fn can_transition_to(&self, target: &TaskStatus) -> bool {
        self.valid_transitions().contains(target)
    }

    /// Check if task is available for ownership
    pub fn is_available(&self) -> bool {
        matches!(self, Self::Available)
    }

    /// Check if task is actively being worked on
    pub fn is_active(&self) -> bool {
        matches!(self, Self::InProgress)
    }

    /// Check if task is completed
    pub fn is_completed(&self) -> bool {
        matches!(self, Self::Completed)
    }
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Available => write!(f, "available"),
            Self::Owned => write!(f, "owned"),
            Self::InProgress => write!(f, "inprogress"),
            Self::Completed => write!(f, "completed"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub status: TaskStatus,
    pub owner_user_id: Option<Uuid>, // Contributor who owns this task
    pub estimated_hours: Option<u32>, // Estimated effort in hours
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub owned_at: Option<DateTime<Utc>>, // When task was taken ownership
    pub completed_at: Option<DateTime<Utc>>, // When task was completed
}

impl Task {
    pub fn new(
        story_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
        acceptance_criteria_refs: Vec<String>,
    ) -> Result<Self, AppError> {
        // Validate title is not empty or whitespace-only
        if title.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Task title cannot be empty".to_string(),
            ));
        }

        // Validate acceptance criteria refs vector is not empty
        if acceptance_criteria_refs.is_empty() {
            return Err(AppError::BadRequest(
                "Task must have at least one acceptance criteria reference".to_string(),
            ));
        }

        // Validate AC refs are not empty strings
        for ac_ref in &acceptance_criteria_refs {
            if ac_ref.trim().is_empty() {
                return Err(AppError::BadRequest(
                    "Acceptance criteria references cannot be empty".to_string(),
                ));
            }
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            story_id,
            organization_id,
            title: title.trim().to_string(),
            description,
            acceptance_criteria_refs,
            status: TaskStatus::Available,
            owner_user_id: None,
            estimated_hours: None,
            created_at: now,
            updated_at: now,
            owned_at: None,
            completed_at: None,
        })
    }

    /// Take ownership of task (contributor self-selection - "I'm on it")
    pub fn take_ownership(&mut self, user_id: Uuid) -> Result<(), AppError> {
        if !self.status.is_available() {
            return Err(AppError::BadRequest(format!(
                "Task is not available for ownership. Current status: {}",
                self.status
            )));
        }

        self.status = TaskStatus::Owned;
        self.owner_user_id = Some(user_id);
        self.owned_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Release ownership of task (make it available again)
    pub fn release_ownership(&mut self, user_id: Uuid) -> Result<(), AppError> {
        // Only the owner can release ownership
        if self.owner_user_id != Some(user_id) {
            return Err(AppError::BadRequest(
                "Only the task owner can release ownership".to_string(),
            ));
        }

        if !matches!(self.status, TaskStatus::Owned | TaskStatus::InProgress) {
            return Err(AppError::BadRequest(format!(
                "Cannot release ownership. Current status: {}",
                self.status
            )));
        }

        self.status = TaskStatus::Available;
        self.owner_user_id = None;
        self.owned_at = None;
        self.estimated_hours = None; // Clear estimate when releasing ownership
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Start working on task (transition from Owned to InProgress)
    pub fn start_work(&mut self, user_id: Uuid) -> Result<(), AppError> {
        // Only the owner can start work
        if self.owner_user_id != Some(user_id) {
            return Err(AppError::BadRequest(
                "Only the task owner can start work".to_string(),
            ));
        }

        if !self.status.can_transition_to(&TaskStatus::InProgress) {
            return Err(AppError::BadRequest(format!(
                "Cannot start work. Current status: {}",
                self.status
            )));
        }

        self.status = TaskStatus::InProgress;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Complete the task
    pub fn complete(&mut self, user_id: Uuid) -> Result<(), AppError> {
        // Only the owner can complete the task
        if self.owner_user_id != Some(user_id) {
            return Err(AppError::BadRequest(
                "Only the task owner can complete the task".to_string(),
            ));
        }

        if !self.status.can_transition_to(&TaskStatus::Completed) {
            return Err(AppError::BadRequest(format!(
                "Cannot complete task. Current status: {}",
                self.status
            )));
        }

        self.status = TaskStatus::Completed;
        self.completed_at = Some(Utc::now());
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Pause work (go back from InProgress to Owned)
    pub fn pause_work(&mut self, user_id: Uuid) -> Result<(), AppError> {
        // Only the owner can pause work
        if self.owner_user_id != Some(user_id) {
            return Err(AppError::BadRequest(
                "Only the task owner can pause work".to_string(),
            ));
        }

        if !self.status.can_transition_to(&TaskStatus::Owned) {
            return Err(AppError::BadRequest(format!(
                "Cannot pause work. Current status: {}",
                self.status
            )));
        }

        self.status = TaskStatus::Owned;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Set estimated hours for the task (None to clear estimate)
    pub fn set_estimated_hours(&mut self, hours: Option<u32>) -> Result<(), AppError> {
        if let Some(h) = hours {
            if h == 0 {
                return Err(AppError::BadRequest(
                    "Estimated hours must be greater than 0".to_string(),
                ));
            }

            // Maximum 40 hours per task (1 week of work) - opinionated constraint
            if h > 40 {
                return Err(AppError::BadRequest(
                    "Task cannot exceed 40 hours (split into smaller tasks)".to_string(),
                ));
            }
        }

        self.estimated_hours = hours;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Update acceptance criteria refs
    pub fn update_acceptance_criteria_refs(&mut self, refs: Vec<String>) -> Result<(), AppError> {
        // Can only update ACs if task is not completed
        if self.status.is_completed() {
            return Err(AppError::BadRequest(
                "Cannot update acceptance criteria for completed task".to_string(),
            ));
        }

        // Validate acceptance criteria refs vector is not empty
        if refs.is_empty() {
            return Err(AppError::BadRequest(
                "Task must have at least one acceptance criteria reference".to_string(),
            ));
        }

        // Validate AC refs are not empty strings
        for ac_ref in &refs {
            if ac_ref.trim().is_empty() {
                return Err(AppError::BadRequest(
                    "Acceptance criteria references cannot be empty".to_string(),
                ));
            }
        }

        self.acceptance_criteria_refs = refs;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Check if task is owned by a specific user
    pub fn is_owned_by(&self, user_id: Uuid) -> bool {
        self.owner_user_id == Some(user_id)
    }

    /// Check if task is available for ownership
    pub fn is_available_for_ownership(&self) -> bool {
        self.status.is_available()
    }

    /// Get task duration if completed
    pub fn duration_hours(&self) -> Option<i64> {
        if let (Some(owned_at), Some(completed_at)) = (self.owned_at, self.completed_at) {
            Some((completed_at - owned_at).num_hours())
        } else {
            None
        }
    }

    /// Check if task is blocked (no owner but not available)
    pub fn is_blocked(&self) -> bool {
        matches!(self.status, TaskStatus::Owned | TaskStatus::InProgress)
            && self.owner_user_id.is_none()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TakeOwnershipRequest {
    pub user_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_task() -> Task {
        Task::new(
            Uuid::new_v4(),
            Some(Uuid::new_v4()),
            "Test Task".to_string(),
            Some("Test description".to_string()),
            vec!["AC1".to_string(), "AC2".to_string()],
        )
        .unwrap()
    }

    #[test]
    fn test_create_task_with_valid_data() {
        let story_id = Uuid::new_v4();
        let ac_refs = vec!["AC1".to_string(), "AC2".to_string()];
        let task = Task::new(
            story_id,
            None,
            "Test task".to_string(),
            Some("Description".to_string()),
            ac_refs.clone(),
        )
        .unwrap();

        assert_eq!(task.story_id, story_id);
        assert_eq!(task.title, "Test task");
        assert_eq!(task.description, Some("Description".to_string()));
        assert_eq!(task.acceptance_criteria_refs, ac_refs);
        assert_eq!(task.status, TaskStatus::Available);
        assert!(task.owner_user_id.is_none());
        assert!(task.estimated_hours.is_none());
        assert!(task.owned_at.is_none());
        assert!(task.completed_at.is_none());
        assert!(task.is_available_for_ownership());
    }

    #[test]
    fn test_create_task_with_empty_title_fails() {
        let story_id = Uuid::new_v4();
        let ac_refs = vec!["AC1".to_string()];

        let result = Task::new(story_id, None, "".to_string(), None, ac_refs);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Task title cannot be empty"));
    }

    #[test]
    fn test_create_task_with_empty_ac_refs_fails() {
        let story_id = Uuid::new_v4();

        let result = Task::new(story_id, None, "Test".to_string(), None, vec![]);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Task must have at least one acceptance criteria reference"));
    }

    #[test]
    fn test_create_task_with_empty_ac_ref_fails() {
        let story_id = Uuid::new_v4();
        let ac_refs = vec!["AC1".to_string(), "".to_string()];

        let result = Task::new(story_id, None, "Test task".to_string(), None, ac_refs);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Acceptance criteria references cannot be empty"));
    }

    #[test]
    fn test_task_ownership_flow() {
        let mut task = create_test_task();
        let user_id = Uuid::new_v4();

        // Initially available
        assert_eq!(task.status, TaskStatus::Available);
        assert!(task.is_available_for_ownership());

        // Take ownership
        task.take_ownership(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Owned);
        assert_eq!(task.owner_user_id, Some(user_id));
        assert!(task.owned_at.is_some());
        assert!(task.is_owned_by(user_id));

        // Start work
        task.start_work(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::InProgress);
        assert!(task.status.is_active());

        // Complete task
        task.complete(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Completed);
        assert!(task.completed_at.is_some());
        assert!(task.status.is_completed());
    }

    #[test]
    fn test_task_ownership_security() {
        let mut task = create_test_task();
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        // Take ownership
        task.take_ownership(owner_id).unwrap();

        // Other user cannot start work
        assert!(task.start_work(other_user_id).is_err());

        // Other user cannot complete task
        assert!(task.complete(other_user_id).is_err());

        // Other user cannot release ownership
        assert!(task.release_ownership(other_user_id).is_err());

        // Other user cannot pause work
        task.start_work(owner_id).unwrap();
        assert!(task.pause_work(other_user_id).is_err());
    }

    #[test]
    fn test_release_ownership() {
        let mut task = create_test_task();
        let user_id = Uuid::new_v4();

        // Take ownership and start work
        task.take_ownership(user_id).unwrap();
        task.start_work(user_id).unwrap();

        // Release ownership
        task.release_ownership(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Available);
        assert!(task.owner_user_id.is_none());
        assert!(task.owned_at.is_none());
    }

    #[test]
    fn test_pause_and_resume_work() {
        let mut task = create_test_task();
        let user_id = Uuid::new_v4();

        // Take ownership and start work
        task.take_ownership(user_id).unwrap();
        task.start_work(user_id).unwrap();

        // Pause work
        task.pause_work(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Owned);

        // Resume work
        task.start_work(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::InProgress);
    }

    #[test]
    fn test_task_status_transitions() {
        // Test valid transitions
        assert!(TaskStatus::Available.can_transition_to(&TaskStatus::Owned));
        assert!(TaskStatus::Owned.can_transition_to(&TaskStatus::InProgress));
        assert!(TaskStatus::Owned.can_transition_to(&TaskStatus::Available));
        assert!(TaskStatus::InProgress.can_transition_to(&TaskStatus::Completed));
        assert!(TaskStatus::InProgress.can_transition_to(&TaskStatus::Owned));

        // Test invalid transitions
        assert!(!TaskStatus::Available.can_transition_to(&TaskStatus::InProgress));
        assert!(!TaskStatus::Available.can_transition_to(&TaskStatus::Completed));
        assert!(!TaskStatus::Completed.can_transition_to(&TaskStatus::Available));
    }

    #[test]
    fn test_cannot_take_ownership_of_owned_task() {
        let mut task = create_test_task();
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();

        // User1 takes ownership
        task.take_ownership(user1).unwrap();

        // User2 cannot take ownership
        assert!(task.take_ownership(user2).is_err());
    }

    #[test]
    fn test_set_estimated_hours() {
        let mut task = create_test_task();

        // Valid hours
        task.set_estimated_hours(Some(8)).unwrap();
        assert_eq!(task.estimated_hours, Some(8));

        // Zero hours should fail
        assert!(task.set_estimated_hours(Some(0)).is_err());

        // More than 40 hours should fail
        assert!(task.set_estimated_hours(Some(50)).is_err());

        // Exactly 40 hours should be allowed
        task.set_estimated_hours(Some(40)).unwrap();
        assert_eq!(task.estimated_hours, Some(40));
    }

    #[test]
    fn test_update_acceptance_criteria_refs() {
        let mut task = create_test_task();

        let new_refs = vec!["AC3".to_string(), "AC4".to_string()];
        task.update_acceptance_criteria_refs(new_refs.clone())
            .unwrap();
        assert_eq!(task.acceptance_criteria_refs, new_refs);

        // Cannot update if completed
        let user_id = Uuid::new_v4();
        task.take_ownership(user_id).unwrap();
        task.start_work(user_id).unwrap();
        task.complete(user_id).unwrap();

        assert!(task
            .update_acceptance_criteria_refs(vec!["AC5".to_string()])
            .is_err());
    }

    #[test]
    fn test_task_duration_calculation() {
        let mut task = create_test_task();
        let user_id = Uuid::new_v4();

        // No duration initially
        assert!(task.duration_hours().is_none());

        // Take ownership and complete
        task.take_ownership(user_id).unwrap();
        task.start_work(user_id).unwrap();
        task.complete(user_id).unwrap();

        // Should have duration (even if very small)
        assert!(task.duration_hours().is_some());
        let duration = task.duration_hours().unwrap();
        assert!(duration >= 0);
    }

    #[test]
    fn test_task_status_helper_methods() {
        assert!(TaskStatus::Available.is_available());
        assert!(!TaskStatus::Owned.is_available());

        assert!(TaskStatus::InProgress.is_active());
        assert!(!TaskStatus::Available.is_active());

        assert!(TaskStatus::Completed.is_completed());
        assert!(!TaskStatus::InProgress.is_completed());
    }

    #[test]
    fn test_task_status_from_str() {
        assert_eq!(
            TaskStatus::from_str("available"),
            Some(TaskStatus::Available)
        );
        assert_eq!(TaskStatus::from_str("owned"), Some(TaskStatus::Owned));
        assert_eq!(
            TaskStatus::from_str("inprogress"),
            Some(TaskStatus::InProgress)
        );
        assert_eq!(
            TaskStatus::from_str("completed"),
            Some(TaskStatus::Completed)
        );
        assert_eq!(TaskStatus::from_str("invalid"), None);
    }

    #[test]
    fn test_task_status_display() {
        assert_eq!(TaskStatus::Available.to_string(), "available");
        assert_eq!(TaskStatus::Owned.to_string(), "owned");
        assert_eq!(TaskStatus::InProgress.to_string(), "inprogress");
        assert_eq!(TaskStatus::Completed.to_string(), "completed");
    }

    #[test]
    fn test_task_ownership_workflow_end_to_end() {
        let mut task = create_test_task();
        let user_id = Uuid::new_v4();

        // Start as available
        assert_eq!(task.status, TaskStatus::Available);
        assert!(task.is_available_for_ownership());

        // Contributor takes ownership ("I'm on it")
        task.take_ownership(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Owned);
        assert!(task.is_owned_by(user_id));

        // Start working
        task.start_work(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::InProgress);

        // Complete the task
        task.complete(user_id).unwrap();
        assert_eq!(task.status, TaskStatus::Completed);
        assert!(task.completed_at.is_some());

        // Cannot transition from completed
        assert!(task.start_work(user_id).is_err());
        assert!(task.take_ownership(Uuid::new_v4()).is_err());
    }
}
