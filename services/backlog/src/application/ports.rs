use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait ReadinessService: Send + Sync {
    async fn validate_acceptance_criteria_refs(
        &self,
        story_id: Uuid,
        ac_refs: &[String],
    ) -> Result<Vec<String>, AppError>;
}
