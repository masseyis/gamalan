use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GapType {
    MissingTechnicalDetails,
    VagueLanguage,
    MissingAcceptanceCriteria,
    MissingAiAgentCompatibility,
    MissingSuccessCriteria,
    MissingDependencies,
    MissingEnvironmentSetup,
    MissingTestCoverage,
    MissingDefinitionOfDone,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub gap_type: GapType,
    pub message: String,
    pub specific_suggestions: Vec<String>,
    pub ac_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysis {
    pub id: Uuid,
    pub task_id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub clarity_score: i32,
    pub missing_elements: Vec<String>,
    pub summary: String,
    pub recommendations: Vec<Recommendation>,
}
