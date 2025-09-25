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
        // For testing, assume AC1, AC2, AC3 are valid - return empty vector for invalid refs
        let valid_refs = ["AC1", "AC2", "AC3"];
        let invalid = ac_refs
            .iter()
            .filter(|r| !valid_refs.contains(&r.as_str()))
            .cloned()
            .collect();
        Ok(invalid)
    }
}
