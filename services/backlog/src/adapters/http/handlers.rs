use crate::application::BacklogUsecases;
use crate::domain::{Story, StoryStatus, Task};
use auth_clerk::Authenticated;
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
}

impl From<Task> for TaskResponse {
    fn from(task: Task) -> Self {
        Self {
            id: task.id,
            story_id: task.story_id,
            title: task.title,
            description: task.description,
            acceptance_criteria_refs: task.acceptance_criteria_refs,
        }
    }
}

pub async fn create_story(
    _auth: Authenticated,
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<CreateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    let story_id = usecases
        .create_story(
            project_id,
            payload.title,
            payload.description,
            payload.labels.unwrap_or_default(),
        )
        .await?;

    Ok((StatusCode::CREATED, Json(CreateStoryResponse { story_id })))
}

pub async fn get_story(
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let story = usecases
        .get_story(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", id)))?;

    Ok(Json(StoryResponse::from(story)))
}

pub async fn update_story(
    _auth: Authenticated,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<UpdateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    usecases
        .update_story(id, payload.title, payload.description, payload.labels)
        .await?;

    Ok(StatusCode::OK)
}

pub async fn create_task(
    _auth: Authenticated,
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<impl IntoResponse, AppError> {
    let task_id = usecases
        .create_task(
            story_id,
            payload.title,
            payload.description,
            payload.acceptance_criteria_refs,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(CreateTaskResponse { task_id })))
}

pub async fn get_tasks_by_story(
    Path(story_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let tasks = usecases.get_tasks_by_story(story_id).await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

pub async fn update_story_status(
    _auth: Authenticated,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
    Json(payload): Json<UpdateStoryStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let status = StoryStatus::from_str(&payload.status)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid status: {}", payload.status)))?;

    usecases.update_story_status(id, status).await?;
    Ok(StatusCode::OK)
}

pub async fn delete_story(
    _auth: Authenticated,
    Path(id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    usecases.delete_story(id).await?;
    Ok(StatusCode::OK)
}

pub async fn get_stories_by_project(
    _auth: Authenticated,
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<BacklogUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let stories = usecases.get_stories_by_project(project_id).await?;
    let story_responses: Vec<StoryResponse> =
        stories.into_iter().map(StoryResponse::from).collect();
    Ok(Json(story_responses))
}

pub async fn health() -> impl IntoResponse {
    "OK"
}
