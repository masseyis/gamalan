use crate::application::ReadinessUsecases;
use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use auth_clerk::organization::AuthenticatedWithOrg;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct AddCriteriaRequest {
    pub criteria: Vec<CriterionRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CriterionRequest {
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

#[derive(Debug, Serialize)]
pub struct AcceptanceCriterionResponse {
    pub id: Uuid,
    pub story_id: Uuid,
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

impl From<AcceptanceCriterion> for AcceptanceCriterionResponse {
    fn from(criterion: AcceptanceCriterion) -> Self {
        Self {
            id: criterion.id,
            story_id: criterion.story_id,
            ac_id: criterion.ac_id,
            given: criterion.given,
            when: criterion.when,
            then: criterion.then,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ReadinessEvaluationResponse {
    pub score: i32,
    #[serde(rename = "missingItems")]
    pub missing_items: Vec<String>,
    pub recommendations: Vec<String>,
    pub summary: String,
    #[serde(rename = "isReady")]
    pub is_ready: bool,
}

impl From<ReadinessEvaluation> for ReadinessEvaluationResponse {
    fn from(eval: ReadinessEvaluation) -> Self {
        let is_ready = eval.is_ready();
        let ReadinessEvaluation {
            score,
            missing_items,
            recommendations,
            summary,
            ..
        } = eval;

        Self {
            score,
            missing_items,
            recommendations,
            summary,
            is_ready,
        }
    }
}

pub async fn evaluate_readiness(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<ReadinessUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let organization_id = auth.org_context.effective_organization_uuid();
    let evaluation = usecases
        .evaluate_story_readiness(story_id, organization_id)
        .await?;
    Ok(Json(ReadinessEvaluationResponse::from(evaluation)))
}

pub async fn generate_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<ReadinessUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let organization_id = auth.org_context.effective_organization_uuid();
    let criteria = usecases
        .generate_acceptance_criteria(story_id, organization_id)
        .await?;
    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn get_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<ReadinessUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let organization_id = auth.org_context.effective_organization_uuid();
    let criteria = usecases
        .get_criteria_for_story(story_id, organization_id)
        .await?;
    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn add_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<ReadinessUsecases>>,
    Json(payload): Json<AddCriteriaRequest>,
) -> Result<impl IntoResponse, AppError> {
    let organization_id = auth.org_context.effective_organization_uuid();
    let criteria_tuples: Vec<(String, String, String, String)> = payload
        .criteria
        .into_iter()
        .map(|c| (c.ac_id, c.given, c.when, c.then))
        .collect();

    let criteria = usecases
        .add_acceptance_criteria(story_id, organization_id, criteria_tuples)
        .await?;
    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();

    Ok((StatusCode::CREATED, Json(responses)))
}
