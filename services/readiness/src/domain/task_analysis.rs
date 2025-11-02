use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysis {
    pub id: Uuid,
    pub task_id: Uuid,
    pub story_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub clarity_score: i32,
    pub missing_elements: Vec<String>,
    pub summary: String,
}
