use context_orchestrator::domain::*;
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

#[cfg(test)]
mod context_entity_tests {
    use super::*;

    #[test]
    fn test_context_entity_creation() {
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();
        let now = Utc::now();

        let entity = ContextEntity {
            id: entity_id,
            tenant_id,
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: Some("A test story".to_string()),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec!["test".to_string(), "unit".to_string()],
            metadata: HashMap::new(),
            last_updated: now,
            created_at: now,
        };

        assert_eq!(entity.id, entity_id);
        assert_eq!(entity.tenant_id, tenant_id);
        assert_eq!(entity.entity_type, "story");
        assert_eq!(entity.title, "Test Story");
        assert_eq!(entity.description, Some("A test story".to_string()));
        assert_eq!(entity.status, Some("ready".to_string()));
        assert_eq!(entity.priority, Some(1));
        assert_eq!(entity.tags.len(), 2);
        assert!(entity.tags.contains(&"test".to_string()));
        assert!(entity.tags.contains(&"unit".to_string()));
    }

    #[test]
    fn test_candidate_entity_similarity_scoring() {
        let candidate = CandidateEntity {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: Some("A test story".to_string()),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.85,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        };

        assert_eq!(candidate.similarity_score, 0.85);
        assert!(candidate.similarity_score > 0.8);
        assert!(candidate.similarity_score < 0.9);
    }

    #[test]
    fn test_intent_record_creation() {
        let tenant_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let parsed_intent = ParsedIntent {
            intent_type: IntentType::UpdateStatus,
            entities: vec![EntityReference {
                entity_id: Uuid::new_v4(),
                entity_type: "story".to_string(),
                role: "target".to_string(),
            }],
            parameters: {
                let mut params = HashMap::new();
                params.insert("status".to_string(), serde_json::json!("in_progress"));
                params
            },
        };

        let intent_record = IntentRecord::new(
            tenant_id,
            user_id,
            "Mark story as in progress",
            parsed_intent.clone(),
            0.9,
            0.8,
            vec![Uuid::new_v4()],
        );

        assert_eq!(intent_record.tenant_id, tenant_id);
        assert_eq!(intent_record.user_id, user_id);
        assert_eq!(intent_record.llm_confidence, 0.9);
        assert_eq!(intent_record.service_confidence, 0.8);
        assert_eq!(intent_record.parsed_intent.intent_type, IntentType::UpdateStatus);
        assert_eq!(intent_record.parsed_intent.entities.len(), 1);
        assert!(intent_record.utterance_hash.len() > 0);
    }
}

#[cfg(test)]
mod action_command_tests {
    use super::*;

    #[test]
    fn test_action_command_creation() {
        let target_entity = Uuid::new_v4();
        let mut parameters = HashMap::new();
        parameters.insert("status".to_string(), serde_json::json!("completed"));

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![target_entity],
            parameters,
            require_confirmation: true,
            risk_level: RiskLevel::Medium,
        };

        assert!(matches!(action.action_type, ActionType::UpdateStatus));
        assert_eq!(action.target_entities.len(), 1);
        assert_eq!(action.target_entities[0], target_entity);
        assert_eq!(action.parameters.get("status").unwrap().as_str().unwrap(), "completed");
        assert!(action.require_confirmation);
        assert!(matches!(action.risk_level, RiskLevel::Medium));
    }

    #[test]
    fn test_risk_level_ordering() {
        assert!(RiskLevel::High > RiskLevel::Medium);
        assert!(RiskLevel::Medium > RiskLevel::Low);
        assert!(RiskLevel::Low < RiskLevel::High);
    }
}

#[cfg(test)]
mod enum_tests {
    use super::*;

    #[test]
    fn test_intent_type_variants() {
        let variants = vec![
            IntentType::UpdateStatus,
            IntentType::AssignTask,
            IntentType::CreateItem,
            IntentType::QueryStatus,
            IntentType::SearchItems,
            IntentType::UpdatePriority,
            IntentType::AddComment,
            IntentType::MoveToSprint,
            IntentType::GenerateReport,
            IntentType::Archive,
            IntentType::Unknown,
        ];

        assert_eq!(variants.len(), 11);
        
        // Test Display trait
        assert_eq!(IntentType::UpdateStatus.to_string(), "UpdateStatus");
        assert_eq!(IntentType::Unknown.to_string(), "Unknown");
    }

    #[test]
    fn test_action_type_variants() {
        let variants = vec![
            ActionType::UpdateStatus,
            ActionType::AssignUser,
            ActionType::UpdatePriority,
            ActionType::AddComment,
            ActionType::CreateTask,
            ActionType::CreateStory,
            ActionType::MoveToSprint,
            ActionType::Archive,
        ];

        assert_eq!(variants.len(), 8);
        
        // Test Display trait
        assert_eq!(ActionType::UpdateStatus.to_string(), "UpdateStatus");
        assert_eq!(ActionType::Archive.to_string(), "Archive");
    }

    #[test]
    fn test_risk_level_variants() {
        let variants = vec![
            RiskLevel::Low,
            RiskLevel::Medium,
            RiskLevel::High,
        ];

        assert_eq!(variants.len(), 3);
        
        // Test Display trait
        assert_eq!(RiskLevel::Low.to_string(), "Low");
        assert_eq!(RiskLevel::High.to_string(), "High");
    }
}