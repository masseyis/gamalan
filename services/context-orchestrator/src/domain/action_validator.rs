use crate::domain::{ActionCommand, ActionType, CandidateEntity, RiskLevel};
use common::AppError;

pub struct ActionValidator;

impl ActionValidator {
    pub fn validate_action(
        action: &ActionCommand,
        candidates: &[CandidateEntity],
    ) -> Result<(), AppError> {
        // Basic validation
        action.validate()?;

        // Validate tenant isolation
        Self::validate_tenant_isolation(action, candidates)?;

        // Validate entity existence in candidates
        Self::validate_entity_references(action, candidates)?;

        // Validate action type compatibility with entities
        Self::validate_action_compatibility(action, candidates)?;

        // Validate parameters
        Self::validate_parameters(action)?;

        Ok(())
    }

    pub fn requires_confirmation(action: &ActionCommand) -> bool {
        // All destructive or state-changing operations require confirmation
        match action.action_type {
            ActionType::Archive => true,
            ActionType::UpdateStatus => true,
            ActionType::MoveToSprint => true,
            ActionType::CreateTask => false, // Creation is less risky
            ActionType::CreateStory => false,
            ActionType::AssignUser => false,
            ActionType::UpdatePriority => false,
            ActionType::AddComment => false,
        }
    }

    pub fn estimate_risk_level(action: &ActionCommand) -> RiskLevel {
        match action.action_type {
            ActionType::Archive => RiskLevel::High,
            ActionType::MoveToSprint => RiskLevel::Medium,
            ActionType::UpdateStatus => RiskLevel::Low,
            ActionType::CreateTask => RiskLevel::Low,
            ActionType::CreateStory => RiskLevel::Low,
            ActionType::AssignUser => RiskLevel::Low,
            ActionType::UpdatePriority => RiskLevel::Low,
            ActionType::AddComment => RiskLevel::Low,
        }
    }

    pub fn validate_permissions(
        action: &ActionCommand,
        user_permissions: &UserPermissions,
    ) -> Result<(), AppError> {
        match action.action_type {
            ActionType::Archive => {
                if !user_permissions.can_delete_stories {
                    return Err(AppError::Unauthorized(
                        "Insufficient permissions to delete stories".to_string(),
                    ));
                }
            }
            ActionType::UpdateStatus => {
                if !user_permissions.can_update_stories {
                    return Err(AppError::Unauthorized(
                        "Insufficient permissions to update stories".to_string(),
                    ));
                }
            }
            ActionType::CreateTask => {
                if !user_permissions.can_create_tasks {
                    return Err(AppError::Unauthorized(
                        "Insufficient permissions to create tasks".to_string(),
                    ));
                }
            }
            ActionType::MoveToSprint => {
                if !user_permissions.can_update_tasks {
                    return Err(AppError::Unauthorized(
                        "Insufficient permissions to move tasks".to_string(),
                    ));
                }
            }
            ActionType::AssignUser
            | ActionType::UpdatePriority
            | ActionType::AddComment
            | ActionType::CreateStory => {
                // These actions have basic permissions, no specific check needed
            }
        }
        Ok(())
    }

    fn validate_tenant_isolation(
        action: &ActionCommand,
        candidates: &[CandidateEntity],
    ) -> Result<(), AppError> {
        // Skip tenant isolation for create actions that don't require target entities
        if matches!(
            action.action_type,
            ActionType::CreateTask | ActionType::CreateStory
        ) {
            return Ok(());
        }

        // Validate that all candidates belong to the same tenant
        if let Some(first_candidate) = candidates.first() {
            let expected_tenant_id = first_candidate.tenant_id;
            for candidate in candidates {
                if candidate.tenant_id != expected_tenant_id {
                    return Err(AppError::BadRequest(
                        "Tenant isolation violation in candidates".to_string(),
                    ));
                }
            }
        }

        // For tenant isolation, we return "Entity not found" to avoid revealing tenant information
        for entity_id in &action.target_entities {
            let _candidate = candidates
                .iter()
                .find(|c| c.id == *entity_id)
                .ok_or_else(|| AppError::NotFound("Entity not found".to_string()))?;
        }
        Ok(())
    }

    fn validate_entity_references(
        action: &ActionCommand,
        candidates: &[CandidateEntity],
    ) -> Result<(), AppError> {
        // Create actions don't require target entities
        if matches!(
            action.action_type,
            ActionType::CreateTask | ActionType::CreateStory
        ) {
            return Ok(());
        }

        // Check for empty target entities for non-create actions
        if action.target_entities.is_empty() {
            return Err(AppError::BadRequest(
                "No target entities specified".to_string(),
            ));
        }

        // Ensure all target entities exist in the candidate set
        for entity_id in &action.target_entities {
            if !candidates.iter().any(|c| c.id == *entity_id) {
                return Err(AppError::NotFound("Entity not found".to_string()));
            }
        }
        Ok(())
    }

    fn validate_action_compatibility(
        action: &ActionCommand,
        candidates: &[CandidateEntity],
    ) -> Result<(), AppError> {
        match action.action_type {
            ActionType::UpdateStatus => {
                // Can only update status of stories
                for entity_id in &action.target_entities {
                    let candidate = candidates.iter().find(|c| c.id == *entity_id).unwrap(); // Safe because we validated existence above

                    if candidate.entity_type != "story" {
                        return Err(AppError::BadRequest(
                            "Can only update status of stories".to_string(),
                        ));
                    }
                }
            }
            ActionType::CreateTask => {
                // Create actions can work with empty target entities
                if !action.target_entities.is_empty() {
                    // When creating a task with a target, target should be a story
                    if action.target_entities.len() != 1 {
                        return Err(AppError::BadRequest(
                            "Creating task requires exactly one target story".to_string(),
                        ));
                    }

                    let candidate = candidates
                        .iter()
                        .find(|c| c.id == action.target_entities[0])
                        .unwrap();

                    if candidate.entity_type != "story" {
                        return Err(AppError::BadRequest(
                            "Can only create tasks for stories".to_string(),
                        ));
                    }
                }
            }
            ActionType::Archive => {
                // Can only archive stories
                for entity_id in &action.target_entities {
                    let candidate = candidates.iter().find(|c| c.id == *entity_id).unwrap();

                    if candidate.entity_type != "story" {
                        return Err(AppError::BadRequest("Can only archive stories".to_string()));
                    }
                }
            }
            ActionType::MoveToSprint => {
                // Can move stories to sprint
                for entity_id in &action.target_entities {
                    let candidate = candidates.iter().find(|c| c.id == *entity_id).unwrap();

                    if candidate.entity_type != "story" && candidate.entity_type != "task" {
                        return Err(AppError::BadRequest(
                            "Can only move stories or tasks to sprint".to_string(),
                        ));
                    }
                }
            }
            ActionType::AssignUser => {
                // Can only assign users to tasks
                for entity_id in &action.target_entities {
                    let candidate = candidates.iter().find(|c| c.id == *entity_id).unwrap(); // Safe because we validated existence above

                    if candidate.entity_type != "task" {
                        return Err(AppError::BadRequest(
                            "Can only assign users to tasks".to_string(),
                        ));
                    }
                }
            }
            ActionType::UpdatePriority | ActionType::AddComment | ActionType::CreateStory => {
                // These actions don't have specific entity type requirements
            }
        }

        Ok(())
    }

    fn validate_parameters(action: &ActionCommand) -> Result<(), AppError> {
        match action.action_type {
            ActionType::UpdateStatus => {
                let new_status = action
                    .parameters
                    .get("new_status")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        AppError::BadRequest("new_status parameter required".to_string())
                    })?;

                match new_status {
                    "Ready" | "InProgress" | "InReview" | "Done" => Ok(()),
                    _ => Err(AppError::BadRequest("Invalid story status".to_string())),
                }
            }
            ActionType::AssignUser => {
                action
                    .parameters
                    .get("user_id")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        AppError::BadRequest("user_id parameter required".to_string())
                    })?;
                Ok(())
            }
            ActionType::UpdatePriority => {
                let priority = action
                    .parameters
                    .get("priority")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| {
                        AppError::BadRequest("priority parameter required".to_string())
                    })?;

                if !(1..=5).contains(&priority) {
                    return Err(AppError::BadRequest(
                        "Priority must be between 1 and 5".to_string(),
                    ));
                }
                Ok(())
            }
            ActionType::AddComment => {
                action
                    .parameters
                    .get("comment")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        AppError::BadRequest("comment parameter required".to_string())
                    })?;
                Ok(())
            }
            ActionType::CreateTask => {
                let title = action
                    .parameters
                    .get("title")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AppError::BadRequest("Missing title parameter".to_string()))?;

                if title.trim().is_empty() {
                    return Err(AppError::BadRequest(
                        "Task title cannot be empty".to_string(),
                    ));
                }

                if title.len() > 200 {
                    return Err(AppError::BadRequest(
                        "Task title too long (max 200 characters)".to_string(),
                    ));
                }

                Ok(())
            }
            ActionType::Archive => {
                // No additional parameters needed for archiving
                Ok(())
            }
            ActionType::MoveToSprint => {
                // No additional parameters needed for moving to sprint
                Ok(())
            }
            ActionType::CreateStory => {
                // These actions may have optional parameters, no strict validation needed
                Ok(())
            }
        }
    }
}

// Module-level convenience function
pub fn validate_action(
    action: &ActionCommand,
    candidates: &[CandidateEntity],
) -> Result<(), AppError> {
    ActionValidator::validate_action(action, candidates)
}

#[derive(Debug, Clone)]
pub struct UserPermissions {
    pub can_delete_stories: bool,
    pub can_update_stories: bool,
    pub can_create_tasks: bool,
    pub can_update_tasks: bool,
    pub can_generate_packs: bool,
}

impl Default for UserPermissions {
    fn default() -> Self {
        Self {
            can_delete_stories: false, // Restrictive by default
            can_update_stories: true,
            can_create_tasks: true,
            can_update_tasks: true,
            can_generate_packs: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::EntityType;
    use uuid::Uuid;

    fn create_test_candidate(
        id: Uuid,
        entity_type: EntityType,
        tenant_id: Uuid,
    ) -> CandidateEntity {
        CandidateEntity {
            id,
            tenant_id,
            entity_type: entity_type.to_string(),
            title: "Test Entity".to_string(),
            description: Some("Test description".to_string()),
            status: Some("Ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: std::collections::HashMap::new(),
            similarity_score: 0.8,
            last_updated: chrono::Utc::now(),
            created_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_validate_action_success() {
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity_id],
            parameters: [("new_status".to_string(), serde_json::json!("Ready"))]
                .into_iter()
                .collect(),
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let candidates = vec![create_test_candidate(
            entity_id,
            EntityType::Story,
            tenant_id,
        )];

        assert!(ActionValidator::validate_action(&action, &candidates).is_ok());
    }

    #[test]
    fn test_validate_tenant_isolation_violation() {
        let tenant1 = Uuid::new_v4();
        let tenant2 = Uuid::new_v4();
        let entity1_id = Uuid::new_v4();
        let entity2_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity1_id],
            parameters: [("new_status".to_string(), serde_json::json!("Ready"))]
                .into_iter()
                .collect(),
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let candidates = vec![
            create_test_candidate(entity1_id, EntityType::Story, tenant1), // Entity from tenant1
            create_test_candidate(entity2_id, EntityType::Story, tenant2), // Entity from tenant2 - isolation violation
        ];

        let result = ActionValidator::validate_action(&action, &candidates);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Tenant isolation violation"));
    }

    #[test]
    fn test_validate_entity_not_in_candidates() {
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();
        let other_entity_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity_id],
            parameters: [("new_status".to_string(), serde_json::json!("Ready"))]
                .into_iter()
                .collect(),
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let candidates = vec![
            create_test_candidate(other_entity_id, EntityType::Story, tenant_id), // Different entity
        ];

        let result = ActionValidator::validate_action(&action, &candidates);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Entity not found in candidates"));
    }

    #[test]
    fn test_validate_action_type_compatibility() {
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity_id],
            parameters: [("new_status".to_string(), serde_json::json!("Ready"))]
                .into_iter()
                .collect(),
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let candidates = vec![
            create_test_candidate(entity_id, EntityType::Task, tenant_id), // Task, not Story
        ];

        let result = ActionValidator::validate_action(&action, &candidates);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Can only update status of stories"));
    }

    #[test]
    fn test_requires_confirmation() {
        let action = ActionCommand {
            action_type: ActionType::Archive,
            target_entities: vec![Uuid::new_v4()],
            parameters: std::collections::HashMap::new(),
            require_confirmation: true,
            risk_level: RiskLevel::High,
        };

        assert!(ActionValidator::requires_confirmation(&action));
    }

    #[test]
    fn test_estimate_risk_level() {
        let delete_action = ActionCommand {
            action_type: ActionType::Archive,
            target_entities: vec![Uuid::new_v4()],
            parameters: std::collections::HashMap::new(),
            require_confirmation: true,
            risk_level: RiskLevel::High,
        };

        assert_eq!(
            ActionValidator::estimate_risk_level(&delete_action),
            RiskLevel::High
        );
    }

    #[test]
    fn test_validate_permissions_insufficient() {
        let action = ActionCommand {
            action_type: ActionType::Archive,
            target_entities: vec![Uuid::new_v4()],
            parameters: std::collections::HashMap::new(),
            require_confirmation: true,
            risk_level: RiskLevel::High,
        };

        let permissions = UserPermissions {
            can_delete_stories: false,
            ..Default::default()
        };

        let result = ActionValidator::validate_permissions(&action, &permissions);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Insufficient permissions"));
    }

    #[test]
    fn test_validate_invalid_status_parameter() {
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity_id],
            parameters: [("new_status".to_string(), serde_json::json!("InvalidStatus"))]
                .into_iter()
                .collect(),
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let candidates = vec![create_test_candidate(
            entity_id,
            EntityType::Story,
            tenant_id,
        )];

        let result = ActionValidator::validate_action(&action, &candidates);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid story status"));
    }
}
