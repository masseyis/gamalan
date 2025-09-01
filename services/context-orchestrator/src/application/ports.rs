use crate::domain::{CandidateEntity, ContextSnapshot, IntentRecord};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

#[async_trait]
pub trait IntentHistoryRepository: Send + Sync {
    async fn record_intent(&self, intent: &IntentRecord) -> Result<(), AppError>;
    async fn get_recent_intents(
        &self,
        user_id: Uuid,
        limit: usize,
    ) -> Result<Vec<IntentRecord>, AppError>;
    async fn get_intent_analytics(
        &self,
        tenant_id: Uuid,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<IntentAnalytics, AppError>;
}

#[async_trait]
pub trait RateLimitRepository: Send + Sync {
    async fn get_rate_limit_bucket(
        &self,
        user_id: Uuid,
        resource_type: &str,
    ) -> Result<Option<RateLimitBucket>, AppError>;

    async fn update_rate_limit_bucket(
        &self,
        user_id: Uuid,
        resource_type: &str,
        token_count: i32,
        last_refill: DateTime<Utc>,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait VectorSearchRepository: Send + Sync {
    async fn search_similar(
        &self,
        embedding: Vec<f32>,
        tenant_id: Uuid,
        entity_types: Option<Vec<String>>,
        limit: usize,
        similarity_threshold: Option<f32>,
    ) -> Result<Vec<CandidateEntity>, AppError>;

    async fn get_entity_count(
        &self,
        tenant_id: Uuid,
        entity_types: Option<Vec<String>>,
    ) -> Result<u64, AppError>;

    async fn delete_entity(&self, entity_id: Uuid, tenant_id: Uuid) -> Result<bool, AppError>;

    async fn health_check(&self) -> Result<(), AppError> {
        // Default implementation - can be overridden
        Ok(())
    }
}

#[async_trait]
pub trait ContextSnapshotRepository: Send + Sync {
    async fn save_context_snapshot(&self, snapshot: &ContextSnapshot) -> Result<(), AppError>;

    async fn get_recent_context_snapshots(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        limit: i32,
    ) -> Result<Vec<ContextSnapshot>, AppError>;
}

#[async_trait]
pub trait AuditLogRepository: Send + Sync {
    async fn record_action_audit(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        action_type: &str,
        target_entities: &[Uuid],
        parameters: Option<&Value>,
        success: bool,
        error_message: Option<&str>,
        execution_duration: Option<std::time::Duration>,
        rollback_token: Option<Uuid>,
    ) -> Result<(), AppError>;

    async fn get_action_audit_history(
        &self,
        tenant_id: Uuid,
        user_id: Option<Uuid>,
        limit: i32,
    ) -> Result<Vec<ActionLogEntry>, AppError>;
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, AppError>;

    async fn parse_intent(
        &self,
        utterance: &str,
        context: &[CandidateEntity],
        system_prompt: &str,
    ) -> Result<LlmResponse, AppError>;

    async fn health_check(&self) -> Result<(), AppError>;
}

#[async_trait]
pub trait ServiceClient: Send + Sync {
    async fn health_check(&self) -> Result<(), AppError>;
}

#[async_trait]
pub trait BacklogServiceClient: ServiceClient + Send + Sync {
    async fn update_story_status(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
        status: &str,
    ) -> Result<ServiceResult, AppError>;

    async fn create_task(
        &self,
        tenant_id: Uuid,
        task_data: CreateTaskRequest,
    ) -> Result<ServiceResult, AppError>;

    async fn assign_task(
        &self,
        tenant_id: Uuid,
        task_id: Uuid,
        user_id: Uuid,
    ) -> Result<ServiceResult, AppError>;

    async fn update_priority(
        &self,
        tenant_id: Uuid,
        item_id: Uuid,
        priority: u32,
    ) -> Result<ServiceResult, AppError>;
}

#[async_trait]
pub trait PromptBuilderServiceClient: ServiceClient + Send + Sync {
    async fn get_context_prompt(
        &self,
        tenant_id: Uuid,
        entity_ids: &[Uuid],
    ) -> Result<String, AppError>;

    async fn generate_task_pack(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ServiceResult, AppError>;
}

#[async_trait]
pub trait ReadinessServiceClient: ServiceClient + Send + Sync {
    async fn check_story_readiness(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ReadinessResult, AppError>;

    async fn mark_story_ready(
        &self,
        tenant_id: Uuid,
        story_id: Uuid,
    ) -> Result<ServiceResult, AppError>;
}

// Supporting types
#[derive(Debug, Clone)]
pub struct IntentAnalytics {
    pub total_intents: i64,
    pub avg_llm_confidence: f32,
    pub avg_service_confidence: f32,
    pub intent_type_distribution: HashMap<String, i64>,
    pub date_range: (DateTime<Utc>, DateTime<Utc>),
}

#[derive(Debug, Clone)]
pub struct RateLimitBucket {
    pub user_id: Uuid,
    pub resource_type: String,
    pub token_count: i32,
    pub last_refill: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ActionLogEntry {
    pub action_type: String,
    pub target_entities: Vec<Uuid>,
    pub parameters: Option<Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub execution_duration_ms: Option<i32>,
    pub rollback_token: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub struct LlmResponse {
    pub intent_type: String,
    pub entities: Vec<EntityReference>,
    pub parameters: HashMap<String, Value>,
    pub confidence: f32,
}

#[derive(Debug, Clone)]
pub struct EntityReference {
    pub entity_id: Uuid,
    pub entity_type: String,
    pub role: String,
}

#[derive(Debug, Clone)]
pub struct ServiceResult {
    pub success: bool,
    pub message: String,
    pub affected_entities: Vec<Uuid>,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub story_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria: Option<Vec<String>>,
    pub priority: Option<u32>,
    pub estimated_hours: Option<f32>,
}

#[derive(Debug, Clone)]
pub struct ReadinessResult {
    pub is_ready: bool,
    pub missing_criteria: Vec<String>,
    pub readiness_score: f32,
    pub blockers: Vec<String>,
}

// Health check helpers
pub async fn check_repository_health<T: IntentHistoryRepository>(repo: &T) -> Result<(), AppError> {
    // Try a simple query to test connectivity
    repo.get_recent_intents(Uuid::new_v4(), 1).await.map(|_| ())
}

pub async fn check_all_service_health(
    backlog_client: &dyn BacklogServiceClient,
    prompt_builder_client: &dyn PromptBuilderServiceClient,
    readiness_client: &dyn ReadinessServiceClient,
) -> Result<HashMap<String, bool>, AppError> {
    let mut results = HashMap::new();

    results.insert(
        "backlog".to_string(),
        backlog_client.health_check().await.is_ok(),
    );
    results.insert(
        "prompt_builder".to_string(),
        prompt_builder_client.health_check().await.is_ok(),
    );
    results.insert(
        "readiness".to_string(),
        readiness_client.health_check().await.is_ok(),
    );

    Ok(results)
}
