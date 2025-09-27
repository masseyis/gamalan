use async_trait::async_trait;
use common::AppError;
use context_orchestrator::application::ports::{
    ActionLogEntry, AuditLogRepository, BacklogServiceClient, CreateTaskRequest,
    PromptBuilderServiceClient, ReadinessResult, ReadinessServiceClient, ServiceClient,
    ServiceResult, VectorSearchRepository,
};
use context_orchestrator::application::use_cases::act_use_case::ActUseCase;
use context_orchestrator::domain::{ActionCommand, ActionType, CandidateEntity, RiskLevel};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

// Mock implementation for testing
#[derive(Clone)]
pub struct MockBacklogClient {
    pub should_succeed: bool,
    pub expected_calls: Arc<std::sync::Mutex<Vec<String>>>,
}

impl MockBacklogClient {
    pub fn new(should_succeed: bool) -> Self {
        Self {
            should_succeed,
            expected_calls: Arc::new(std::sync::Mutex::new(Vec::new())),
        }
    }

    fn record_call(&self, call: String) {
        self.expected_calls.lock().unwrap().push(call);
    }
}

#[async_trait]
impl ServiceClient for MockBacklogClient {
    async fn health_check(&self) -> Result<(), AppError> {
        Ok(())
    }
}

#[async_trait]
impl BacklogServiceClient for MockBacklogClient {
    async fn update_story_status(
        &self,
        _tenant_id: Uuid,
        _story_id: Uuid,
        _status: &str,
    ) -> Result<ServiceResult, AppError> {
        unimplemented!()
    }

    async fn create_task(
        &self,
        _tenant_id: Uuid,
        _task_data: CreateTaskRequest,
    ) -> Result<ServiceResult, AppError> {
        unimplemented!()
    }

    async fn assign_task(
        &self,
        _tenant_id: Uuid,
        _task_id: Uuid,
        _user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        self.record_call("assign_task".to_string());
        if self.should_succeed {
            Ok(ServiceResult {
                success: true,
                message: "Task assigned successfully".to_string(),
                affected_entities: vec![],
                data: None,
            })
        } else {
            Err(AppError::BadRequest("Assignment failed".to_string()))
        }
    }

    async fn take_task_ownership(
        &self,
        _tenant_id: Uuid,
        task_id: Uuid,
        _user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        self.record_call("take_task_ownership".to_string());
        if self.should_succeed {
            Ok(ServiceResult {
                success: true,
                message: "Ownership taken successfully".to_string(),
                affected_entities: vec![task_id],
                data: None,
            })
        } else {
            Err(AppError::BadRequest("Task already owned".to_string()))
        }
    }

    async fn release_task_ownership(
        &self,
        _tenant_id: Uuid,
        task_id: Uuid,
        _user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        self.record_call("release_task_ownership".to_string());
        if self.should_succeed {
            Ok(ServiceResult {
                success: true,
                message: "Ownership released successfully".to_string(),
                affected_entities: vec![task_id],
                data: None,
            })
        } else {
            Err(AppError::BadRequest(
                "User does not own this task".to_string(),
            ))
        }
    }

    async fn start_task_work(
        &self,
        _tenant_id: Uuid,
        task_id: Uuid,
        _user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        self.record_call("start_task_work".to_string());
        if self.should_succeed {
            Ok(ServiceResult {
                success: true,
                message: "Work started successfully".to_string(),
                affected_entities: vec![task_id],
                data: None,
            })
        } else {
            Err(AppError::BadRequest(
                "Cannot start work on unowned task".to_string(),
            ))
        }
    }

    async fn complete_task_work(
        &self,
        _tenant_id: Uuid,
        task_id: Uuid,
        _user_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        self.record_call("complete_task_work".to_string());
        if self.should_succeed {
            Ok(ServiceResult {
                success: true,
                message: "Task completed successfully".to_string(),
                affected_entities: vec![task_id],
                data: None,
            })
        } else {
            Err(AppError::BadRequest(
                "Cannot complete task not in progress".to_string(),
            ))
        }
    }

    async fn update_priority(
        &self,
        _tenant_id: Uuid,
        _item_id: Uuid,
        _priority: u32,
    ) -> Result<ServiceResult, AppError> {
        unimplemented!()
    }
}

// Mock implementations for other dependencies
struct MockAuditRepo;
struct MockVectorRepo;
struct MockPromptBuilderClient;
struct MockReadinessClient;

#[async_trait]
impl AuditLogRepository for MockAuditRepo {
    async fn record_action_audit(
        &self,
        _tenant_id: Uuid,
        _user_id: Uuid,
        _action_type: &str,
        _target_entities: &[Uuid],
        _parameters: Option<&Value>,
        _success: bool,
        _error_message: Option<&str>,
        _execution_duration: Option<std::time::Duration>,
        _rollback_token: Option<Uuid>,
    ) -> Result<(), AppError> {
        Ok(())
    }

    async fn get_action_audit_history(
        &self,
        _tenant_id: Uuid,
        _user_id: Option<Uuid>,
        _limit: i32,
    ) -> Result<Vec<ActionLogEntry>, AppError> {
        Ok(vec![])
    }
}

#[async_trait]
impl VectorSearchRepository for MockVectorRepo {
    async fn search_similar(
        &self,
        _embedding: Vec<f32>,
        tenant_id: Uuid,
        _entity_types: Option<Vec<String>>,
        _limit: usize,
        _similarity_threshold: Option<f32>,
    ) -> Result<Vec<CandidateEntity>, AppError> {
        // Return a mock candidate entity for testing
        Ok(vec![CandidateEntity {
            id: Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            tenant_id,
            entity_type: "task".to_string(),
            title: "Test Task".to_string(),
            description: Some("Test task description".to_string()),
            status: Some("available".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.9,
            last_updated: chrono::Utc::now(),
            created_at: chrono::Utc::now(),
        }])
    }

    async fn get_entity_count(
        &self,
        _tenant_id: Uuid,
        _entity_types: Option<Vec<String>>,
    ) -> Result<u64, AppError> {
        Ok(0)
    }

    async fn delete_entity(&self, _entity_id: Uuid, _tenant_id: Uuid) -> Result<bool, AppError> {
        Ok(true)
    }
}

#[async_trait]
impl ServiceClient for MockPromptBuilderClient {
    async fn health_check(&self) -> Result<(), AppError> {
        Ok(())
    }
}

#[async_trait]
impl PromptBuilderServiceClient for MockPromptBuilderClient {
    async fn get_context_prompt(
        &self,
        _tenant_id: Uuid,
        _entity_ids: &[Uuid],
    ) -> Result<String, AppError> {
        Ok("mock prompt".to_string())
    }

    async fn generate_task_pack(
        &self,
        _tenant_id: Uuid,
        _story_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        Ok(ServiceResult {
            success: true,
            message: "Task pack generated".to_string(),
            affected_entities: vec![],
            data: None,
        })
    }
}

#[async_trait]
impl ServiceClient for MockReadinessClient {
    async fn health_check(&self) -> Result<(), AppError> {
        Ok(())
    }
}

#[async_trait]
impl ReadinessServiceClient for MockReadinessClient {
    async fn check_story_readiness(
        &self,
        _tenant_id: Uuid,
        _story_id: Uuid,
    ) -> Result<ReadinessResult, AppError> {
        Ok(ReadinessResult {
            is_ready: true,
            missing_criteria: vec![],
            readiness_score: 1.0,
            blockers: vec![],
        })
    }

    async fn mark_story_ready(
        &self,
        _tenant_id: Uuid,
        _story_id: Uuid,
    ) -> Result<ServiceResult, AppError> {
        Ok(ServiceResult {
            success: true,
            message: "Story marked ready".to_string(),
            affected_entities: vec![],
            data: None,
        })
    }
}

#[tokio::test]
async fn test_take_ownership_workflow() {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let task_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let backlog_client = MockBacklogClient::new(true);
    let audit_repo = Arc::new(MockAuditRepo);
    let vector_repo = Arc::new(MockVectorRepo);
    let prompt_client = Arc::new(MockPromptBuilderClient);
    let readiness_client = Arc::new(MockReadinessClient);

    let use_case = ActUseCase::new(
        audit_repo,
        vector_repo,
        Arc::new(backlog_client.clone()),
        prompt_client,
        readiness_client,
    );

    let action = ActionCommand {
        action_type: ActionType::TakeOwnership,
        target_entities: vec![task_id],
        parameters: HashMap::new(),
        require_confirmation: false,
        risk_level: RiskLevel::Low,
    };

    let result = use_case
        .execute(user_id, tenant_id, action, None, false)
        .await
        .unwrap();

    assert!(result.success);
    assert_eq!(result.results.len(), 1);
    assert_eq!(result.results[0].service, "backlog");
    assert!(result.results[0].success);
    assert!(result.results[0].message.contains("successfully"));

    // Verify the correct method was called
    let calls = backlog_client.expected_calls.lock().unwrap();
    assert!(calls.contains(&"take_task_ownership".to_string()));
}

#[tokio::test]
async fn test_release_ownership_workflow() {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let task_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let backlog_client = MockBacklogClient::new(true);
    let audit_repo = Arc::new(MockAuditRepo);
    let vector_repo = Arc::new(MockVectorRepo);
    let prompt_client = Arc::new(MockPromptBuilderClient);
    let readiness_client = Arc::new(MockReadinessClient);

    let use_case = ActUseCase::new(
        audit_repo,
        vector_repo,
        Arc::new(backlog_client.clone()),
        prompt_client,
        readiness_client,
    );

    let action = ActionCommand {
        action_type: ActionType::ReleaseOwnership,
        target_entities: vec![task_id],
        parameters: HashMap::new(),
        require_confirmation: false,
        risk_level: RiskLevel::Low,
    };

    let result = use_case
        .execute(user_id, tenant_id, action, None, false)
        .await
        .unwrap();

    assert!(result.success);
    let calls = backlog_client.expected_calls.lock().unwrap();
    assert!(calls.contains(&"release_task_ownership".to_string()));
}

#[tokio::test]
async fn test_start_work_workflow() {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let task_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let backlog_client = MockBacklogClient::new(true);
    let audit_repo = Arc::new(MockAuditRepo);
    let vector_repo = Arc::new(MockVectorRepo);
    let prompt_client = Arc::new(MockPromptBuilderClient);
    let readiness_client = Arc::new(MockReadinessClient);

    let use_case = ActUseCase::new(
        audit_repo,
        vector_repo,
        Arc::new(backlog_client.clone()),
        prompt_client,
        readiness_client,
    );

    let action = ActionCommand {
        action_type: ActionType::StartWork,
        target_entities: vec![task_id],
        parameters: HashMap::new(),
        require_confirmation: false,
        risk_level: RiskLevel::Low,
    };

    let result = use_case
        .execute(user_id, tenant_id, action, None, false)
        .await
        .unwrap();

    assert!(result.success);
    let calls = backlog_client.expected_calls.lock().unwrap();
    assert!(calls.contains(&"start_task_work".to_string()));
}

#[tokio::test]
async fn test_complete_task_workflow() {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let task_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let backlog_client = MockBacklogClient::new(true);
    let audit_repo = Arc::new(MockAuditRepo);
    let vector_repo = Arc::new(MockVectorRepo);
    let prompt_client = Arc::new(MockPromptBuilderClient);
    let readiness_client = Arc::new(MockReadinessClient);

    let use_case = ActUseCase::new(
        audit_repo,
        vector_repo,
        Arc::new(backlog_client.clone()),
        prompt_client,
        readiness_client,
    );

    let action = ActionCommand {
        action_type: ActionType::CompleteTask,
        target_entities: vec![task_id],
        parameters: HashMap::new(),
        require_confirmation: false,
        risk_level: RiskLevel::Low,
    };

    let result = use_case
        .execute(user_id, tenant_id, action, None, false)
        .await
        .unwrap();

    assert!(result.success);
    let calls = backlog_client.expected_calls.lock().unwrap();
    assert!(calls.contains(&"complete_task_work".to_string()));
}

#[tokio::test]
async fn test_ownership_failure_handling() {
    let tenant_id = Uuid::new_v4();
    let user_id = Uuid::new_v4();
    let task_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

    let backlog_client = MockBacklogClient::new(false); // Will return errors
    let audit_repo = Arc::new(MockAuditRepo);
    let vector_repo = Arc::new(MockVectorRepo);
    let prompt_client = Arc::new(MockPromptBuilderClient);
    let readiness_client = Arc::new(MockReadinessClient);

    let use_case = ActUseCase::new(
        audit_repo,
        vector_repo,
        Arc::new(backlog_client.clone()),
        prompt_client,
        readiness_client,
    );

    let action = ActionCommand {
        action_type: ActionType::TakeOwnership,
        target_entities: vec![task_id],
        parameters: HashMap::new(),
        require_confirmation: false,
        risk_level: RiskLevel::Low,
    };

    let result = use_case
        .execute(user_id, tenant_id, action, None, false)
        .await
        .unwrap();

    assert!(!result.success);
    assert_eq!(result.results.len(), 1);
    assert!(!result.results[0].success);
    assert!(result.results[0]
        .message
        .contains("Failed to take ownership"));
}
