use crate::adapters::persistence::models::{ProjectDb, ProjectSettingsDb};
use crate::application::ports::{ProjectRepository, ProjectSettingsRepository};
use crate::domain::project::{
    CreateProjectRequest, DorTemplate, EstimationScale, Project, ProjectSettings,
    UpdateProjectRequest, UpdateProjectSettingsRequest,
};
use async_trait::async_trait;
use chrono::Utc;
use common::AppError;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ProjectRepositoryImpl {
    pool: PgPool,
}

impl ProjectRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProjectRepository for ProjectRepositoryImpl {
    async fn create_project(
        &self,
        request: &CreateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError> {
        let now = Utc::now();
        let project_id = Uuid::new_v4();

        // Start transaction
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        // Create project
        let project_db = sqlx::query_as::<_, ProjectDb>(
            r#"
            INSERT INTO projects (id, organization_id, name, description, team_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
        .bind(project_id)
        .bind(organization_id)
        .bind(&request.name)
        .bind(&request.description)
        .bind(request.team_id)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create project: {}", e);
            AppError::InternalServerError
        })?;

        // Create default project settings
        let estimation_scale = request
            .estimation_scale
            .as_ref()
            .unwrap_or(&EstimationScale::Fibonacci);
        let default_dor_template = DorTemplate::default();
        let dor_template = request
            .dor_template
            .as_ref()
            .unwrap_or(&default_dor_template);

        let estimation_scale_str = match estimation_scale {
            EstimationScale::Fibonacci => "fibonacci",
            EstimationScale::PowerOfTwo => "power_of_two",
            EstimationScale::Linear => "linear",
            EstimationScale::TShirtSizes => "t_shirt_sizes",
        };

        sqlx::query(
            r#"
            INSERT INTO project_settings (project_id, estimation_scale, dor_template, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(project_id)
        .bind(estimation_scale_str)
        .bind(serde_json::to_value(dor_template).unwrap())
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create project settings: {}", e);
            AppError::InternalServerError
        })?;

        // Commit transaction
        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(project_db.into())
    }

    async fn get_project_by_id(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Project>, AppError> {
        let project_db = sqlx::query_as::<_, ProjectDb>(
            r#"
            SELECT * FROM projects
            WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(project_db.map(Into::into))
    }

    async fn list_projects(
        &self,
        organization_id: Option<Uuid>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<Project>, AppError> {
        let limit = limit.unwrap_or(50).min(100); // Cap at 100
        let offset = offset.unwrap_or(0);

        let projects_db = sqlx::query_as::<_, ProjectDb>(
            r#"
            SELECT * FROM projects
            WHERE (organization_id = $1 OR ($1 IS NULL AND organization_id IS NULL))
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(organization_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(projects_db.into_iter().map(Into::into).collect())
    }

    async fn update_project(
        &self,
        id: &Uuid,
        request: &UpdateProjectRequest,
        organization_id: Option<Uuid>,
    ) -> Result<Project, AppError> {
        let now = Utc::now();

        let project_db = sqlx::query_as::<_, ProjectDb>(
            r#"
            UPDATE projects
            SET name = COALESCE($3, name),
                description = COALESCE($4, description),
                team_id = COALESCE($5, team_id),
                updated_at = $6
            WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .bind(&request.name)
        .bind(&request.description)
        .bind(request.team_id)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update project: {}", e);
            AppError::InternalServerError
        })?;

        Ok(project_db.into())
    }

    async fn delete_project(
        &self,
        id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let result = sqlx::query(
            r#"
            DELETE FROM projects
            WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
            "#,
        )
        .bind(id)
        .bind(organization_id)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound("Project not found".to_string()));
        }

        Ok(())
    }
}

pub struct ProjectSettingsRepositoryImpl {
    pool: PgPool,
}

impl ProjectSettingsRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProjectSettingsRepository for ProjectSettingsRepositoryImpl {
    async fn get_settings_by_project_id(
        &self,
        project_id: &Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ProjectSettings>, AppError> {
        let settings_db = sqlx::query_as::<_, ProjectSettingsDb>(
            r#"
            SELECT ps.* FROM project_settings ps
            INNER JOIN projects p ON ps.project_id = p.id
            WHERE ps.project_id = $1 AND (p.organization_id = $2 OR ($2 IS NULL AND p.organization_id IS NULL))
            "#,
        )
        .bind(project_id)
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        match settings_db {
            Some(settings) => settings
                .try_into()
                .map(Some)
                .map_err(|_| AppError::InternalServerError),
            None => Ok(None),
        }
    }

    async fn update_settings(
        &self,
        project_id: &Uuid,
        request: &UpdateProjectSettingsRequest,
        organization_id: Option<Uuid>,
    ) -> Result<ProjectSettings, AppError> {
        let now = Utc::now();

        // First verify the project exists and belongs to the organization
        let _project_exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(
                SELECT 1 FROM projects
                WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
            )
            "#,
        )
        .bind(project_id)
        .bind(organization_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        if !_project_exists {
            return Err(AppError::NotFound("Project not found".to_string()));
        }

        // Prepare updates
        let estimation_scale_str = request.estimation_scale.as_ref().map(|scale| match scale {
            EstimationScale::Fibonacci => "fibonacci",
            EstimationScale::PowerOfTwo => "power_of_two",
            EstimationScale::Linear => "linear",
            EstimationScale::TShirtSizes => "t_shirt_sizes",
        });

        let dor_template_json = request
            .dor_template
            .as_ref()
            .map(|template| serde_json::to_value(template).unwrap());

        let settings_db = sqlx::query_as::<_, ProjectSettingsDb>(
            r#"
            UPDATE project_settings
            SET estimation_scale = COALESCE($2, estimation_scale),
                dor_template = COALESCE($3, dor_template),
                updated_at = $4
            WHERE project_id = $1
            RETURNING *
            "#,
        )
        .bind(project_id)
        .bind(estimation_scale_str)
        .bind(dor_template_json)
        .bind(now)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update project settings: {}", e);
            AppError::InternalServerError
        })?;

        settings_db
            .try_into()
            .map_err(|_| AppError::InternalServerError)
    }
}
