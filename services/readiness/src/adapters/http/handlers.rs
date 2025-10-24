use crate::application::ReadinessUsecases;
use crate::domain::{AcceptanceCriterion, ReadinessEvaluation};
use crate::rebuild_projections;
use auth_clerk::organization::AuthenticatedWithOrg;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use common::AppError;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Clone)]
pub struct ReadinessAppState {
    pub usecases: Arc<ReadinessUsecases>,
    pub pool: Arc<PgPool>,
}

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
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Evaluating story readiness"
    );

    let evaluation = match usecases
        .evaluate_story_readiness(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            warn!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Story readiness evaluation failed"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        score = evaluation.score,
        missing_items = evaluation.missing_items.len(),
        "Story readiness evaluation completed"
    );

    Ok(Json(ReadinessEvaluationResponse::from(evaluation)))
}

pub async fn generate_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Generating acceptance criteria"
    );

    let criteria = match usecases
        .generate_acceptance_criteria(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Acceptance criteria generation failed"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        org_id = ?organization_id,
        generated = criteria.len(),
        "Generated acceptance criteria"
    );

    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn get_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Fetching acceptance criteria"
    );

    let criteria = match usecases
        .get_criteria_for_story(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to fetch acceptance criteria"
            );
            return Err(err);
        }
    };

    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn add_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    Json(payload): Json<AddCriteriaRequest>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
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

pub async fn rehydrate_projections(
    AuthenticatedWithOrg { .. }: AuthenticatedWithOrg,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    rebuild_projections(state.pool.clone()).await;
    Ok(StatusCode::ACCEPTED)
}
