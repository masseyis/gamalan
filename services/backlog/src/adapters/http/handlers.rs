use crate::adapters::http::BacklogAppState;
use crate::domain::{AcceptanceCriteria, Story, StoryStatus, Task, TaskEvent, TaskStatus};
use auth_clerk::AuthenticatedWithOrg;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

fn resolve_user_uuid(subject: &str) -> Uuid {
    Uuid::parse_str(subject)
        .unwrap_or_else(|_| Uuid::new_v5(&Uuid::NAMESPACE_URL, subject.as_bytes()))
}

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
    #[serde(rename = "storyPoints")]
    pub story_points: Option<u32>,
    pub labels: Option<Vec<String>>,
    #[serde(rename = "sprintId")]
    pub sprint_id: Option<Option<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoryStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct OverrideStoryReadyRequest {
    pub reason: Option<String>,
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

#[derive(Debug, Deserialize)]
pub struct UpdateTaskStatusRequest {
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct TaskOwnershipResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct StoriesQuery {
    pub status: Option<String>,
    #[serde(rename = "sprintId")]
    pub sprint_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAcceptanceCriterionRequest {
    pub given: String,
    pub when: String,
    pub then: String,
}

#[derive(Debug, Serialize)]
pub struct CreateAcceptanceCriterionResponse {
    pub criterion_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAcceptanceCriterionRequest {
    pub given: Option<String>,
    pub when: Option<String>,
    pub then: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AcceptanceCriterionResponse {
    pub id: Uuid,
    #[serde(rename = "storyId")]
    pub story_id: Uuid,
    pub description: String,
    pub given: String,
    #[serde(rename = "whenClause")]
    pub when_clause: String,
    #[serde(rename = "thenClause")]
    pub then_clause: String,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<(AcceptanceCriteria, Uuid)> for AcceptanceCriterionResponse {
    fn from((criteria, story_id): (AcceptanceCriteria, Uuid)) -> Self {
        Self {
            id: criteria.id,
            story_id,
            description: criteria.description,
            given: criteria.given,
            when_clause: criteria.when,
            then_clause: criteria.then,
            created_at: criteria.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StoryResponse {
    pub id: Uuid,
    #[serde(rename = "projectId")]
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub labels: Vec<String>,
    #[serde(rename = "storyPoints")]
    pub story_points: Option<u32>,
    #[serde(rename = "sprintId")]
    pub sprint_id: Option<Uuid>,
    #[serde(rename = "assignedToUserId")]
    pub assigned_to_user_id: Option<Uuid>,
    #[serde(rename = "readinessOverride")]
    pub readiness_override: bool,
    #[serde(rename = "readinessOverrideBy")]
    pub readiness_override_by: Option<Uuid>,
    #[serde(rename = "readinessOverrideReason")]
    pub readiness_override_reason: Option<String>,
    #[serde(rename = "readinessOverrideAt")]
    pub readiness_override_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "acceptanceCriteria")]
    pub acceptance_criteria: Vec<AcceptanceCriterionResponse>,
}

impl From<Story> for StoryResponse {
    fn from(story: Story) -> Self {
        let Story {
            id,
            project_id,
            organization_id: _,
            title,
            description,
            status,
            labels,
            acceptance_criteria,
            story_points,
            sprint_id,
            assigned_to_user_id,
            readiness_override,
            readiness_override_by,
            readiness_override_reason,
            readiness_override_at,
            created_at,
            updated_at,
        } = story;

        let acceptance_criteria = acceptance_criteria
            .into_iter()
            .map(|criteria| AcceptanceCriterionResponse::from((criteria, id)))
            .collect();

        Self {
            id,
            project_id,
            title,
            description,
            status: status.to_string(),
            labels,
            story_points,
            sprint_id,
            assigned_to_user_id,
            readiness_override,
            readiness_override_by,
            readiness_override_reason,
            readiness_override_at,
            created_at,
            updated_at,
            acceptance_criteria,
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
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(project_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<CreateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%project_id, org_id = ?org_id, user_id = %auth.sub, "Creating story");

    let result = state
        .usecases
        .create_story(
            project_id,
            org_id,
            payload.title,
            payload.description,
            payload.labels.unwrap_or_default(),
        )
        .await;

    match result {
        Ok(story_id) => {
            info!(%project_id, %story_id, org_id = ?org_id, user_id = %auth.sub, "Story created");
            Ok((StatusCode::CREATED, Json(CreateStoryResponse { story_id })))
        }
        Err(err) => {
            error!(%project_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to create story");
            Err(err)
        }
    }
}

pub async fn get_story(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%id, org_id = ?org_id, user_id = %auth.sub, "Fetching story");

    let result = state.usecases.get_story(id, org_id).await;

    match result {
        Ok(Some(story)) => {
            info!(%id, org_id = ?org_id, user_id = %auth.sub, "Story fetched");
            Ok(Json(StoryResponse::from(story)))
        }
        Ok(None) => {
            info!(%id, org_id = ?org_id, user_id = %auth.sub, "Story not found");
            Err(AppError::NotFound(format!(
                "Story with id {} not found",
                id
            )))
        }
        Err(err) => {
            error!(%id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to fetch story");
            Err(err)
        }
    }
}

pub async fn update_story(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<UpdateStoryRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%id, org_id = ?org_id, user_id = %auth.sub, "Updating story");

    let result = state
        .usecases
        .update_story(
            id,
            org_id,
            payload.title,
            Some(payload.description),
            payload.labels,
            payload.story_points,
            payload.sprint_id,
        )
        .await;

    match result {
        Ok(_) => {
            info!(%id, org_id = ?org_id, user_id = %auth.sub, "Story updated");
            Ok(StatusCode::OK)
        }
        Err(err) => {
            error!(%id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to update story");
            Err(err)
        }
    }
}

pub async fn override_story_ready(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<OverrideStoryReadyRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    let user_id = resolve_user_uuid(&auth.sub);

    let story = state
        .usecases
        .override_story_ready(id, org_id, user_id, payload.reason)
        .await?;

    Ok(Json(StoryResponse::from(story)))
}

pub async fn create_task(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%story_id, org_id = ?org_id, user_id = %auth.sub, "Creating task");

    let result = state
        .usecases
        .create_task(
            story_id,
            org_id,
            payload.title,
            payload.description,
            payload.acceptance_criteria_refs,
        )
        .await;

    match result {
        Ok(task_id) => {
            info!(%story_id, %task_id, org_id = ?org_id, user_id = %auth.sub, "Task created");
            Ok((StatusCode::CREATED, Json(CreateTaskResponse { task_id })))
        }
        Err(err) => {
            error!(%story_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to create task");
            Err(err)
        }
    }
}

pub async fn get_tasks_by_story(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%story_id, org_id = ?org_id, user_id = %auth.sub, "Fetching tasks for story");

    let result = state.usecases.get_tasks_by_story(story_id, org_id).await;

    match result {
        Ok(tasks) => {
            let count = tasks.len();
            info!(%story_id, org_id = ?org_id, user_id = %auth.sub, task_count = count, "Tasks fetched");
            let task_responses: Vec<TaskResponse> =
                tasks.into_iter().map(TaskResponse::from).collect();
            Ok(Json(task_responses))
        }
        Err(err) => {
            error!(%story_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to fetch tasks for story");
            Err(err)
        }
    }
}

pub async fn get_available_tasks(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let tasks = state
        .usecases
        .get_available_tasks(story_id, org_context.effective_organization_uuid())
        .await?;
    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

pub async fn get_user_owned_tasks(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    let tasks = state
        .usecases
        .get_user_owned_tasks(user_id, org_context.effective_organization_uuid())
        .await?;

    let task_responses: Vec<TaskResponse> = tasks.into_iter().map(TaskResponse::from).collect();
    Ok(Json(task_responses))
}

#[derive(Debug, serde::Deserialize)]
pub struct GetRecommendedTasksQuery {
    pub sprint_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub story_ids: Option<String>, // Comma-separated UUIDs
    pub role: Option<String>,
    pub exclude_mine: Option<bool>,
    pub limit: Option<usize>,
}

#[derive(Debug, serde::Serialize)]
pub struct TaskRecommendationResponse {
    pub task: TaskResponse,
    pub score: f64,
    pub reason: String,
}

pub async fn get_recommended_tasks(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Query(query): Query<GetRecommendedTasksQuery>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    use crate::domain::RecommendationFilters;

    let user_id = resolve_user_uuid(&auth.sub);

    // Parse story_ids if provided
    let story_ids = if let Some(ids_str) = query.story_ids {
        let parsed_ids: Result<Vec<Uuid>, _> = ids_str
            .split(',')
            .map(|s| s.trim().parse::<Uuid>())
            .collect();

        match parsed_ids {
            Ok(ids) => Some(ids),
            Err(_) => {
                return Err(AppError::BadRequest(
                    "Invalid story_ids format. Expected comma-separated UUIDs.".to_string(),
                ))
            }
        }
    } else {
        None
    };

    let filters = RecommendationFilters {
        sprint_id: query.sprint_id,
        project_id: query.project_id,
        story_ids,
        role: query.role,
        exclude_user_id: if query.exclude_mine.unwrap_or(false) {
            Some(user_id)
        } else {
            None
        },
        limit: query.limit,
    };

    let recommendations = state
        .usecases
        .get_recommended_tasks(filters, org_context.effective_organization_uuid())
        .await?;

    let responses: Vec<TaskRecommendationResponse> = recommendations
        .into_iter()
        .map(|rec| TaskRecommendationResponse {
            task: TaskResponse::from(rec.task),
            score: rec.score,
            reason: rec.reason,
        })
        .collect();

    Ok(Json(responses))
}

pub async fn take_task_ownership(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    let task = state
        .usecases
        .take_task_ownership(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    // Broadcast WebSocket event for real-time updates
    let event = TaskEvent::OwnershipTaken {
        task_id,
        story_id: task.story_id,
        owner_user_id: user_id,
        timestamp: chrono::Utc::now(),
    };
    state.ws_manager.broadcast(event);

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
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    let task = state
        .usecases
        .release_task_ownership(task_id, org_context.effective_organization_uuid(), user_id)
        .await?;

    // Broadcast WebSocket event for real-time updates
    // Note: task.owner_user_id contains the previous owner from the usecase
    if let Some(previous_owner_user_id) = task.owner_user_id {
        let event = TaskEvent::OwnershipReleased {
            task_id,
            story_id: task.story_id,
            previous_owner_user_id,
            timestamp: chrono::Utc::now(),
        };
        state.ws_manager.broadcast(event);
    }

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
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    state
        .usecases
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
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    state
        .usecases
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
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<SetTaskEstimateRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = resolve_user_uuid(&auth.sub);

    state
        .usecases
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

pub async fn update_task_status(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<UpdateTaskStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    let user_id = resolve_user_uuid(&auth.sub);

    let status = TaskStatus::from_str(&payload.status)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid status: {}", payload.status)))?;

    info!(%task_id, org_id = ?org_id, user_id = %auth.sub, status = %status, "Updating task status");

    // Get the old task to capture previous status
    let old_task = state
        .usecases
        .get_task(task_id, org_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;
    let old_status = old_task.status.to_string();

    let result = state
        .usecases
        .update_task_status(task_id, org_id, user_id, status)
        .await;

    match result {
        Ok(task) => {
            info!(%task_id, org_id = ?org_id, user_id = %auth.sub, "Task status updated");

            // Broadcast WebSocket event for real-time updates
            let event = TaskEvent::StatusChanged {
                task_id,
                story_id: task.story_id,
                old_status,
                new_status: task.status.to_string(),
                changed_by_user_id: user_id,
                timestamp: chrono::Utc::now(),
            };
            state.ws_manager.broadcast(event);

            Ok(Json(TaskResponse::from(task)))
        }
        Err(err) => {
            error!(%task_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to update task status");
            Err(err)
        }
    }
}

pub async fn update_story_status(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<UpdateStoryStatusRequest>,
) -> Result<impl IntoResponse, AppError> {
    let status = StoryStatus::from_str(&payload.status)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid status: {}", payload.status)))?;

    let org_id = org_context.effective_organization_uuid();
    info!(%id, org_id = ?org_id, user_id = %auth.sub, status = %status, "Updating story status");

    let result = state.usecases.update_story_status(id, org_id, status).await;

    match result {
        Ok(_) => {
            info!(%id, org_id = ?org_id, user_id = %auth.sub, "Story status updated");
            Ok(StatusCode::OK)
        }
        Err(err) => {
            error!(%id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to update story status");
            Err(err)
        }
    }
}

pub async fn delete_story(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%id, org_id = ?org_id, user_id = %auth.sub, "Deleting story");

    let result = state.usecases.delete_story(id, org_id).await;

    match result {
        Ok(_) => {
            info!(%id, org_id = ?org_id, user_id = %auth.sub, "Story deleted");
            Ok(StatusCode::OK)
        }
        Err(err) => {
            error!(%id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to delete story");
            Err(err)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateSprintRequest {
    pub name: String,
    pub goal: String,
    pub stories: Vec<Uuid>,
    #[serde(default)]
    pub capacity_points: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct CreateSprintResponse {
    pub sprint_id: Uuid,
}

pub async fn create_sprint(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(project_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<CreateSprintRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%project_id, org_id = ?org_id, user_id = %auth.sub, "Creating sprint");

    let result = state
        .usecases
        .create_sprint(
            project_id,
            org_id,
            payload.name,
            payload.goal,
            payload.stories,
            payload.capacity_points,
        )
        .await;

    match result {
        Ok(sprint_id) => {
            info!(%project_id, %sprint_id, org_id = ?org_id, user_id = %auth.sub, "Sprint created");
            Ok((
                StatusCode::CREATED,
                Json(CreateSprintResponse { sprint_id }),
            ))
        }
        Err(err) => {
            error!(%project_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to create sprint");
            Err(err)
        }
    }
}

pub async fn get_stories_by_project(
    AuthenticatedWithOrg { org_context, auth }: AuthenticatedWithOrg,
    Path(project_id): Path<Uuid>,
    Query(query): Query<StoriesQuery>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = org_context.effective_organization_uuid();
    info!(%project_id, org_id = ?org_id, user_id = %auth.sub, "Fetching project stories");

    let status_filter = if let Some(ref value) = query.status {
        match StoryStatus::from_str(value) {
            Some(status) => Some(status),
            None => {
                return Err(AppError::BadRequest(format!(
                    "Invalid status filter: {}",
                    value
                )))
            }
        }
    } else {
        None
    };

    let result = state
        .usecases
        .get_stories_by_project(project_id, org_id, status_filter, query.sprint_id)
        .await;

    match result {
        Ok(stories) => {
            let count = stories.len();
            info!(%project_id, org_id = ?org_id, user_id = %auth.sub, story_count = count, "Fetched project stories");
            let story_responses: Vec<StoryResponse> =
                stories.into_iter().map(StoryResponse::from).collect();
            Ok(Json(story_responses))
        }
        Err(err) => {
            error!(%project_id, org_id = ?org_id, user_id = %auth.sub, error = %err, "Failed to fetch project stories");
            Err(err)
        }
    }
}

pub async fn get_acceptance_criteria(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let criteria = state
        .usecases
        .get_acceptance_criteria(story_id, org_context.effective_organization_uuid())
        .await?;
    let criteria_responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(|c| AcceptanceCriterionResponse::from((c, story_id)))
        .collect();
    Ok(Json(criteria_responses))
}

pub async fn create_acceptance_criterion(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<CreateAcceptanceCriterionRequest>,
) -> Result<impl IntoResponse, AppError> {
    let criterion_id = state
        .usecases
        .create_acceptance_criterion(
            story_id,
            org_context.effective_organization_uuid(),
            payload.given,
            payload.when,
            payload.then,
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateAcceptanceCriterionResponse { criterion_id }),
    ))
}

pub async fn update_acceptance_criterion(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path((story_id, criterion_id)): Path<(Uuid, Uuid)>,
    State(state): State<Arc<BacklogAppState>>,
    Json(payload): Json<UpdateAcceptanceCriterionRequest>,
) -> Result<impl IntoResponse, AppError> {
    state
        .usecases
        .update_acceptance_criterion(
            criterion_id,
            story_id,
            org_context.effective_organization_uuid(),
            payload.given,
            payload.when,
            payload.then,
        )
        .await?;

    Ok(StatusCode::OK)
}

pub async fn delete_acceptance_criterion(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path((story_id, criterion_id)): Path<(Uuid, Uuid)>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    state
        .usecases
        .delete_acceptance_criterion(
            criterion_id,
            story_id,
            org_context.effective_organization_uuid(),
        )
        .await?;
    Ok(StatusCode::OK)
}

// Sprint Task Board DTOs and Handler

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SprintTaskBoardResponse {
    pub sprint: SprintMetadata,
    pub tasks: Vec<SprintTaskView>,
    pub groups: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SprintMetadata {
    pub id: Uuid,
    pub name: String,
    pub goal: String,
    pub start_date: chrono::DateTime<chrono::Utc>,
    pub end_date: chrono::DateTime<chrono::Utc>,
    pub days_remaining: i64,
    pub status: String,
    pub total_stories: i64,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub progress_percentage: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SprintTaskView {
    pub id: Uuid,
    pub story_id: Uuid,
    pub story_title: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub owner_user_id: Option<Uuid>,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SprintTaskBoardQuery {
    pub status: Option<String>,
    #[serde(rename = "groupBy")]
    pub group_by: Option<String>,
}

pub async fn get_sprint_task_board(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Path(sprint_id): Path<Uuid>,
    Query(query): Query<SprintTaskBoardQuery>,
    State(state): State<Arc<BacklogAppState>>,
) -> Result<impl IntoResponse, AppError> {
    let response = state
        .usecases
        .get_sprint_task_board(
            sprint_id,
            org_context.effective_organization_uuid(),
            query.status,
            query.group_by,
        )
        .await?;

    Ok(Json(response))
}
