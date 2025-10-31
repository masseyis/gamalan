use crate::SprintsUsecases;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use common::AppError;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

pub async fn get_active_sprint(
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<SprintsUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let sprint = usecases.get_active_sprint(project_id).await?;
    Ok(Json(sprint))
}

#[derive(Debug, Deserialize)]
pub struct SprintTaskBoardQuery {
    /// Filter by task status (available, owned, inprogress, completed)
    pub status: Option<String>,
    /// Filter by task owner user ID
    pub owner_id: Option<Uuid>,
    /// Group tasks by: story or status
    pub group_by: Option<String>,
}

/// GET /api/v1/sprints/{sprint_id}/tasks
/// Returns all tasks from all stories in the sprint with optional filters
pub async fn get_sprint_task_board(
    Path(sprint_id): Path<Uuid>,
    Query(query): Query<SprintTaskBoardQuery>,
    State(usecases): State<Arc<SprintsUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let response = usecases
        .get_sprint_task_board(sprint_id, query.status, query.owner_id, query.group_by)
        .await?;

    Ok(Json(response))
}
