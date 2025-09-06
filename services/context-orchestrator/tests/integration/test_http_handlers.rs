// Integration tests for HTTP handlers
use context_orchestrator::adapters::http::handlers::*;
use serde_json::json;
use uuid::Uuid;

#[cfg(test)]
mod dto_tests {
    use super::*;

    #[test]
    fn test_interpret_request_deserialization() {
        let json = json!({
            "utterance": "Update story status",
            "context_limit": 20,
            "entity_types": ["story", "task"],
            "require_confirmation": true
        });

        let request: InterpretRequest = serde_json::from_value(json).unwrap();
        assert_eq!(request.utterance, "Update story status");
        assert_eq!(request.context_limit, Some(20));
        assert_eq!(request.entity_types.unwrap(), vec!["story", "task"]);
        assert_eq!(request.require_confirmation, Some(true));
    }

    #[test]
    fn test_act_request_deserialization() {
        let target_entity = Uuid::new_v4();
        let session_token = Uuid::new_v4();

        let json = json!({
            "action": {
                "action_type": "update_status",
                "target_entities": [target_entity],
                "parameters": {
                    "status": "in_progress"
                },
                "require_confirmation": false,
                "risk_level": "low"
            },
            "session_token": session_token,
            "confirmed": true
        });

        let request: ActRequest = serde_json::from_value(json).unwrap();
        assert_eq!(request.action.action_type, "update_status");
        assert_eq!(request.action.target_entities[0], target_entity);
        assert_eq!(
            request
                .action
                .parameters
                .get("status")
                .unwrap()
                .as_str()
                .unwrap(),
            "in_progress"
        );
        assert!(!request.action.require_confirmation);
        assert_eq!(request.action.risk_level, "low");
        assert_eq!(request.session_token, Some(session_token));
        assert_eq!(request.confirmed, Some(true));
    }

    #[test]
    fn test_interpret_response_serialization() {
        let entity_id = Uuid::new_v4();
        let session_token = Uuid::new_v4();

        let response = InterpretResponse {
            intent: ParsedIntentDto {
                intent_type: "query_status".to_string(),
                entities: vec![EntityReferenceDto {
                    entity_id,
                    entity_type: "story".to_string(),
                    role: "target".to_string(),
                }],
                parameters: std::collections::HashMap::new(),
            },
            confidence: ConfidenceDto {
                llm_confidence: 0.9,
                service_confidence: 0.8,
                overall_confidence: 0.85,
            },
            candidates: vec![CandidateEntityDto {
                id: Uuid::new_v4(),
                entity_type: "story".to_string(),
                title: "Test Story".to_string(),
                description: Some("Test description".to_string()),
                status: Some("ready".to_string()),
                similarity_score: 0.75,
                boost_reason: Some("exact_match".to_string()),
            }],
            requires_confirmation: false,
            session_token: Some(session_token),
        };

        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["intent"]["intent_type"], "query_status");
        assert_eq!(json["intent"]["entities"].as_array().unwrap().len(), 1);
        assert_eq!(
            json["intent"]["entities"][0]["entity_id"],
            entity_id.to_string()
        );
        let confidence = json["confidence"]["overall_confidence"].as_f64().unwrap();
        assert!(
            (confidence - 0.85).abs() < 0.01,
            "Expected confidence ~0.85, got {}",
            confidence
        );
        assert_eq!(json["candidates"].as_array().unwrap().len(), 1);
        assert_eq!(json["requires_confirmation"], false);
        assert_eq!(json["session_token"], session_token.to_string());
    }

    #[test]
    fn test_act_response_serialization() {
        let target_entity = Uuid::new_v4();
        let rollback_token = Uuid::new_v4();

        let response = ActResponse {
            success: true,
            results: vec![ActionResultDto {
                service: "backlog".to_string(),
                success: true,
                message: "Status updated successfully".to_string(),
                affected_entities: vec![target_entity],
            }],
            rollback_token: Some(rollback_token),
            partial_success: false,
        };

        let json = serde_json::to_value(&response).unwrap();
        assert_eq!(json["success"], true);
        assert_eq!(json["results"].as_array().unwrap().len(), 1);
        assert_eq!(json["results"][0]["service"], "backlog");
        assert_eq!(json["results"][0]["success"], true);
        assert_eq!(json["results"][0]["message"], "Status updated successfully");
        assert_eq!(
            json["results"][0]["affected_entities"][0],
            target_entity.to_string()
        );
        assert_eq!(json["rollback_token"], rollback_token.to_string());
        assert_eq!(json["partial_success"], false);
    }
}

#[cfg(test)]
mod enum_conversion_tests {
    use context_orchestrator::domain::*;

    #[test]
    fn test_action_type_string_conversion() {
        // Test from_string
        assert!(matches!(
            ActionType::from_string("update_status").unwrap(),
            ActionType::UpdateStatus
        ));
        assert!(matches!(
            ActionType::from_string("assign_user").unwrap(),
            ActionType::AssignUser
        ));
        assert!(matches!(
            ActionType::from_string("archive").unwrap(),
            ActionType::Archive
        ));

        // Test invalid string
        assert!(ActionType::from_string("invalid_action").is_err());
    }

    #[test]
    fn test_risk_level_string_conversion() {
        // Test from_string
        assert!(matches!(
            RiskLevel::from_string("low").unwrap(),
            RiskLevel::Low
        ));
        assert!(matches!(
            RiskLevel::from_string("medium").unwrap(),
            RiskLevel::Medium
        ));
        assert!(matches!(
            RiskLevel::from_string("high").unwrap(),
            RiskLevel::High
        ));

        // Test invalid string
        assert!(RiskLevel::from_string("invalid_risk").is_err());
    }

    #[test]
    fn test_intent_type_string_conversion() {
        // Test to_string (Display trait)
        assert_eq!(IntentType::UpdateStatus.to_string(), "update_status");
        assert_eq!(IntentType::AssignTask.to_string(), "assign_task");
        assert_eq!(IntentType::Unknown.to_string(), "unknown");
    }
}
