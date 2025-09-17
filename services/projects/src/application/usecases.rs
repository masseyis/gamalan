use crate::application::ports::{ProjectRepository, ProjectSettingsRepository};
use crate::domain::project::{
    CreateProjectRequest, Project, ProjectSettings, UpdateProjectRequest,
    UpdateProjectSettingsRequest,
};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct ProjectUsecases {
    project_repo: Arc<dyn ProjectRepository>,
    settings_repo: Arc<dyn ProjectSettingsRepository>,
}

impl ProjectUsecases {
    pub fn new(
        project_repo: Arc<dyn ProjectRepository>,
        settings_repo: Arc<dyn ProjectSettingsRepository>,
    ) -> Self {
        Self {
            project_repo,
            settings_repo,
        }
    }

    pub async fn create_project(
        &self,
        request: &CreateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError> {
        self.project_repo
            .create_project(request, organization_id)
            .await
    }

    pub async fn get_project(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Project>, AppError> {
        self.project_repo
            .get_project_by_id(id, organization_id)
            .await
    }

    pub async fn list_projects(
        &self,
        organization_id: Option<Uuid>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Project>, AppError> {
        self.project_repo
            .list_projects(organization_id, limit, offset)
            .await
    }

    pub async fn update_project(
        &self,
        id: &Uuid,
        request: &UpdateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError> {
        // First verify the project exists and belongs to the organization
        let _project = self
            .project_repo
            .get_project_by_id(id, organization_id)
            .await?
            .ok_or(AppError::NotFound("Project not found".to_string()))?;

        self.project_repo
            .update_project(id, request, organization_id)
            .await
    }

    pub async fn delete_project(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        // First verify the project exists and belongs to the organization
        let _project = self
            .project_repo
            .get_project_by_id(id, organization_id)
            .await?
            .ok_or(AppError::NotFound("Project not found".to_string()))?;

        self.project_repo.delete_project(id, organization_id).await
    }

    pub async fn get_project_settings(
        &self,
        project_id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ProjectSettings>, AppError> {
        // First verify the project exists and belongs to the organization
        let _project = self
            .project_repo
            .get_project_by_id(project_id, organization_id)
            .await?
            .ok_or(AppError::NotFound("Project not found".to_string()))?;

        self.settings_repo
            .get_settings_by_project_id(project_id, organization_id)
            .await
    }

    pub async fn update_project_settings(
        &self,
        project_id: &Uuid,
        request: &UpdateProjectSettingsRequest,
        organization_id: Option<Uuid>,
    ) -> Result<ProjectSettings, AppError> {
        // First verify the project exists and belongs to the organization
        let _project = self
            .project_repo
            .get_project_by_id(project_id, organization_id)
            .await?
            .ok_or(AppError::NotFound("Project not found".to_string()))?;

        self.settings_repo
            .update_settings(project_id, request, organization_id)
            .await
    }
}
