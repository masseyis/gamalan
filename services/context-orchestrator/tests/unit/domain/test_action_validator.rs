use context_orchestrator::domain::*;
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

#[cfg(test)]
mod action_validator_tests {
    use super::*;

    fn create_test_candidate(entity_type: &str, status: Option<&str>, tenant_id: Uuid) -> CandidateEntity {
        CandidateEntity {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type: entity_type.to_string(),
            title: "Test Entity".to_string(),
            description: Some("Test description".to_string()),
            status: status.map(|s| s.to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.8,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        }
    }

    fn create_action_command(action_type: ActionType, entities: Vec<Uuid>) -> ActionCommand {
        let mut parameters = HashMap::new();
        parameters.insert("status".to_string(), serde_json::json!("in_progress"));
        
        ActionCommand {
            action_type,
            target_entities: entities,
            parameters,
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        }
    }

    #[test]
    fn test_validate_update_status_action_success() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let action = create_action_command(ActionType::UpdateStatus, vec![story_candidate.id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_ok(), "Valid update status action should succeed");
    }

    #[test]
    fn test_validate_update_status_wrong_entity_type() {
        let tenant_id = Uuid::new_v4();
        let task_candidate = create_test_candidate("task", Some("todo"), tenant_id);
        let candidates = vec![task_candidate.clone()];
        
        let action = create_action_command(ActionType::UpdateStatus, vec![task_candidate.id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "UpdateStatus on task should fail");
        assert!(result.unwrap_err().to_string().contains("Can only update status of stories"));
    }

    #[test]
    fn test_validate_assign_user_action_success() {
        let tenant_id = Uuid::new_v4();
        let task_candidate = create_test_candidate("task", Some("todo"), tenant_id);
        let candidates = vec![task_candidate.clone()];
        
        let mut action = create_action_command(ActionType::AssignUser, vec![task_candidate.id]);
        action.parameters.insert("user_id".to_string(), serde_json::json!("user-123"));

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_ok(), "Valid assign user action should succeed");
    }

    #[test]
    fn test_validate_assign_user_missing_parameter() {
        let tenant_id = Uuid::new_v4();
        let task_candidate = create_test_candidate("task", Some("todo"), tenant_id);
        let candidates = vec![task_candidate.clone()];
        
        let action = create_action_command(ActionType::AssignUser, vec![task_candidate.id]);
        // Missing user_id parameter

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Assign user without user_id should fail");
        assert!(result.unwrap_err().to_string().contains("user_id parameter required"));
    }

    #[test]
    fn test_validate_assign_user_wrong_entity_type() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let mut action = create_action_command(ActionType::AssignUser, vec![story_candidate.id]);
        action.parameters.insert("user_id".to_string(), serde_json::json!("user-123"));

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "AssignUser on story should fail");
        assert!(result.unwrap_err().to_string().contains("Can only assign users to tasks"));
    }

    #[test]
    fn test_validate_update_priority_action_success() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let mut action = create_action_command(ActionType::UpdatePriority, vec![story_candidate.id]);
        action.parameters.insert("priority".to_string(), serde_json::json!(2));

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_ok(), "Valid update priority action should succeed");
    }

    #[test]
    fn test_validate_update_priority_missing_parameter() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let action = create_action_command(ActionType::UpdatePriority, vec![story_candidate.id]);
        // Missing priority parameter

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Update priority without priority should fail");
        assert!(result.unwrap_err().to_string().contains("priority parameter required"));
    }

    #[test]
    fn test_validate_update_priority_invalid_range() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let mut action = create_action_command(ActionType::UpdatePriority, vec![story_candidate.id]);
        action.parameters.insert("priority".to_string(), serde_json::json!(6)); // Invalid: > 5

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Priority > 5 should fail");
        assert!(result.unwrap_err().to_string().contains("Priority must be between 1 and 5"));
    }

    #[test]
    fn test_validate_add_comment_action_success() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let mut action = create_action_command(ActionType::AddComment, vec![story_candidate.id]);
        action.parameters.insert("comment".to_string(), serde_json::json!("This is a test comment"));

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_ok(), "Valid add comment action should succeed");
    }

    #[test]
    fn test_validate_add_comment_missing_parameter() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let action = create_action_command(ActionType::AddComment, vec![story_candidate.id]);
        // Missing comment parameter

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Add comment without comment should fail");
        assert!(result.unwrap_err().to_string().contains("comment parameter required"));
    }

    #[test]
    fn test_validate_entity_not_found() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let unknown_entity_id = Uuid::new_v4(); // Not in candidates
        let action = create_action_command(ActionType::UpdateStatus, vec![unknown_entity_id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Action on unknown entity should fail");
        assert!(result.unwrap_err().to_string().contains("Entity not found"));
    }

    #[test]
    fn test_validate_tenant_mismatch() {
        let tenant_id = Uuid::new_v4();
        let other_tenant_id = Uuid::new_v4();
        
        let story_candidate = create_test_candidate("story", Some("ready"), other_tenant_id);
        let candidates = vec![story_candidate.clone()];
        
        let action = create_action_command(ActionType::UpdateStatus, vec![story_candidate.id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Action on other tenant's entity should fail");
        assert!(result.unwrap_err().to_string().contains("Entity not found")); // Should not reveal tenant mismatch
    }

    #[test]
    fn test_validate_multiple_entities_success() {
        let tenant_id = Uuid::new_v4();
        let story1 = create_test_candidate("story", Some("ready"), tenant_id);
        let story2 = create_test_candidate("story", Some("ready"), tenant_id);
        let candidates = vec![story1.clone(), story2.clone()];
        
        let action = create_action_command(ActionType::UpdateStatus, vec![story1.id, story2.id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_ok(), "Valid bulk action should succeed");
    }

    #[test]
    fn test_validate_multiple_entities_partial_failure() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let task_candidate = create_test_candidate("task", Some("todo"), tenant_id);
        let candidates = vec![story_candidate.clone(), task_candidate.clone()];
        
        // Try to update status on both story (valid) and task (invalid)
        let action = create_action_command(ActionType::UpdateStatus, vec![story_candidate.id, task_candidate.id]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Mixed entity types for UpdateStatus should fail");
    }

    #[test]
    fn test_validate_empty_target_entities() {
        let tenant_id = Uuid::new_v4();
        let candidates = vec![];
        
        let action = create_action_command(ActionType::UpdateStatus, vec![]);

        let result = action_validator::validate_action(&action, &candidates);
        
        assert!(result.is_err(), "Action with no target entities should fail");
        assert!(result.unwrap_err().to_string().contains("No target entities specified"));
    }
}

#[cfg(test)]
mod action_type_validation_tests {
    use super::*;

    #[test]
    fn test_all_action_types_have_validation() {
        let tenant_id = Uuid::new_v4();
        let story_candidate = create_test_candidate("story", Some("ready"), tenant_id);
        let task_candidate = create_test_candidate("task", Some("todo"), tenant_id);
        let candidates = vec![story_candidate.clone(), task_candidate.clone()];

        // Test that all action types can be validated without panicking
        let action_types = vec![
            ActionType::UpdateStatus,
            ActionType::AssignUser,
            ActionType::UpdatePriority,
            ActionType::AddComment,
            ActionType::CreateTask,
            ActionType::CreateStory,
            ActionType::MoveToSprint,
            ActionType::Archive,
        ];

        for action_type in action_types {
            let action = ActionCommand {
                action_type,
                target_entities: vec![story_candidate.id],
                parameters: HashMap::new(),
                require_confirmation: false,
                risk_level: RiskLevel::Low,
            };

            // Should not panic, even if validation fails
            let result = action_validator::validate_action(&action, &candidates);
            
            // We don't care if it succeeds or fails, just that it doesn't panic
            match result {
                Ok(_) => {},
                Err(_) => {},
            }
        }
    }

    #[test]
    fn test_create_actions_ignore_target_entities() {
        let tenant_id = Uuid::new_v4();
        let candidates = vec![];
        
        let action = ActionCommand {
            action_type: ActionType::CreateStory,
            target_entities: vec![], // Empty is OK for create actions
            parameters: {
                let mut params = HashMap::new();
                params.insert("title".to_string(), serde_json::json!("New Story"));
                params
            },
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        let result = action_validator::validate_action(&action, &candidates);
        
        // Create actions should work even with no target entities
        assert!(result.is_ok(), "Create actions should work with empty target entities");
    }
}