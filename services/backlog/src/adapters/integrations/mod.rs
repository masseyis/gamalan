pub mod readiness_client;

pub use readiness_client::*;

#[cfg(test)]
pub struct MockReadinessService;

#[cfg(test)]
impl MockReadinessService {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(test)]
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
