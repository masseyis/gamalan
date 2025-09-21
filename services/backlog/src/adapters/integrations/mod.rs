pub mod readiness_client;

pub use readiness_client::*;

pub struct MockReadinessService;

impl Default for MockReadinessService {
    fn default() -> Self {
        Self::new()
    }
}

impl MockReadinessService {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl crate::application::ports::ReadinessService for MockReadinessService {
    async fn validate_acceptance_criteria_refs(
        &self,
        _story_id: uuid::Uuid,
        ac_refs: &[String],
    ) -> Result<Vec<String>, common::AppError> {
        // Return all refs as valid for testing
        Ok(ac_refs.to_vec())
    }
}
