use crate::application::BacklogUsecases;
use crate::domain::{Story, StoryStatus, Task};
use auth_clerk::AuthenticatedWithOrg;
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
pub struct CreateStoryRequest {
    pub title: String,
    pub description: Option<String>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct CreateStoryResponse {
    pub story_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoryRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoryStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub acceptance_criteria_refs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CreateTaskResponse {
    pub task_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SetTaskEstimateRequest {
    pub estimated_hours: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct TaskOwnershipResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct StoryResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub labels: Vec<String>,
}

impl From<Story> for StoryResponse {
    fn from(story: Story) -> Self {
        Self {
            id: story.id,
            project_id: story.project_id,
            title: story.title,
            description: story.description,
            status: story.status.to_string(),
            labels: story.labels,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TaskResponse {
    pub id: Uuid,
    pub story_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub acceptance_criteria_refs: Vec<String>,
    pub status: String,
    pub owner_user_id: Option<Uuid>,
    pub estimated_hours: Option<u32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub owned_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<Task> for TaskResponse {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            story_id: task.story_id,
            title: task.title,
            description: task.description,
            acceptance_criteria_refs: task.acceptance_criteria_refs,
            status: task.status.to_string(),
            owner_user_id: task.owner_user_id,
            estimated_hours: task.estimated_hours,
            created_at: task.created_at,
            updated_at: task.updated_at,
            owned_at: task.owned_at,
            completed_at: task.completed_at,
        }
    }
}

pub async fn create_story(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<CreateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    let story_id = usecases
        .create_story(
            project_id,
            org_context.effective_organization_uuid(),
            payload.title,
            payload.description,
            payload.labels.unwrap_or_default(),
        )
        .await?;

    Ok((StatusCode::CREATED, Json(CreateStoryResponse { story_id })))
}

pub async fn get_story(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let story = usecases
        .get_story(id, org_context.effective_organization_uuid())
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", id)))?;

    Ok(Json(StoryResponse::from(story)))
}

pub async fn update_story(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<UpdateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    usecases
        .update_story(
            id,
            org_context.effective_organization_uuid(),
            payload.title,
            payload.description,
            payload.labels,
        )
        .await?;

    Ok(StatusCode::OK)
}

pub async fn create_task(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<impl IntoResponse, AppError> {
    let task_id = usecases
        .create_task(
            story_id,
            org_context.effective_organization_uuid(),
            payload.title,
            payload.description,
            payload.acceptance_criteria_refs,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(CreateTaskResponse { task_id })))
}

pub async fn get_tasks_by_story(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let tasks = usecases
        .get_tasks_by_story(story_id, org_context.effective_organization_uuid())
        .await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

pub async fn get_available_tasks(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let tasks = usecases
        .get_available_tasks(story_id, org_context.effective_organization_uuid())
        .await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

pub async fn get_user_owned_tasks(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    let tasks = usecases
        .get_user_owned_tasks(user_id, org_context.effective_organization_uuid())
        .await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

pub async fn take_task_ownership(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    usecases
        .take_task_ownership(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(TaskOwnershipResponse {
            success: true,
            message: "Task ownership taken successfully".to_string(),
        }),
    ))
}

pub async fn release_task_ownership(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    usecases
        .release_task_ownership(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(TaskOwnershipResponse {
            success: true,
            message: "Task ownership released successfully".to_string(),
        }),
    ))
}

pub async fn start_task_work(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    usecases
        .start_task_work(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(TaskOwnershipResponse {
            success: true,
            message: "Task work started successfully".to_string(),
        }),
    ))
}

pub async fn complete_task_work(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    usecases
        .complete_task_work(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(TaskOwnershipResponse {
            success: true,
            message: "Task work completed successfully".to_string(),
        }),
    ))
}

pub async fn set_task_estimate(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<SetTaskEstimateRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = uuid::Uuid::parse_str(&auth.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

    usecases
        .set_task_estimate(
            task_id,
            org_context.effective_organization_uuid(),
            user_id,
            payload.estimated_hours,
        )
        .await?;

    Ok((
        StatusCode::OK,
        Json(TaskOwnershipResponse {
            success: true,
            message: "Task estimate updated successfully".to_string(),
        }),
    ))
}

pub async fn update_story_status(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<UpdateStoryStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let status = StoryStatus::from_str(&payload.status)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid status: {}", payload.status)))?;

    usecases
        .update_story_status(id, org_context.effective_organization_uuid(), status)
        .await?;
    Ok(StatusCode::OK)
}

pub async fn delete_story(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    usecases
        .delete_story(id, org_context.effective_organization_uuid())
        .await?;
    Ok(StatusCode::OK)
}

pub async fn get_stories_by_project(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let stories = usecases
        .get_stories_by_project(project_id, org_context.effective_organization_uuid())
        .await?;
    let story_responses: Vec<StoryResponse> =
        stories.into_iter().map(StoryResponse::from).collect();
    Ok(Json(story_responses))
}
