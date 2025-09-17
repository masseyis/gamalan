use crate::domain::project::{
    CreateProjectRequest, Project, ProjectSettings, UpdateProjectRequest,
    UpdateProjectSettingsRequest,
};
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn create_project(
        &self,
        request: &CreateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError>;

    async fn get_project_by_id(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Project>, AppError>;

    async fn list_projects(
        &self,
        organization_id: Option<Uuid>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Project>, AppError>;

    async fn update_project(
        &self,
        id: &Uuid,
        request: &UpdateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError>;

    async fn delete_project(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError>;
}

#[async_trait]
pub trait ProjectSettingsRepository: Send + Sync {
    async fn get_settings_by_project_id(
        &self,
        project_id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ProjectSettings>, AppError>;

    async fn update_settings(
        &self,
        project_id: &Uuid,
        request: &UpdateProjectSettingsRequest,
        organization_id: Option<Uuid>,
    ) -> Result<ProjectSettings, AppError>;
}
