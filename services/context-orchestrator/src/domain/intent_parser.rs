use crate::domain::{EntityReference, IntentType, ParsedIntent};
use common::AppError;
use serde_json::{json, Value};
use std::collections::HashMap;

pub struct IntentParser;

impl IntentParser {
    pub fn parse_llm_response(
        llm_output: &str,
        candidate_ids: &[uuid::Uuid],
    ) -> Result<ParsedIntent, AppError> {
        // Parse JSON from LLM
        let parsed: Value = serde_json::from_str(llm_output)
            .map_err(|_| AppError::BadRequest("Invalid JSON from LLM".to_string()))?;

        // Validate against schema
        Self::validate_json_schema(&parsed)?;

        // Extract intent type
        let intent_type = Self::extract_intent_type(&parsed)?;

        // Extract and validate entity references
        let entities = Self::extract_entity_references(&parsed, candidate_ids)?;

        // Extract parameters
        let parameters = parsed
            .get("parameters")
            .and_then(|p| p.as_object())
            .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
            .unwrap_or_default();

        Ok(ParsedIntent {
            intent_type,
            entities,
            parameters,
        })
    }

    pub fn fallback_heuristic_parse(
        utterance: &str,
        candidates: &[crate::domain::CandidateEntity],
    ) -> ParsedIntent {
        let utterance_lower = utterance.to_lowercase();

        // Simple keyword-based intent detection
        let intent_type = if utterance_lower.contains("i'll take")
            || utterance_lower.contains("i'm on it")
            || utterance_lower.contains("i'll work on")
            || utterance_lower.contains("i'll handle")
            || utterance_lower.contains("taking this")
            || utterance_lower.contains("picking up")
            || utterance_lower.contains("taking ownership")
            || utterance_lower.contains("takes ownership")
            || utterance_lower.contains("took ownership")
            || (utterance_lower.contains("take") && utterance_lower.contains("ownership"))
        {
            IntentType::TakeOwnership
        } else if utterance_lower.contains("release")
            || utterance_lower.contains("give up")
            || utterance_lower.contains("drop this")
            || utterance_lower.contains("can't work on")
            || utterance_lower.contains("no longer working")
        {
            IntentType::ReleaseOwnership
        } else if utterance_lower.contains("completed")
            || utterance_lower.contains("finished")
            || utterance_lower.contains("done with")
            || utterance_lower.contains("completed task")
            || utterance_lower.contains("task is done")
        {
            IntentType::CompleteTask
        } else if utterance_lower.contains("starting")
            || utterance_lower.contains("begin work")
            || utterance_lower.contains("working on")
            || (utterance_lower.contains("start") && utterance_lower.contains("task"))
        {
            IntentType::StartWork
        } else if utterance_lower.contains("move") || utterance_lower.contains("change") {
            if utterance_lower.contains("ready") || utterance_lower.contains("status") {
                IntentType::UpdateStatus
            } else if utterance_lower.contains("sprint") {
                IntentType::MoveToSprint
            } else {
                IntentType::UpdateStatus
            }
        } else if utterance_lower.contains("create") || utterance_lower.contains("add") {
            IntentType::CreateItem
        } else if utterance_lower.contains("delete")
            || utterance_lower.contains("remove")
            || utterance_lower.contains("archive")
        {
            IntentType::Archive
        } else if utterance_lower.contains("generate")
            || utterance_lower.contains("plan")
            || utterance_lower.contains("report")
        {
            IntentType::GenerateReport
        } else if utterance_lower.contains("what")
            || utterance_lower.contains("show")
            || utterance_lower.contains("get")
            || utterance_lower.contains("find")
        {
            IntentType::QueryStatus
        } else if utterance_lower.contains("search") {
            IntentType::SearchItems
        } else if utterance_lower.contains("assign") {
            IntentType::AssignTask
        } else if utterance_lower.contains("priority") {
            IntentType::UpdatePriority
        } else if utterance_lower.contains("comment") {
            IntentType::AddComment
        } else {
            IntentType::Unknown
        };

        // Simple entity matching based on title similarity
        let entities: Vec<EntityReference> = candidates
            .iter()
            .filter_map(|candidate| {
                let title_lower = candidate.title.to_lowercase();
                let words: Vec<&str> = utterance_lower.split_whitespace().collect();

                let mut matches = 0;
                let mut total_words = 0;

                for word in &words {
                    if word.len() > 2 {
                        // Skip short words
                        total_words += 1;
                        if title_lower.contains(word) {
                            matches += 1;
                        }
                    }
                }

                if matches > 0 && total_words > 0 {
                    let match_score = matches as f32 / total_words as f32;
                    if match_score > 0.2 {
                        // Threshold for relevance
                        Some(EntityReference {
                            entity_id: candidate.id,
                            entity_type: candidate.entity_type.clone(),
                            role: "target".to_string(),
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        // Extract parameters based on intent type
        let mut parameters = HashMap::new();
        match intent_type {
            IntentType::UpdateStatus => {
                if utterance_lower.contains("ready") {
                    parameters.insert("new_status".to_string(), json!("Ready"));
                } else if utterance_lower.contains("progress") {
                    parameters.insert("new_status".to_string(), json!("InProgress"));
                } else if utterance_lower.contains("review") {
                    parameters.insert("new_status".to_string(), json!("InReview"));
                } else if utterance_lower.contains("done") {
                    parameters.insert("new_status".to_string(), json!("Done"));
                }
            }
            IntentType::CreateItem => {
                // Extract potential title from utterance
                if let Some(title_start) = utterance_lower.find("create ") {
                    let title_part = &utterance[title_start + 7..];
                    if let Some(end) = title_part.find(" for") {
                        parameters.insert("title".to_string(), json!(title_part[..end].trim()));
                    } else {
                        parameters.insert("title".to_string(), json!(title_part.trim()));
                    }
                } else if let Some(title_start) = utterance_lower.find("add ") {
                    let title_part = &utterance[title_start + 4..];
                    parameters.insert("title".to_string(), json!(title_part.trim()));
                }
            }
            _ => {}
        }

        ParsedIntent {
            intent_type,
            entities,
            parameters,
        }
    }

    fn validate_json_schema(parsed: &Value) -> Result<(), AppError> {
        // Define expected schema
        let required_fields = ["intent_type", "entities"];

        for field in &required_fields {
            if parsed.get(field).is_none() {
                return Err(AppError::BadRequest(format!(
                    "Missing required field: {}",
                    field
                )));
            }
        }

        // Validate intent_type is a valid string
        if let Some(intent) = parsed.get("intent_type").and_then(|v| v.as_str()) {
            match intent {
                "update_status" | "create_entity" | "delete_entity" | "move_entity"
                | "get_information" | "generate_pack" | "take_ownership" | "release_ownership"
                | "start_work" | "complete_task" | "assign_task" | "unknown" => {}
                _ => return Err(AppError::BadRequest("Invalid intent_type".to_string())),
            }
        } else {
            return Err(AppError::BadRequest(
                "intent_type must be a string".to_string(),
            ));
        }

        // Validate entities is an array
        if !parsed.get("entities").unwrap().is_array() {
            return Err(AppError::BadRequest(
                "entities must be an array".to_string(),
            ));
        }

        Ok(())
    }

    fn extract_intent_type(parsed: &Value) -> Result<IntentType, AppError> {
        let intent_str = parsed
            .get("intent_type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::BadRequest("Missing intent_type".to_string()))?;

        match intent_str {
            "update_status" => Ok(IntentType::UpdateStatus),
            "create_item" => Ok(IntentType::CreateItem),
            "archive" => Ok(IntentType::Archive),
            "move_to_sprint" => Ok(IntentType::MoveToSprint),
            "query_status" => Ok(IntentType::QueryStatus),
            "search_items" => Ok(IntentType::SearchItems),
            "update_priority" => Ok(IntentType::UpdatePriority),
            "add_comment" => Ok(IntentType::AddComment),
            "assign_task" => Ok(IntentType::AssignTask),
            "take_ownership" => Ok(IntentType::TakeOwnership),
            "release_ownership" => Ok(IntentType::ReleaseOwnership),
            "start_work" => Ok(IntentType::StartWork),
            "complete_task" => Ok(IntentType::CompleteTask),
            "generate_report" => Ok(IntentType::GenerateReport),
            "unknown" => Ok(IntentType::Unknown),
            _ => Err(AppError::BadRequest("Invalid intent_type".to_string())),
        }
    }

    fn extract_entity_references(
        parsed: &Value,
        candidate_ids: &[uuid::Uuid],
    ) -> Result<Vec<EntityReference>, AppError> {
        let entities_array = parsed
            .get("entities")
            .and_then(|v| v.as_array())
            .ok_or_else(|| AppError::BadRequest("Invalid entities array".to_string()))?;

        let mut entity_refs = Vec::new();

        for entity_val in entities_array {
            let entity_id_str = entity_val
                .get("entity_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    AppError::BadRequest("Missing entity_id in entity reference".to_string())
                })?;

            let entity_id = uuid::Uuid::parse_str(entity_id_str)
                .map_err(|_| AppError::BadRequest("Invalid entity_id format".to_string()))?;

            // Security: Ensure entity_id is in the candidate set
            if !candidate_ids.contains(&entity_id) {
                return Err(AppError::BadRequest(
                    "Entity ID not in candidate set".to_string(),
                ));
            }

            let entity_type_str = entity_val
                .get("entity_type")
                .and_then(|v| v.as_str())
                .ok_or_else(|| {
                    AppError::BadRequest("Missing entity_type in entity reference".to_string())
                })?;

            let entity_type = match entity_type_str {
                "story" => crate::domain::EntityType::Story,
                "task" => crate::domain::EntityType::Task,
                "project" => crate::domain::EntityType::Project,
                "plan_pack" => crate::domain::EntityType::PlanPack,
                "task_pack" => crate::domain::EntityType::TaskPack,
                "acceptance_criterion" => crate::domain::EntityType::AcceptanceCriterion,
                _ => return Err(AppError::BadRequest("Invalid entity_type".to_string())),
            };

            let role = entity_val
                .get("role")
                .and_then(|v| v.as_str())
                .unwrap_or("target")
                .to_string();

            entity_refs.push(EntityReference {
                entity_id,
                entity_type: entity_type.to_string(),
                role,
            });
        }

        Ok(entity_refs)
    }
}

// Module-level convenience function with Result return
pub fn fallback_heuristic_parse(
    utterance: &str,
    candidates: &[crate::domain::CandidateEntity],
) -> Result<ParsedIntent, AppError> {
    Ok(IntentParser::fallback_heuristic_parse(
        utterance, candidates,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_fallback_heuristic_parse_update_status() {
        let candidates = vec![];
        let result = IntentParser::fallback_heuristic_parse("move story to ready", &candidates);

        assert_eq!(result.intent_type, IntentType::UpdateStatus);
        assert_eq!(
            result.parameters.get("new_status").unwrap(),
            &json!("Ready")
        );
    }

    #[test]
    fn test_fallback_heuristic_parse_create_entity() {
        let candidates = vec![];
        let result = IntentParser::fallback_heuristic_parse("create user login task", &candidates);

        assert_eq!(result.intent_type, IntentType::CreateItem);
        assert_eq!(
            result.parameters.get("title").unwrap(),
            &json!("user login task")
        );
    }

    #[test]
    fn test_fallback_heuristic_parse_take_ownership() {
        let candidates = vec![];
        let result = IntentParser::fallback_heuristic_parse("I'll take this task", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        let result = IntentParser::fallback_heuristic_parse("I'm on it", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        let result = IntentParser::fallback_heuristic_parse("taking this task", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);
    }

    #[test]
    fn test_fallback_heuristic_parse_take_ownership_variations() {
        let candidates = vec![];
        
        // Test the specific bug case mentioned in the issue
        let result = IntentParser::fallback_heuristic_parse("taking ownership and moving forward", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        // Test other ownership variations
        let result = IntentParser::fallback_heuristic_parse("takes ownership of this task", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        let result = IntentParser::fallback_heuristic_parse("took ownership and will move forward", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        // Test that ownership takes precedence over move/change
        let result = IntentParser::fallback_heuristic_parse("I'll take ownership and change the status", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);
    }

    #[test]
    fn test_fallback_heuristic_parse_take_ownership_variations() {
        let candidates = vec![];
        
        // Test the specific bug case mentioned in the issue
        let result = IntentParser::fallback_heuristic_parse("taking ownership and moving forward", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        // Test other ownership variations
        let result = IntentParser::fallback_heuristic_parse("takes ownership of this task", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        let result = IntentParser::fallback_heuristic_parse("took ownership and will move forward", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);

        // Test that ownership takes precedence over move/change
        let result = IntentParser::fallback_heuristic_parse("I'll take ownership and change the status", &candidates);
        assert_eq!(result.intent_type, IntentType::TakeOwnership);
    }

    #[test]
    fn test_fallback_heuristic_parse_release_ownership() {
        let candidates = vec![];
        let result =
            IntentParser::fallback_heuristic_parse("I need to release this task", &candidates);
        assert_eq!(result.intent_type, IntentType::ReleaseOwnership);

        let result =
            IntentParser::fallback_heuristic_parse("can't work on this anymore", &candidates);
        assert_eq!(result.intent_type, IntentType::ReleaseOwnership);
    }

    #[test]
    fn test_fallback_heuristic_parse_start_work() {
        let candidates = vec![];
        let result =
            IntentParser::fallback_heuristic_parse("starting work on this task", &candidates);
        assert_eq!(result.intent_type, IntentType::StartWork);

        let result = IntentParser::fallback_heuristic_parse("begin work", &candidates);
        assert_eq!(result.intent_type, IntentType::StartWork);
    }

    #[test]
    fn test_fallback_heuristic_parse_complete_task() {
        let candidates = vec![];
        let result = IntentParser::fallback_heuristic_parse("task is completed", &candidates);
        assert_eq!(result.intent_type, IntentType::CompleteTask);

        let result =
            IntentParser::fallback_heuristic_parse("finished working on this", &candidates);
        assert_eq!(result.intent_type, IntentType::CompleteTask);
    }

    #[test]
    fn test_validate_json_schema_success() {
        let valid_json = json!({
            "intent_type": "update_status",
            "entities": [
                {
                    "entity_id": "550e8400-e29b-41d4-a716-446655440000",
                    "entity_type": "story",
                    "match_score": 0.9,
                    "title": "User login"
                }
            ],
            "parameters": {
                "new_status": "Ready"
            }
        });

        assert!(IntentParser::validate_json_schema(&valid_json).is_ok());
    }

    #[test]
    fn test_validate_json_schema_missing_field() {
        let invalid_json = json!({
            "intent_type": "update_status"
            // missing entities field
        });

        assert!(IntentParser::validate_json_schema(&invalid_json).is_err());
    }

    #[test]
    fn test_parse_llm_response_with_validation() {
        let candidate_ids = vec![Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()];
        let llm_output = r#"{
            "intent_type": "update_status",
            "entities": [
                {
                    "entity_id": "550e8400-e29b-41d4-a716-446655440000",
                    "entity_type": "story",
                    "match_score": 0.9,
                    "title": "User login"
                }
            ],
            "parameters": {
                "new_status": "Ready"
            }
        }"#;

        let result = IntentParser::parse_llm_response(llm_output, &candidate_ids);
        assert!(result.is_ok());

        let parsed_intent = result.unwrap();
        assert_eq!(parsed_intent.intent_type, IntentType::UpdateStatus);
        assert_eq!(parsed_intent.entities.len(), 1);
        assert_eq!(parsed_intent.entities[0].entity_id, candidate_ids[0]);
    }

    #[test]
    fn test_parse_llm_response_invalid_entity_id() {
        let candidate_ids = vec![Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()];
        let llm_output = r#"{
            "intent_type": "update_status",
            "entities": [
                {
                    "entity_id": "550e8400-e29b-41d4-a716-446655440001",
                    "entity_type": "story",
                    "match_score": 0.9,
                    "title": "User login"
                }
            ]
        }"#;

        let result = IntentParser::parse_llm_response(llm_output, &candidate_ids);
        assert!(result.is_err());
    }
}
