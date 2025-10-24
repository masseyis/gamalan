use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;

/// Opinionated agile workflow statuses that enforce best practices
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StoryStatus {
    /// Story is drafted but not refined yet
    Draft,
    /// Story needs refinement (missing ACs, too large, unclear requirements)
    NeedsRefinement,
    /// Story is refined and ready for sprint planning
    Ready,
    /// Story is committed to a sprint
    Committed,
    /// Story is actively being worked on
    InProgress,
    /// All tasks for the story are complete
    TasksComplete,
    /// Story is deployed to production
    Deployed,
    /// Story is awaiting acceptance from product owner
    AwaitingAcceptance,
    /// Story is accepted and considered complete
    Accepted,
}

impl StoryStatus {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().replace('_', "").as_str() {
            "draft" => Some(Self::Draft),
            "needsrefinement" => Some(Self::NeedsRefinement),
            "ready" => Some(Self::Ready),
            "committed" => Some(Self::Committed),
            "inprogress" => Some(Self::InProgress),
            "taskscomplete" => Some(Self::TasksComplete),
            "deployed" => Some(Self::Deployed),
            "awaitingacceptance" => Some(Self::AwaitingAcceptance),
            "accepted" => Some(Self::Accepted),
            _ => None,
        }
    }

    /// Get the next valid statuses that this status can transition to
    pub fn valid_transitions(&self) -> Vec<StoryStatus> {
        match self {
            Self::Draft => vec![Self::NeedsRefinement, Self::Ready],
            Self::NeedsRefinement => vec![Self::Ready, Self::Draft],
            Self::Ready => vec![Self::Committed, Self::NeedsRefinement],
            Self::Committed => vec![Self::InProgress, Self::Ready],
            Self::InProgress => vec![Self::TasksComplete, Self::Committed],
            Self::TasksComplete => vec![Self::Deployed, Self::InProgress],
            Self::Deployed => vec![Self::AwaitingAcceptance, Self::TasksComplete],
            Self::AwaitingAcceptance => vec![Self::Accepted, Self::InProgress],
            Self::Accepted => vec![], // Terminal state
        }
    }

    /// Check if this status can transition to another status
    pub fn can_transition_to(&self, target: &StoryStatus) -> bool {
        self.valid_transitions().contains(target)
    }

    /// Check if story is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Accepted)
    }

    /// Check if story is ready for sprint commitment
    pub fn is_ready_for_sprint(&self) -> bool {
        matches!(self, Self::Ready)
    }

    /// Check if story is actively being worked on
    pub fn is_active(&self) -> bool {
        matches!(
            self,
            Self::InProgress | Self::TasksComplete | Self::Deployed
        )
    }

    /// Check if story requires product owner attention
    pub fn requires_po_attention(&self) -> bool {
        matches!(self, Self::NeedsRefinement | Self::AwaitingAcceptance)
    }
}

impl std::fmt::Display for StoryStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Draft => write!(f, "draft"),
            Self::NeedsRefinement => write!(f, "needsrefinement"),
            Self::Ready => write!(f, "ready"),
            Self::Committed => write!(f, "committed"),
            Self::InProgress => write!(f, "inprogress"),
            Self::TasksComplete => write!(f, "taskscomplete"),
            Self::Deployed => write!(f, "deployed"),
            Self::AwaitingAcceptance => write!(f, "awaitingacceptance"),
            Self::Accepted => write!(f, "accepted"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcceptanceCriteria {
    pub id: Uuid,
    pub description: String,
    pub given: String, // Given context
    pub when: String,  // When action
    pub then: String,  // Then outcome
    pub created_at: DateTime<Utc>,
}

impl AcceptanceCriteria {
    pub fn new(
        description: String,
        given: String,
        when: String,
        then: String,
    ) -> Result<Self, AppError> {
        if description.trim().is_empty() {
            return Err(AppError::BadRequest(
                "AC description cannot be empty".to_string(),
            ));
        }
        if given.trim().is_empty() {
            return Err(AppError::BadRequest(
                "AC 'given' cannot be empty".to_string(),
            ));
        }
        if when.trim().is_empty() {
            return Err(AppError::BadRequest(
                "AC 'when' cannot be empty".to_string(),
            ));
        }
        if then.trim().is_empty() {
            return Err(AppError::BadRequest(
                "AC 'then' cannot be empty".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            description: description.trim().to_string(),
            given: given.trim().to_string(),
            when: when.trim().to_string(),
            then: then.trim().to_string(),
            created_at: Utc::now(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: Uuid,
    pub project_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: StoryStatus,
    pub labels: Vec<String>,
    pub acceptance_criteria: Vec<AcceptanceCriteria>,
    pub story_points: Option<u32>,
    pub sprint_id: Option<Uuid>,
    pub assigned_to_user_id: Option<Uuid>, // Product Owner or Managing Contributor who owns this story
    pub readiness_override: bool,
    pub readiness_override_by: Option<Uuid>,
    pub readiness_override_reason: Option<String>,
    pub readiness_override_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Story {
    pub fn new(
        project_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
    ) -> Result<Self, AppError> {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Story title cannot be empty".to_string(),
            ));
        }

        if title.trim().len() > 255 {
            return Err(AppError::BadRequest(
                "Story title cannot exceed 255 characters".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            project_id,
            organization_id,
            title: title.trim().to_string(),
            description,
            status: StoryStatus::Draft,
            labels: Vec::new(),
            acceptance_criteria: Vec::new(),
            story_points: None,
            sprint_id: None,
            assigned_to_user_id: None,
            readiness_override: false,
            readiness_override_by: None,
            readiness_override_reason: None,
            readiness_override_at: None,
            created_at: now,
            updated_at: now,
        })
    }

    /// Update story status with opinionated workflow validation
    pub fn update_status(&mut self, new_status: StoryStatus) -> Result<(), AppError> {
        if !self.status.can_transition_to(&new_status) {
            return Err(AppError::BadRequest(format!(
                "Cannot transition from {} to {}. Valid transitions: {:?}",
                self.status,
                new_status,
                self.status.valid_transitions()
            )));
        }

        // Enforce readiness checks before certain transitions
        match new_status {
            StoryStatus::Ready => {
                if !self.readiness_override {
                    self.validate_ready_requirements()?;
                }
            }
            StoryStatus::Committed => {
                if self.sprint_id.is_none() {
                    return Err(AppError::BadRequest(
                        "Story must be assigned to a sprint before being committed".to_string(),
                    ));
                }
            }
            _ => {}
        }

        self.status = new_status;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Validate that story meets requirements to be marked as Ready
    fn validate_ready_requirements(&self) -> Result<(), AppError> {
        // Must have at least 3 acceptance criteria
        if self.acceptance_criteria.len() < 3 {
            return Err(AppError::BadRequest(format!(
                "Story must have at least 3 acceptance criteria. Currently has: {}",
                self.acceptance_criteria.len()
            )));
        }

        // Must have story points
        if self.story_points.is_none() {
            return Err(AppError::BadRequest(
                "Story must have story points to be ready".to_string(),
            ));
        }

        // Story points must be <= 8 (opinionated maximum)
        if let Some(points) = self.story_points {
            if points > 8 {
                return Err(AppError::BadRequest(format!(
                    "Story points cannot exceed 8. Current: {}",
                    points
                )));
            }
            if points == 0 {
                return Err(AppError::BadRequest(
                    "Story points must be greater than 0".to_string(),
                ));
            }
        }

        // Must have a description
        if self.description.is_none() || self.description.as_ref().unwrap().trim().is_empty() {
            return Err(AppError::BadRequest(
                "Story must have a description to be ready".to_string(),
            ));
        }

        Ok(())
    }

    pub fn apply_readiness_override(&mut self, user_id: Uuid, reason: Option<String>) {
        self.readiness_override = true;
        self.readiness_override_by = Some(user_id);
        self.readiness_override_reason = reason.and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        });
        self.readiness_override_at = Some(Utc::now());
        self.status = StoryStatus::Ready;
        self.updated_at = Utc::now();
    }

    pub fn clear_readiness_override(&mut self) {
        self.readiness_override = false;
        self.readiness_override_by = None;
        self.readiness_override_reason = None;
        self.readiness_override_at = None;
        self.updated_at = Utc::now();
    }

    /// Clears the readiness override with logging to track when and why it was cleared
    pub fn clear_readiness_override_with_logging(&mut self, reason: &str) {
        let previous_reason = self.readiness_override_reason.clone();
        let override_by = self.readiness_override_by;
        
        info!(
            story_id = %self.id,
            previous_override_reason = ?previous_reason,
            override_by = ?override_by,
            clear_reason = %reason,
            "Readiness override cleared for story"
        );
        
        self.clear_readiness_override();
    }

    /// Add acceptance criteria to the story
    pub fn add_acceptance_criteria(&mut self, ac: AcceptanceCriteria) {
        self.acceptance_criteria.push(ac);
        self.updated_at = Utc::now();
    }

    /// Remove acceptance criteria by ID
    pub fn remove_acceptance_criteria(&mut self, ac_id: Uuid) -> Result<(), AppError> {
        let initial_len = self.acceptance_criteria.len();
        self.acceptance_criteria.retain(|ac| ac.id != ac_id);

        if self.acceptance_criteria.len() == initial_len {
            return Err(AppError::NotFound(
                "Acceptance criteria not found".to_string(),
            ));
        }

        self.updated_at = Utc::now();
        Ok(())
    }

    /// Set story points (with validation)
    pub fn set_story_points(&mut self, points: u32) -> Result<(), AppError> {
        if points == 0 {
            return Err(AppError::BadRequest(
                "Story points must be greater than 0".to_string(),
            ));
        }
        if points > 8 {
            return Err(AppError::BadRequest(
                "Story points cannot exceed 8 (split larger stories)".to_string(),
            ));
        }

        self.story_points = Some(points);
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Assign story to a sprint (only allowed for Ready stories)
    pub fn assign_to_sprint(&mut self, sprint_id: Uuid) -> Result<(), AppError> {
        if !self.status.is_ready_for_sprint() {
            return Err(AppError::BadRequest(
                "Only Ready stories can be assigned to sprints".to_string(),
            ));
        }

        self.sprint_id = Some(sprint_id);
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Remove story from sprint
    pub fn remove_from_sprint(&mut self) -> Result<(), AppError> {
        if self.status == StoryStatus::InProgress {
            return Err(AppError::BadRequest(
                "Cannot remove story from sprint while in progress".to_string(),
            ));
        }

        self.sprint_id = None;

        // If story was committed, move it back to a valid non-sprint state.
        // Validate readiness first; if not ready, send it to NeedsRefinement
        if self.status == StoryStatus::Committed {
            let meets_ready_requirements =
                self.readiness_override || self.validate_ready_requirements().is_ok();

            if meets_ready_requirements {
                // Use normal transition path to enforce invariants
                self.update_status(StoryStatus::Ready)?;
            } else {
                // Special-case downgrade when removing from sprint
                self.status = StoryStatus::NeedsRefinement;
            }
        }

        self.updated_at = Utc::now();
        Ok(())
    }

    /// Assign story to a user (Product Owner or Managing Contributor)
    pub fn assign_to_user(&mut self, user_id: Uuid) {
        self.assigned_to_user_id = Some(user_id);
        self.updated_at = Utc::now();
    }

    /// Remove user assignment
    pub fn unassign_user(&mut self) {
        self.assigned_to_user_id = None;
        self.updated_at = Utc::now();
    }

    /// Add a label to the story
    pub fn add_label(&mut self, label: String) {
        if !self.labels.contains(&label) {
            self.labels.push(label);
            self.updated_at = Utc::now();
        }
    }

    /// Remove a label from the story
    pub fn remove_label(&mut self, label: &str) {
        let initial_len = self.labels.len();
        self.labels.retain(|l| l != label);

        if self.labels.len() < initial_len {
            self.updated_at = Utc::now();
        }
    }

    /// Check if story is blocked (needs refinement or awaiting acceptance)
    pub fn is_blocked(&self) -> bool {
        self.status.requires_po_attention()
    }

    /// Check if story can be worked on
    pub fn can_be_worked_on(&self) -> bool {
        matches!(self.status, StoryStatus::InProgress)
    }

    /// Get estimated effort
    pub fn estimated_effort(&self) -> u32 {
        self.story_points.unwrap_or(0)
    }

    /// Update story fields (for backwards compatibility with tests)
    pub fn update(
        &mut self,
        title: Option<String>,
        description: Option<Option<String>>,
        labels: Option<Vec<String>>,
        story_points: Option<u32>,
    ) -> Result<(), AppError> {
        if let Some(new_title) = title {
            if new_title.trim().is_empty() {
                return Err(AppError::BadRequest(
                    "Story title cannot be empty".to_string(),
                ));
            }
            if new_title.trim().len() > 255 {
                return Err(AppError::BadRequest(
                    "Story title cannot exceed 255 characters".to_string(),
                ));
            }
            self.title = new_title.trim().to_string();
        }

        if let Some(new_description) = description {
            self.description = new_description;
        }

        if let Some(new_labels) = labels {
            self.labels = new_labels;
        }

        if let Some(points) = story_points {
            self.set_story_points(points)?;
        }

        if self.readiness_override && self.validate_ready_requirements().is_ok() {
            self.clear_readiness_override_with_logging("Story now meets ready requirements");
        }

        self.updated_at = Utc::now();
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateStoryRequest {
    pub project_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateStoryRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub story_points: Option<u32>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAcceptanceCriteriaRequest {
    pub description: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_story() -> Story {
        Story::new(
            Uuid::new_v4(),
            Some(Uuid::new_v4()),
            "Test Story".to_string(),
            Some("Test description".to_string()),
        )
        .unwrap()
    }

    fn create_test_ac() -> AcceptanceCriteria {
        AcceptanceCriteria::new(
            "User can login".to_string(),
            "a user with valid credentials".to_string(),
            "they attempt to login".to_string(),
            "they should be authenticated".to_string(),
        )
        .unwrap()
    }

    #[test]
    fn test_create_story_with_valid_data() {
        let project_id = Uuid::new_v4();
        let org_id = Uuid::new_v4();

        let story = Story::new(
            project_id,
            Some(org_id),
            "Test Story".to_string(),
            Some("Test description".to_string()),
        )
        .unwrap();

        assert_eq!(story.project_id, project_id);
        assert_eq!(story.organization_id, Some(org_id));
        assert_eq!(story.title, "Test Story");
        assert_eq!(story.description, Some("Test description".to_string()));
        assert_eq!(story.status, StoryStatus::Draft);
        assert!(story.labels.is_empty());
        assert!(story.acceptance_criteria.is_empty());
        assert!(story.story_points.is_none());
        assert!(story.sprint_id.is_none());
    }

    #[test]
    fn test_create_story_with_empty_title_fails() {
        let project_id = Uuid::new_v4();

        let result = Story::new(
            project_id,
            None,
            "".to_string(),
            Some("Test description".to_string()),
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Story title cannot be empty"));
    }

    #[test]
    fn test_story_status_transitions() {
        let mut story = create_test_story();

        // Draft -> NeedsRefinement
        story.update_status(StoryStatus::NeedsRefinement).unwrap();
        assert_eq!(story.status, StoryStatus::NeedsRefinement);

        // NeedsRefinement -> Draft (back and forth allowed)
        story.update_status(StoryStatus::Draft).unwrap();
        assert_eq!(story.status, StoryStatus::Draft);

        // Invalid transition should fail
        assert!(story.update_status(StoryStatus::InProgress).is_err());
    }

    #[test]
    fn test_story_ready_requirements() {
        let mut story = create_test_story();

        // Should fail - no ACs, no points, no description requirements met
        story.description = None;
        assert!(story.update_status(StoryStatus::Ready).is_err());

        // Add description
        story.description = Some("Proper description".to_string());

        // Should still fail - no ACs, no points
        assert!(story.update_status(StoryStatus::Ready).is_err());

        // Add story points
        story.set_story_points(5).unwrap();

        // Should still fail - not enough ACs
        assert!(story.update_status(StoryStatus::Ready).is_err());

        // Add 3 acceptance criteria
        for i in 0..3 {
            let ac = AcceptanceCriteria::new(
                format!("AC {}", i + 1),
                format!("given {}", i + 1),
                format!("when {}", i + 1),
                format!("then {}", i + 1),
            )
            .unwrap();
            story.add_acceptance_criteria(ac);
        }

        // Should now succeed
        story.update_status(StoryStatus::Ready).unwrap();
        assert_eq!(story.status, StoryStatus::Ready);
    }

    #[test]
    fn test_story_points_validation() {
        let mut story = create_test_story();

        // Zero points should fail
        assert!(story.set_story_points(0).is_err());

        // Points > 8 should fail
        assert!(story.set_story_points(13).is_err());

        // Valid points should succeed
        story.set_story_points(5).unwrap();
        assert_eq!(story.story_points, Some(5));

        // Edge case: exactly 8 should be allowed
        story.set_story_points(8).unwrap();
        assert_eq!(story.story_points, Some(8));
    }

    #[test]
    fn test_acceptance_criteria_management() {
        let mut story = create_test_story();

        let ac1 = create_test_ac();
        let ac1_id = ac1.id;
        story.add_acceptance_criteria(ac1);

        assert_eq!(story.acceptance_criteria.len(), 1);

        let ac2 = AcceptanceCriteria::new(
            "Second AC".to_string(),
            "given something else".to_string(),
            "when something happens".to_string(),
            "then outcome occurs".to_string(),
        )
        .unwrap();
        story.add_acceptance_criteria(ac2);

        assert_eq!(story.acceptance_criteria.len(), 2);

        // Remove first AC
        story.remove_acceptance_criteria(ac1_id).unwrap();
        assert_eq!(story.acceptance_criteria.len(), 1);

        // Try to remove non-existent AC
        assert!(story.remove_acceptance_criteria(Uuid::new_v4()).is_err());
    }

    #[test]
    fn test_sprint_assignment() {
        let mut story = create_test_story();
        let sprint_id = Uuid::new_v4();

        // Cannot assign draft story to sprint
        assert!(story.assign_to_sprint(sprint_id).is_err());

        // Make story ready
        story.description = Some("Proper description".to_string());
        story.set_story_points(5).unwrap();
        for i in 0..3 {
            let ac = AcceptanceCriteria::new(
                format!("AC {}", i + 1),
                format!("given {}", i + 1),
                format!("when {}", i + 1),
                format!("then {}", i + 1),
            )
            .unwrap();
            story.add_acceptance_criteria(ac);
        }
        story.update_status(StoryStatus::Ready).unwrap();

        // Now can assign to sprint
        story.assign_to_sprint(sprint_id).unwrap();
        assert_eq!(story.sprint_id, Some(sprint_id));

        // Can commit story with sprint assigned
        story.update_status(StoryStatus::Committed).unwrap();

        // Cannot remove from sprint while in progress
        story.update_status(StoryStatus::InProgress).unwrap();
        assert!(story.remove_from_sprint().is_err());

        // Can remove after going back to committed
        story.update_status(StoryStatus::Committed).unwrap();
        story.remove_from_sprint().unwrap();
        assert!(story.sprint_id.is_none());
        assert_eq!(story.status, StoryStatus::Ready);
    }

    #[test]
    fn test_remove_from_sprint_downgrades_if_no_longer_ready() {
        let mut story = create_test_story();

        // Make story ready
        story.description = Some("Proper description".to_string());
        story.set_story_points(5).unwrap();
        for i in 0..3 {
            let ac = AcceptanceCriteria::new(
                format!("AC {}", i + 1),
                format!("given {}", i + 1),
                format!("when {}", i + 1),
                format!("then {}", i + 1),
            )
            .unwrap();
            story.add_acceptance_criteria(ac);
        }
        story.update_status(StoryStatus::Ready).unwrap();

        // Assign to sprint and commit
        let sprint_id = Uuid::new_v4();
        story.assign_to_sprint(sprint_id).unwrap();
        story.update_status(StoryStatus::Committed).unwrap();

        // Break ready requirements while still committed
        story.description = None;

        // Removing from sprint should now downgrade to NeedsRefinement
        story.remove_from_sprint().unwrap();
        assert!(story.sprint_id.is_none());
        assert_eq!(story.status, StoryStatus::NeedsRefinement);
    }

    #[test]
    fn test_status_helper_methods() {
        let _story = create_test_story();

        // Test various status checks
        assert!(!StoryStatus::Draft.is_terminal());
        assert!(StoryStatus::Accepted.is_terminal());

        assert!(StoryStatus::Ready.is_ready_for_sprint());
        assert!(!StoryStatus::Draft.is_ready_for_sprint());

        assert!(StoryStatus::InProgress.is_active());
        assert!(StoryStatus::TasksComplete.is_active());
        assert!(!StoryStatus::Draft.is_active());

        assert!(StoryStatus::NeedsRefinement.requires_po_attention());
        assert!(StoryStatus::AwaitingAcceptance.requires_po_attention());
        assert!(!StoryStatus::InProgress.requires_po_attention());
    }

    #[test]
    fn test_create_acceptance_criteria() {
        let ac = AcceptanceCriteria::new(
            "User login test".to_string(),
            "a user with valid credentials".to_string(),
            "they attempt to login".to_string(),
            "they should be authenticated".to_string(),
        )
        .unwrap();

        assert_eq!(ac.description, "User login test");
        assert_eq!(ac.given, "a user with valid credentials");
        assert_eq!(ac.when, "they attempt to login");
        assert_eq!(ac.then, "they should be authenticated");
    }

    #[test]
    fn test_create_acceptance_criteria_with_empty_fields_fails() {
        // Empty description
        assert!(AcceptanceCriteria::new(
            "".to_string(),
            "given".to_string(),
            "when".to_string(),
            "then".to_string()
        )
        .is_err());

        // Empty given
        assert!(AcceptanceCriteria::new(
            "desc".to_string(),
            "".to_string(),
            "when".to_string(),
            "then".to_string()
        )
        .is_err());

        // Empty when
        assert!(AcceptanceCriteria::new(
            "desc".to_string(),
            "given".to_string(),
            "".to_string(),
            "then".to_string()
        )
        .is_err());

        // Empty then
        assert!(AcceptanceCriteria::new(
            "desc".to_string(),
            "given".to_string(),
            "when".to_string(),
            "".to_string()
        )
        .is_err());
    }

    #[test]
    fn test_story_workflow_end_to_end() {
        let mut story = create_test_story();

        // Start as Draft
        assert_eq!(story.status, StoryStatus::Draft);

        // Move to needs refinement
        story.update_status(StoryStatus::NeedsRefinement).unwrap();

        // Add proper requirements to make it ready
        story.description = Some("Comprehensive description of the feature".to_string());
        story.set_story_points(3).unwrap();

        // Add 3 acceptance criteria
        for i in 0..3 {
            let ac = AcceptanceCriteria::new(
                format!("Acceptance Criteria {}", i + 1),
                format!("given specific context {}", i + 1),
                format!("when user performs action {}", i + 1),
                format!("then expected outcome {}", i + 1),
            )
            .unwrap();
            story.add_acceptance_criteria(ac);
        }

        // Move to ready
        story.update_status(StoryStatus::Ready).unwrap();

        // Assign to sprint and commit
        let sprint_id = Uuid::new_v4();
        story.assign_to_sprint(sprint_id).unwrap();
        story.update_status(StoryStatus::Committed).unwrap();

        // Start work
        story.update_status(StoryStatus::InProgress).unwrap();

        // Complete tasks
        story.update_status(StoryStatus::TasksComplete).unwrap();

        // Deploy
        story.update_status(StoryStatus::Deployed).unwrap();

        // Await acceptance
        story
            .update_status(StoryStatus::AwaitingAcceptance)
            .unwrap();

        // Accept story
        story.update_status(StoryStatus::Accepted).unwrap();

        // Cannot transition from accepted (terminal state)
        assert!(story.update_status(StoryStatus::InProgress).is_err());
    }

    #[test]
    fn test_label_management() {
        let mut story = create_test_story();

        story.add_label("bug".to_string());
        story.add_label("urgent".to_string());
        assert_eq!(story.labels.len(), 2);

        // Adding duplicate label shouldn't increase count
        story.add_label("bug".to_string());
        assert_eq!(story.labels.len(), 2);

        story.remove_label("bug");
        assert_eq!(story.labels.len(), 1);
        assert!(story.labels.contains(&"urgent".to_string()));

        // Removing non-existent label is safe
        story.remove_label("nonexistent");
        assert_eq!(story.labels.len(), 1);
    }

    #[test]
    fn test_user_assignment() {
        let mut story = create_test_story();
        let user_id = Uuid::new_v4();

        story.assign_to_user(user_id);
        assert_eq!(story.assigned_to_user_id, Some(user_id));

        story.unassign_user();
        assert!(story.assigned_to_user_id.is_none());
    }
}
