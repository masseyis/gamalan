use crate::application::usecases::ProjectUsecases;
use crate::domain::project::{
    CreateProjectRequest, Project, ProjectSettings, UpdateProjectRequest,
    UpdateProjectSettingsRequest,
};
use auth_clerk::AuthenticatedWithOrg;
use axum::{
    extract::{Path, Query},
    http::StatusCode,
    Extension, Json,
};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ListProjectsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Project> for ProjectResponse {
    fn from(project: Project) -> Self {
        Self {
            id: project.id,
            organization_id: project.organization_id,
            name: project.name,
            description: project.description,
            team_id: project.team_id,
            created_at: project.created_at.to_rfc3339(),
            updated_at: project.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettingsResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub estimation_scale: String,
    pub dor_template: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ProjectSettings> for ProjectSettingsResponse {
    fn from(settings: ProjectSettings) -> Self {
        let estimation_scale = match settings.estimation_scale {
            crate::domain::project::EstimationScale::Fibonacci => "fibonacci",
            crate::domain::project::EstimationScale::PowerOfTwo => "power_of_two",
            crate::domain::project::EstimationScale::Linear => "linear",
            crate::domain::project::EstimationScale::TShirtSizes => "t_shirt_sizes",
        };

        Self {
            id: settings.id,
            project_id: settings.project_id,
            estimation_scale: estimation_scale.to_string(),
            dor_template: serde_json::to_value(settings.dor_template).unwrap(),
            created_at: settings.created_at.to_rfc3339(),
            updated_at: settings.updated_at.to_rfc3339(),
        }
    }
}

pub async fn create_project(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Json(request): Json<CreateProjectRequest>,
) -> Result<Json<ProjectResponse>, AppError> {
    let project = usecases
        .create_project(&request, org_context.effective_organization_uuid())
        .await?;

    Ok(Json(project.into()))
}

pub async fn get_projects(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Query(query): Query<ListProjectsQuery>,
) -> Result<Json<Vec<ProjectResponse>>, AppError> {
    let projects = usecases
        .list_projects(
            org_context.effective_organization_uuid(),
            query.limit,
            query.offset,
        )
        .await?;

    let response: Vec<ProjectResponse> = projects.into_iter().map(Into::into).collect();
    Ok(Json(response))
}

pub async fn get_project(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectResponse>, AppError> {
    let project = usecases
        .get_project(&project_id, org_context.effective_organization_uuid())
        .await?
        .ok_or(AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(project.into()))
}

pub async fn update_project(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Path(project_id): Path<Uuid>,
    Json(request): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, AppError> {
    let project = usecases
        .update_project(
            &project_id,
            &request,
            org_context.effective_organization_uuid(),
        )
        .await?;

    Ok(Json(project.into()))
}

pub async fn delete_project(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Path(project_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    usecases
        .delete_project(&project_id, org_context.effective_organization_uuid())
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_project_settings(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<ProjectSettingsResponse>, AppError> {
    let settings = usecases
        .get_project_settings(&project_id, org_context.effective_organization_uuid())
        .await?
        .ok_or(AppError::NotFound("Project settings not found".to_string()))?;

    Ok(Json(settings.into()))
}

pub async fn update_project_settings(
    AuthenticatedWithOrg { org_context, .. }: AuthenticatedWithOrg,
    Extension(usecases): Extension<Arc<ProjectUsecases>>,
    Path(project_id): Path<Uuid>,
    Json(request): Json<UpdateProjectSettingsRequest>,
) -> Result<Json<ProjectSettingsResponse>, AppError> {
    let settings = usecases
        .update_project_settings(
            &project_id,
            &request,
            org_context.effective_organization_uuid(),
        )
        .await?;

    Ok(Json(settings.into()))
}
