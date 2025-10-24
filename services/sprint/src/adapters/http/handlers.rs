use crate::SprintsUsecases;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub async fn get_active_sprint(
    Path(project_id): Path<Uuid>,
    State(usecases): State<Arc<SprintsUsecases>>,
) -> Result<impl IntoResponse, AppError> {
    let sprint = usecases.get_active_sprint(project_id).await?;
    Ok(Json(sprint))
}
