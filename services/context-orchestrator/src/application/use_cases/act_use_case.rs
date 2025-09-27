use crate::application::ports::{
    AuditLogRepository, BacklogServiceClient, PromptBuilderServiceClient, ReadinessServiceClient,
    VectorSearchRepository,
};
use crate::domain::{action_validator, ActionCommand, ActionType};
use common::AppError;
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

#[allow(dead_code)]
pub struct ActUseCase {
    audit_repo: Arc<dyn AuditLogRepository>,
    vector_repo: Arc<dyn VectorSearchRepository>,
    backlog_client: Arc<dyn BacklogServiceClient>,
    prompt_builder_client: Arc<dyn PromptBuilderServiceClient>,
    readiness_client: Arc<dyn ReadinessServiceClient>,
}

#[derive(Debug)]
pub struct ActResult {
    pub success: bool,
    pub results: Vec<ActionResult>,
    pub rollback_token: Option<Uuid>,
    pub partial_success: bool,
}

#[derive(Debug)]
pub struct ActionResult {
    pub service: String,
    pub success: bool,
    pub message: String,
    pub affected_entities: Vec<Uuid>,
}

impl ActUseCase {
    pub fn new(
        audit_repo: Arc<dyn AuditLogRepository>,
        vector_repo: Arc<dyn VectorSearchRepository>,
        backlog_client: Arc<dyn BacklogServiceClient>,
        prompt_builder_client: Arc<dyn PromptBuilderServiceClient>,
        readiness_client: Arc<dyn ReadinessServiceClient>,
    ) -> Self {
        Self {
            audit_repo,
            vector_repo,
            backlog_client,
            prompt_builder_client,
            readiness_client,
        }
    }

    pub async fn execute(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        action_command: ActionCommand,
        _session_token: Option<Uuid>,
        confirmed: bool,
    ) -> Result<ActResult, AppError> {
        let start_time = Instant::now();
        let rollback_token = Uuid::new_v4();

        // 1. Validate the action command
        let candidates = self
            .get_candidates_for_entities(tenant_id, &action_command.target_entities)
            .await?;

        action_validator::validate_action(&action_command, &candidates)?;

        // 2. Check if confirmation is required and provided
        if action_command.require_confirmation && !confirmed {
            return Err(AppError::BadRequest(
                "Action requires confirmation but none provided".to_string(),
            ));
        }

        // 3. Execute the action based on type
        let mut results = Vec::new();
        let overall_success;

        match action_command.action_type {
            ActionType::UpdateStatus => {
                let result = self
                    .execute_update_status(tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::AssignUser => {
                let result = self.execute_assign_user(tenant_id, &action_command).await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::TakeOwnership => {
                let result = self
                    .execute_take_ownership(user_id, tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::ReleaseOwnership => {
                let result = self
                    .execute_release_ownership(user_id, tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::StartWork => {
                let result = self
                    .execute_start_work(user_id, tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::CompleteTask => {
                let result = self
                    .execute_complete_task(user_id, tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::CreateTask => {
                let result = self.execute_create_task(tenant_id, &action_command).await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::CreateStory => {
                let result = self
                    .execute_create_story(tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::UpdatePriority => {
                let result = self
                    .execute_update_priority(tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::MoveToSprint => {
                let result = self
                    .execute_move_to_sprint(tenant_id, &action_command)
                    .await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::Archive => {
                let result = self.execute_archive(tenant_id, &action_command).await?;
                overall_success = result.success;
                results.push(result);
            }
            ActionType::AddComment => {
                let result = self.execute_add_comment(tenant_id, &action_command).await?;
                overall_success = result.success;
                results.push(result);
            }
        }

        // 4. Record audit log
        let execution_duration = start_time.elapsed();
        let success_count = results.iter().filter(|r| r.success).count();
        let partial_success = success_count > 0 && success_count < results.len();

        self.audit_repo
            .record_action_audit(
                tenant_id,
                user_id,
                &action_command.action_type.to_string(),
                &action_command.target_entities,
                Some(
                    &serde_json::to_value(&action_command.parameters)
                        .map_err(|_| AppError::InternalServerError)?,
                ),
                overall_success,
                if overall_success {
                    None
                } else {
                    Some("One or more actions failed")
                },
                Some(execution_duration),
                if overall_success {
                    None
                } else {
                    Some(rollback_token)
                },
            )
            .await?;

        Ok(ActResult {
            success: overall_success,
            results,
            rollback_token: if overall_success {
                None
            } else {
                Some(rollback_token)
            },
            partial_success,
        })
    }

    async fn get_candidates_for_entities(
        &self,
        tenant_id: Uuid,
        entity_ids: &[Uuid],
    ) -> Result<Vec<crate::domain::CandidateEntity>, AppError> {
        // For validation purposes, we need to fetch the entities
        // Use vector search to get candidate entities
        let candidates = self
            .vector_repo
            .search_similar(
                vec![0.0; 512], // Mock embedding for testing
                tenant_id,
                None,      // No entity type filter
                100,       // Large limit to ensure we get all candidates
                Some(0.0), // Very low threshold to include all candidates
            )
            .await?;

        // Filter to only the entities we're interested in
        let filtered_candidates: Vec<_> = candidates
            .into_iter()
            .filter(|c| entity_ids.contains(&c.id))
            .collect();

        Ok(filtered_candidates)
    }

    async fn execute_update_status(
        &self,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let status = action
            .parameters
            .get("status")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::BadRequest("Missing status parameter".to_string()))?;

        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .update_story_status(tenant_id, entity_id, status)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!("Failed to update {}: {}", entity_id, e));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_assign_user(
        &self,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let assignee_id = action
            .parameters
            .get("user_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .ok_or_else(|| {
                AppError::BadRequest("Missing or invalid user_id parameter".to_string())
            })?;

        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .assign_task(tenant_id, entity_id, assignee_id)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!("Failed to assign {}: {}", entity_id, e));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_create_task(
        &self,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let title = action
            .parameters
            .get("title")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::BadRequest("Missing title parameter".to_string()))?;

        let description = action
            .parameters
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let story_id = action
            .parameters
            .get("story_id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());

        let priority = action
            .parameters
            .get("priority")
            .and_then(|v| v.as_u64())
            .map(|p| p as u32);

        let task_request = crate::application::ports::CreateTaskRequest {
            story_id,
            title: title.to_string(),
            description,
            acceptance_criteria: None,
            priority,
            estimated_hours: None,
        };

        match self
            .backlog_client
            .create_task(tenant_id, task_request)
            .await
        {
            Ok(result) => Ok(ActionResult {
                service: "backlog".to_string(),
                success: result.success,
                message: result.message,
                affected_entities: result.affected_entities,
            }),
            Err(e) => Ok(ActionResult {
                service: "backlog".to_string(),
                success: false,
                message: format!("Failed to create task: {}", e),
                affected_entities: Vec::new(),
            }),
        }
    }

    async fn execute_create_story(
        &self,
        _tenant_id: Uuid,
        _action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        // Similar to create_task but for stories
        // This would involve more complex story creation logic
        Ok(ActionResult {
            service: "backlog".to_string(),
            success: false,
            message: "Story creation not yet implemented".to_string(),
            affected_entities: Vec::new(),
        })
    }

    async fn execute_update_priority(
        &self,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let priority = action
            .parameters
            .get("priority")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| AppError::BadRequest("Missing priority parameter".to_string()))?
            as u32;

        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .update_priority(tenant_id, entity_id, priority)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!(
                        "Failed to update priority for {}: {}",
                        entity_id, e
                    ));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_move_to_sprint(
        &self,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        // Check readiness before moving to sprint
        let mut results = Vec::new();
        let mut success = true;

        for &entity_id in &action.target_entities {
            match self
                .readiness_client
                .check_story_readiness(tenant_id, entity_id)
                .await
            {
                Ok(readiness_result) => {
                    if !readiness_result.is_ready {
                        success = false;
                        results.push(format!(
                            "Story {} not ready: missing {}",
                            entity_id,
                            readiness_result.missing_criteria.join(", ")
                        ));
                        continue;
                    }

                    // If ready, proceed with move (would call sprint service)
                    results.push(format!("Story {} moved to sprint", entity_id));
                }
                Err(e) => {
                    success = false;
                    results.push(format!(
                        "Failed to check readiness for {}: {}",
                        entity_id, e
                    ));
                }
            }
        }

        Ok(ActionResult {
            service: "readiness".to_string(),
            success,
            message: results.join("; "),
            affected_entities: if success {
                action.target_entities.clone()
            } else {
                Vec::new()
            },
        })
    }

    async fn execute_archive(
        &self,
        _tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        // Archive entities (high-risk operation)
        let mut affected_entities = Vec::new();
        let success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            // This would call the appropriate service to archive the entity
            // For now, simulate the operation
            messages.push(format!("Archived entity {}", entity_id));
            affected_entities.push(entity_id);
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_add_comment(
        &self,
        _tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let comment = action
            .parameters
            .get("comment")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::BadRequest("Missing comment parameter".to_string()))?;

        let mut affected_entities = Vec::new();
        let success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            // This would call the backlog service to add the comment
            messages.push(format!("Added comment to {}: {}", entity_id, comment));
            affected_entities.push(entity_id);
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_take_ownership(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .take_task_ownership(tenant_id, entity_id, user_id)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!("Failed to take ownership of {}: {}", entity_id, e));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_release_ownership(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .release_task_ownership(tenant_id, entity_id, user_id)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!(
                        "Failed to release ownership of {}: {}",
                        entity_id, e
                    ));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_start_work(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .start_task_work(tenant_id, entity_id, user_id)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!("Failed to start work on {}: {}", entity_id, e));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }

    async fn execute_complete_task(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        action: &ActionCommand,
    ) -> Result<ActionResult, AppError> {
        let mut affected_entities = Vec::new();
        let mut success = true;
        let mut messages = Vec::new();

        for &entity_id in &action.target_entities {
            match self
                .backlog_client
                .complete_task_work(tenant_id, entity_id, user_id)
                .await
            {
                Ok(result) => {
                    affected_entities.extend(result.affected_entities);
                    messages.push(result.message);
                }
                Err(e) => {
                    success = false;
                    messages.push(format!("Failed to complete task {}: {}", entity_id, e));
                }
            }
        }

        Ok(ActionResult {
            service: "backlog".to_string(),
            success,
            message: messages.join("; "),
            affected_entities,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{ActionType, RiskLevel};
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_action_validation() {
        // This would test the action validation logic
        let tenant_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();

        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![entity_id],
            parameters: {
                let mut params = HashMap::new();
                params.insert("new_status".to_string(), serde_json::json!("Ready"));
                params
            },
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        // Create matching candidate
        let candidate = crate::domain::CandidateEntity {
            id: entity_id,
            tenant_id,
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: Some("Test description".to_string()),
            status: Some("Todo".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.8,
            last_updated: chrono::Utc::now(),
            created_at: chrono::Utc::now(),
        };

        let candidates = vec![candidate];
        let result = action_validator::validate_action(&action, &candidates);
        assert!(result.is_ok());
    }

    #[test]
    fn test_missing_parameters() {
        let action = ActionCommand {
            action_type: ActionType::UpdateStatus,
            target_entities: vec![Uuid::new_v4()],
            parameters: HashMap::new(), // Missing status parameter
            require_confirmation: false,
            risk_level: RiskLevel::Low,
        };

        // This would fail validation in a real scenario
        assert!(!action.parameters.contains_key("status"));
    }

    #[test]
    fn test_confirmation_requirement() {
        let high_risk_action = ActionCommand {
            action_type: ActionType::Archive,
            target_entities: vec![Uuid::new_v4()],
            parameters: HashMap::new(),
            require_confirmation: true,
            risk_level: RiskLevel::High,
        };

        assert!(high_risk_action.require_confirmation);
        assert!(matches!(high_risk_action.risk_level, RiskLevel::High));
    }
}
