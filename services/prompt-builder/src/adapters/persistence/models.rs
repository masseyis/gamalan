use crate::domain::{AcceptanceCriteriaMap, PlanPack, ProposedTask, TaskPack};
use common::AppError;
use serde_json;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct PlanPackRow {
    pub id: Uuid,
    pub story_id: Uuid,
    pub acceptance_criteria_map: serde_json::Value,
    pub proposed_tasks: serde_json::Value,
    pub architecture_impact: Option<String>,
    pub risks: Vec<String>,
    pub unknowns: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<PlanPackRow> for PlanPack {
    type Error = AppError;

    fn try_from(row: PlanPackRow) -> Result<Self, Self::Error> {
        let acceptance_criteria_map: AcceptanceCriteriaMap =
            serde_json::from_value(row.acceptance_criteria_map)
                .map_err(|_| AppError::InternalServerError)?;

        let proposed_tasks: Vec<ProposedTask> = serde_json::from_value(row.proposed_tasks)
            .map_err(|_| AppError::InternalServerError)?;

        Ok(PlanPack {
            id: row.id,
            story_id: row.story_id,
            acceptance_criteria_map,
            proposed_tasks,
            architecture_impact: row.architecture_impact,
            risks: row.risks,
            unknowns: row.unknowns,
            created_at: row.created_at,
        })
    }
}

#[derive(Debug, FromRow)]
pub struct TaskPackRow {
    pub id: Uuid,
    pub task_id: Uuid,
    pub plan_pack_id: Option<Uuid>,
    pub objectives: String,
    pub non_goals: serde_json::Value,
    pub story_context: String,
    pub acceptance_criteria_covered: serde_json::Value,
    pub constraints: serde_json::Value,
    pub test_plan: serde_json::Value,
    pub do_not_list: serde_json::Value,
    pub commit_plan: serde_json::Value,
    pub run_instructions: serde_json::Value,
    pub markdown_content: String,
    pub json_content: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<TaskPackRow> for TaskPack {
    type Error = AppError;

    fn try_from(row: TaskPackRow) -> Result<Self, Self::Error> {
        use crate::domain::{
            AcceptanceCriterionCoverage, CommitPlan, DoNotList, TaskConstraints, TestPlan,
        };

        let non_goals: Vec<String> =
            serde_json::from_value(row.non_goals).map_err(|_| AppError::InternalServerError)?;

        let acceptance_criteria_covered: Vec<AcceptanceCriterionCoverage> =
            serde_json::from_value(row.acceptance_criteria_covered)
                .map_err(|_| AppError::InternalServerError)?;

        let constraints: TaskConstraints =
            serde_json::from_value(row.constraints).map_err(|_| AppError::InternalServerError)?;

        let test_plan: TestPlan =
            serde_json::from_value(row.test_plan).map_err(|_| AppError::InternalServerError)?;

        let do_not_list: DoNotList =
            serde_json::from_value(row.do_not_list).map_err(|_| AppError::InternalServerError)?;

        let commit_plan: CommitPlan =
            serde_json::from_value(row.commit_plan).map_err(|_| AppError::InternalServerError)?;

        let run_instructions: Vec<String> = serde_json::from_value(row.run_instructions)
            .map_err(|_| AppError::InternalServerError)?;

        Ok(TaskPack {
            id: row.id,
            task_id: row.task_id,
            plan_pack_id: row.plan_pack_id,
            objectives: row.objectives,
            non_goals,
            story_context: row.story_context,
            acceptance_criteria_covered,
            constraints,
            test_plan,
            do_not_list,
            commit_plan,
            run_instructions,
            markdown_content: row.markdown_content,
            json_content: row.json_content,
            created_at: row.created_at,
        })
    }
}
