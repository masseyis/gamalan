use crate::application::PromptBuilderUsecases;
use crate::domain::{PlanPack, TaskPack};
use auth_clerk::Authenticated;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use common::AppError;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct PlanPackResponse {
    pub id: Uuid,
    pub story_id: Uuid,
    pub acceptance_criteria_map: serde_json::Value,
    pub proposed_tasks: serde_json::Value,
    pub architecture_impact: Option<String>,
    pub risks: Vec<String>,
    pub unknowns: Vec<String>,
    pub created_at: String,
}

impl From<PlanPack> for PlanPackResponse {
    fn from(plan_pack: PlanPack) -> Self {
        Self {
            id: plan_pack.id,
            story_id: plan_pack.story_id,
            acceptance_criteria_map: serde_json::to_value(&plan_pack.acceptance_criteria_map)
                .unwrap_or_default(),
            proposed_tasks: serde_json::to_value(&plan_pack.proposed_tasks).unwrap_or_default(),
            architecture_impact: plan_pack.architecture_impact,
            risks: plan_pack.risks,
            unknowns: plan_pack.unknowns,
            created_at: plan_pack.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TaskPackResponse {
    pub id: Uuid,
    pub task_id: Uuid,
    pub plan_pack_id: Option<Uuid>,
    pub objectives: String,
    pub non_goals: Vec<String>,
    pub story_context: String,
    pub acceptance_criteria_covered: serde_json::Value,
    pub constraints: serde_json::Value,
    pub test_plan: serde_json::Value,
    pub do_not_list: serde_json::Value,
    pub commit_plan: serde_json::Value,
    pub run_instructions: Vec<String>,
    pub markdown_content: String,
    pub json_content: serde_json::Value,
    pub created_at: String,
}

impl From<TaskPack> for TaskPackResponse {
    fn from(task_pack: TaskPack) -> Self {
        Self {
            id: task_pack.id,
            task_id: task_pack.task_id,
            plan_pack_id: task_pack.plan_pack_id,
            objectives: task_pack.objectives,
            non_goals: task_pack.non_goals,
            story_context: task_pack.story_context,
            acceptance_criteria_covered: serde_json::to_value(
                &task_pack.acceptance_criteria_covered,
            )
            .unwrap_or_default(),
            constraints: serde_json::to_value(&task_pack.constraints).unwrap_or_default(),
            test_plan: serde_json::to_value(&task_pack.test_plan).unwrap_or_default(),
            do_not_list: serde_json::to_value(&task_pack.do_not_list).unwrap_or_default(),
            commit_plan: serde_json::to_value(&task_pack.commit_plan).unwrap_or_default(),
            run_instructions: task_pack.run_instructions,
            markdown_content: task_pack.markdown_content,
            json_content: task_pack.json_content,
            created_at: task_pack.created_at.to_rfc3339(),
        }
    }
}

pub async fn generate_plan_pack_from_story(
    _auth: Authenticated,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let plan_pack = usecases.generate_plan_pack(story_id).await?;
    Ok((StatusCode::CREATED, Json(PlanPackResponse::from(plan_pack))))
}

pub async fn get_plan_pack_by_story(
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let plan_pack = usecases
        .get_plan_pack(story_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Plan Pack for story {} not found", story_id)))?;

    Ok(Json(PlanPackResponse::from(plan_pack)))
}

pub async fn regenerate_plan_pack(
    _auth: Authenticated,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let plan_pack = usecases.regenerate_plan_pack(story_id).await?;
    Ok(Json(PlanPackResponse::from(plan_pack)))
}

pub async fn generate_task_pack_from_task(
    _auth: Authenticated,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let task_pack = usecases.generate_task_pack(task_id).await?;
    Ok((StatusCode::CREATED, Json(TaskPackResponse::from(task_pack))))
}

pub async fn get_task_pack_by_task(
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let task_pack = usecases
        .get_task_pack(task_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task Pack for task {} not found", task_id)))?;

    Ok(Json(TaskPackResponse::from(task_pack)))
}

pub async fn get_task_pack_markdown(
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let task_pack = usecases
        .get_task_pack(task_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task Pack for task {} not found", task_id)))?;

    let mut headers = HeaderMap::new();
    headers.insert(
        "content-type",
        HeaderValue::from_static("text/markdown; charset=utf-8"),
    );

    Ok((headers, task_pack.markdown_content))
}

pub async fn get_task_pack_json(
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let task_pack = usecases
        .get_task_pack(task_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Task Pack for task {} not found", task_id)))?;

    Ok(Json(task_pack.json_content))
}

pub async fn regenerate_task_pack(
    _auth: Authenticated,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<PromptBuilderUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let task_pack = usecases.regenerate_task_pack(task_id).await?;
    Ok(Json(TaskPackResponse::from(task_pack)))
}
