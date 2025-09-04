use crate::application::ports::{AcceptanceCriterion, ReadinessEvaluation, ReadinessService};
use async_trait::async_trait;
use common::AppError;
use serde::Deserialize;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AcceptanceCriterionResponse {
    id: Uuid,
    #[serde(rename = "storyId")]
    story_id: Uuid,
    ac_id: String,
    given: String,
    when: String,
    then: String,
}

#[derive(Debug, Deserialize)]
struct ReadinessEvaluationResponse {
    score: i32,
    #[serde(rename = "missingItems")]
    missing_items: Vec<String>,
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
    async fn get_acceptance_criteria(
        &self,
        story_id: Uuid,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        let url = format!("{}/criteria/{}", self.base_url, story_id);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if !response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let criteria: Vec<AcceptanceCriterionResponse> = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(criteria
            .into_iter()
            .map(|c| AcceptanceCriterion {
                ac_id: c.ac_id,
                given: c.given,
                when: c.when,
                then: c.then,
            })
            .collect())
    }

    async fn evaluate_readiness(&self, story_id: Uuid) -> Result<ReadinessEvaluation, AppError> {
        let url = format!("{}/readiness/{}/evaluate", self.base_url, story_id);
        let response = self
            .client
            .post(&url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if !response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let evaluation: ReadinessEvaluationResponse = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(ReadinessEvaluation {
            score: evaluation.score,
            missing_items: evaluation.missing_items,
        })
    }
}
