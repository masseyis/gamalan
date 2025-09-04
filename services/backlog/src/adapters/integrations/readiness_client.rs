use crate::application::ports::ReadinessService;
use async_trait::async_trait;
use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Serialize)]
struct ValidateAcRefsRequest {
    acceptance_criteria_refs: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ValidateAcRefsResponse {
    invalid_refs: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AcceptanceCriterion {
    ac_id: String,
    given: String,
    when: String,
    then: String,
}

pub struct HttpReadinessService {
    client: reqwest::Client,
    base_url: String,
}

impl HttpReadinessService {
    pub fn new(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url,
        }
    }
}

#[async_trait]
impl ReadinessService for HttpReadinessService {
    async fn validate_acceptance_criteria_refs(
        &self,
        story_id: Uuid,
        ac_refs: &[String],
    ) -> Result<Vec<String>, AppError> {
        // First, get all acceptance criteria for the story
        let criteria_url = format!("{}/criteria/{}", self.base_url, story_id);
        let criteria_response = self
            .client
            .get(&criteria_url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if !criteria_response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let criteria: Vec<AcceptanceCriterion> = criteria_response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        // Extract valid AC IDs
        let valid_ac_ids: std::collections::HashSet<String> =
            criteria.into_iter().map(|c| c.ac_id).collect();

        // Find invalid references
        let invalid_refs = ac_refs
            .iter()
            .filter(|ac_ref| !valid_ac_ids.contains(*ac_ref))
            .cloned()
            .collect();

        Ok(invalid_refs)
    }
}
