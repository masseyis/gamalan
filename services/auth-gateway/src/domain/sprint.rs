use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SprintStatus {
    Planning,  // Sprint is being planned but not started
    Active,    // Sprint is currently in progress
    Review,    // Sprint is in review phase (retrospective)
    Completed, // Sprint is completed
}

impl fmt::Display for SprintStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SprintStatus::Planning => write!(f, "planning"),
            SprintStatus::Active => write!(f, "active"),
            SprintStatus::Review => write!(f, "review"),
            SprintStatus::Completed => write!(f, "completed"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sprint {
    pub id: Uuid,
    pub team_id: Uuid,
    pub name: String,
    pub goal: String,
    pub status: SprintStatus,
    pub committed_story_points: u32, // Story points committed to sprint
    pub completed_story_points: u32, // Story points completed
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Sprint {
    pub fn new(
        team_id: Uuid,
        name: String,
        goal: String,
        capacity_points: u32,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<Self, AppError> {
        if name.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Sprint name cannot be empty".to_string(),
            ));
        }

        if goal.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Sprint goal cannot be empty".to_string(),
            ));
        }

        if capacity_points == 0 {
            return Err(AppError::BadRequest(
                "Sprint capacity must be greater than 0".to_string(),
            ));
        }

        if start_date >= end_date {
            return Err(AppError::BadRequest(
                "Sprint start date must be before end date".to_string(),
            ));
        }

        // Sprint must be at least 1 day long
        let duration = end_date - start_date;
        if duration.num_days() < 1 {
            return Err(AppError::BadRequest(
                "Sprint must be at least 1 day long".to_string(),
            ));
        }

        // Sprint should not be longer than 4 weeks (28 days)
        if duration.num_days() > 28 {
            return Err(AppError::BadRequest(
                "Sprint cannot be longer than 4 weeks".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            team_id,
            name: name.trim().to_string(),
            goal: goal.trim().to_string(),
            status: SprintStatus::Planning,
            capacity_points,
            committed_points: 0,
            completed_points: 0,
            start_date,
            end_date,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Start the sprint - can only start from Planning status
    pub fn start(&mut self) -> Result<(), AppError> {
        if self.status != SprintStatus::Planning {
            return Err(AppError::BadRequest(
                "Can only start sprint from Planning status".to_string(),
            ));
        }

        self.status = SprintStatus::Active;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Move sprint to review phase - can only move from Active status
    pub fn move_to_review(&mut self) -> Result<(), AppError> {
        if self.status != SprintStatus::Active {
            return Err(AppError::BadRequest(
                "Can only move to review from Active status".to_string(),
            ));
        }

        self.status = SprintStatus::Review;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Complete the sprint - can only complete from Review status
    pub fn complete(&mut self) -> Result<(), AppError> {
        if self.status != SprintStatus::Review {
            return Err(AppError::BadRequest(
                "Can only complete sprint from Review status".to_string(),
            ));
        }

        self.status = SprintStatus::Completed;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Add story points to committed points (when story is committed to sprint)
    pub fn commit_story_points(&mut self, points: u32) -> Result<(), AppError> {
        if self.status == SprintStatus::Completed {
            return Err(AppError::BadRequest(
                "Cannot commit points to completed sprint".to_string(),
            ));
        }

        let new_committed = self.committed_points + points;
        if new_committed > self.capacity_points {
            return Err(AppError::BadRequest(format!(
                "Cannot commit {} points. Would exceed capacity of {} points",
                new_committed, self.capacity_points
            )));
        }

        self.committed_points = new_committed;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Remove story points from committed points (when story is removed from sprint)
    pub fn remove_committed_points(&mut self, points: u32) -> Result<(), AppError> {
        if self.committed_points < points {
            return Err(AppError::BadRequest(
                "Cannot remove more points than committed".to_string(),
            ));
        }

        self.committed_points -= points;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Complete story points (when story is done)
    pub fn complete_story_points(&mut self, points: u32) -> Result<(), AppError> {
        if self.status != SprintStatus::Active {
            return Err(AppError::BadRequest(
                "Can only complete points in active sprint".to_string(),
            ));
        }

        let new_completed = self.completed_points + points;
        if new_completed > self.committed_points {
            return Err(AppError::BadRequest(
                "Cannot complete more points than committed".to_string(),
            ));
        }

        self.completed_points = new_completed;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Check if sprint is currently active
    pub fn is_active(&self) -> bool {
        self.status == SprintStatus::Active
    }

    /// Check if sprint can accept new stories
    pub fn can_accept_stories(&self) -> bool {
        matches!(self.status, SprintStatus::Planning | SprintStatus::Active)
    }

    /// Calculate available capacity for new stories
    pub fn available_capacity(&self) -> u32 {
        self.capacity_points.saturating_sub(self.committed_points)
    }

    /// Calculate completion percentage
    pub fn completion_percentage(&self) -> f64 {
        if self.committed_points == 0 {
            0.0
        } else {
            (self.completed_points as f64 / self.committed_points as f64) * 100.0
        }
    }

    /// Check if sprint is overcommitted
    pub fn is_overcommitted(&self) -> bool {
        self.committed_points > self.capacity_points
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSprintRequest {
    pub team_id: Uuid,
    pub name: String,
    pub goal: String,
    pub capacity_points: u32,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_create_sprint_with_valid_data() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Implement user authentication".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        assert_eq!(sprint.team_id, team_id);
        assert_eq!(sprint.name, "Sprint 1");
        assert_eq!(sprint.goal, "Implement user authentication");
        assert_eq!(sprint.capacity_points, 40);
        assert_eq!(sprint.committed_points, 0);
        assert_eq!(sprint.completed_points, 0);
        assert_eq!(sprint.status, SprintStatus::Planning);
        assert!(sprint.can_accept_stories());
        assert_eq!(sprint.available_capacity(), 40);
    }

    #[test]
    fn test_create_sprint_with_empty_name_fails() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let result = Sprint::new(
            team_id,
            "".to_string(),
            "Some goal".to_string(),
            40,
            start_date,
            end_date,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Sprint name cannot be empty"));
    }

    #[test]
    fn test_create_sprint_with_empty_goal_fails() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let result = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "".to_string(),
            40,
            start_date,
            end_date,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Sprint goal cannot be empty"));
    }

    #[test]
    fn test_create_sprint_with_zero_capacity_fails() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let result = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Some goal".to_string(),
            0,
            start_date,
            end_date,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Sprint capacity must be greater than 0"));
    }

    #[test]
    fn test_create_sprint_with_invalid_dates_fails() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date - Duration::days(1); // End before start

        let result = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Some goal".to_string(),
            40,
            start_date,
            end_date,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Sprint start date must be before end date"));
    }

    #[test]
    fn test_create_sprint_too_long_fails() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::days(30); // More than 4 weeks

        let result = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Some goal".to_string(),
            40,
            start_date,
            end_date,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Sprint cannot be longer than 4 weeks"));
    }

    #[test]
    fn test_sprint_status_transitions() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let mut sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Test goal".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        // Start sprint
        assert_eq!(sprint.status, SprintStatus::Planning);
        sprint.start().unwrap();
        assert_eq!(sprint.status, SprintStatus::Active);
        assert!(sprint.is_active());

        // Move to review
        sprint.move_to_review().unwrap();
        assert_eq!(sprint.status, SprintStatus::Review);
        assert!(!sprint.is_active());

        // Complete sprint
        sprint.complete().unwrap();
        assert_eq!(sprint.status, SprintStatus::Completed);
        assert!(!sprint.can_accept_stories());
    }

    #[test]
    fn test_invalid_status_transitions_fail() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let mut sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Test goal".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        // Cannot move to review from planning
        assert!(sprint.move_to_review().is_err());

        // Cannot complete from planning
        assert!(sprint.complete().is_err());

        sprint.start().unwrap();

        // Cannot start again
        assert!(sprint.start().is_err());

        // Cannot complete from active (must go through review)
        assert!(sprint.complete().is_err());
    }

    #[test]
    fn test_story_points_management() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let mut sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Test goal".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        // Commit story points
        sprint.commit_story_points(20).unwrap();
        assert_eq!(sprint.committed_points, 20);
        assert_eq!(sprint.available_capacity(), 20);

        // Cannot overcommit
        assert!(sprint.commit_story_points(25).is_err());

        // Can commit up to capacity
        sprint.commit_story_points(20).unwrap();
        assert_eq!(sprint.committed_points, 40);
        assert_eq!(sprint.available_capacity(), 0);

        // Start sprint and complete some points
        sprint.start().unwrap();
        sprint.complete_story_points(15).unwrap();
        assert_eq!(sprint.completed_points, 15);
        assert_eq!(sprint.completion_percentage(), 37.5);

        // Cannot complete more than committed
        assert!(sprint.complete_story_points(30).is_err());

        // Remove committed points
        sprint.remove_committed_points(10).unwrap();
        assert_eq!(sprint.committed_points, 30);
    }

    #[test]
    fn test_cannot_modify_completed_sprint() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let mut sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Test goal".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        sprint.start().unwrap();
        sprint.move_to_review().unwrap();
        sprint.complete().unwrap();

        // Cannot commit points to completed sprint
        assert!(sprint.commit_story_points(10).is_err());
    }

    #[test]
    fn test_can_only_complete_points_in_active_sprint() {
        let team_id = Uuid::new_v4();
        let start_date = Utc::now();
        let end_date = start_date + Duration::weeks(2);

        let mut sprint = Sprint::new(
            team_id,
            "Sprint 1".to_string(),
            "Test goal".to_string(),
            40,
            start_date,
            end_date,
        )
        .unwrap();

        sprint.commit_story_points(20).unwrap();

        // Cannot complete points in planning status
        assert!(sprint.complete_story_points(10).is_err());

        sprint.start().unwrap();

        // Can complete points in active status
        sprint.complete_story_points(10).unwrap();
        assert_eq!(sprint.completed_points, 10);
    }
}
