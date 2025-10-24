use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub organization_id: Option<Uuid>, // None for personal projects
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub id: Uuid,
    pub project_id: Uuid,
    pub estimation_scale: EstimationScale,
    pub dor_template: DorTemplate,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum EstimationScale {
    #[default]
    Fibonacci,
    PowerOfTwo,
    Linear,
    TShirtSizes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DorTemplate {
    pub required_fields: Vec<String>,
    pub acceptance_criteria_required: bool,
    pub story_points_required: bool,
    pub labels_required: Vec<String>,
}

impl Default for DorTemplate {
    fn default() -> Self {
        Self {
            required_fields: vec![
                "title".to_string(),
                "description".to_string(),
                "acceptance_criteria".to_string(),
            ],
            acceptance_criteria_required: true,
            story_points_required: false,
            labels_required: vec![],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
    pub estimation_scale: Option<EstimationScale>,
    pub dor_template: Option<DorTemplate>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub team_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateProjectSettingsRequest {
    pub estimation_scale: Option<EstimationScale>,
    pub dor_template: Option<DorTemplate>,
}
