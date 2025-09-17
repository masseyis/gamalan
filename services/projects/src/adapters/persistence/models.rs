use crate::domain::project::{DorTemplate, EstimationScale, Project, ProjectSettings};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
pub struct ProjectDb {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ProjectDb> for Project {
    fn from(project_db: ProjectDb) -> Self {
        Self {
            id: project_db.id,
            organization_id: project_db.organization_id,
            name: project_db.name,
            description: project_db.description,
            team_id: project_db.team_id,
            created_at: project_db.created_at,
            updated_at: project_db.updated_at,
        }
    }
}

#[derive(FromRow)]
pub struct ProjectSettingsDb {
    pub id: Uuid,
    pub project_id: Uuid,
    pub estimation_scale: String,
    pub dor_template: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TryFrom<ProjectSettingsDb> for ProjectSettings {
    type Error = serde_json::Error;

    fn try_from(settings_db: ProjectSettingsDb) -> Result<Self, Self::Error> {
        let estimation_scale = match settings_db.estimation_scale.as_str() {
            "fibonacci" => EstimationScale::Fibonacci,
            "power_of_two" => EstimationScale::PowerOfTwo,
            "linear" => EstimationScale::Linear,
            "t_shirt_sizes" => EstimationScale::TShirtSizes,
            _ => EstimationScale::Fibonacci, // Default fallback
        };

        let dor_template: DorTemplate = serde_json::from_value(settings_db.dor_template)?;

        Ok(Self {
            id: settings_db.id,
            project_id: settings_db.project_id,
            estimation_scale,
            dor_template,
            created_at: settings_db.created_at,
            updated_at: settings_db.updated_at,
        })
    }
}
