use crate::adapters::persistence::models::{PlanPackRow, TaskPackRow};
use crate::application::ports::{PlanPackRepository, TaskPackRepository};
use crate::domain::{PlanPack, TaskPack};
use async_trait::async_trait;
use common::AppError;
use serde_json;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn save_plan_pack(pool: &PgPool, plan_pack: &PlanPack) -> Result<(), AppError> {
    let ac_map_json = serde_json::to_value(&plan_pack.acceptance_criteria_map)
        .map_err(|_| AppError::InternalServerError)?;

    let tasks_json = serde_json::to_value(&plan_pack.proposed_tasks)
        .map_err(|_| AppError::InternalServerError)?;

    sqlx::query(
        "INSERT INTO plan_packs (id, story_id, acceptance_criteria_map, proposed_tasks, \
         architecture_impact, risks, unknowns, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (story_id) DO UPDATE SET \
         acceptance_criteria_map = EXCLUDED.acceptance_criteria_map, \
         proposed_tasks = EXCLUDED.proposed_tasks, \
         architecture_impact = EXCLUDED.architecture_impact, \
         risks = EXCLUDED.risks, \
         unknowns = EXCLUDED.unknowns",
    )
    .bind(plan_pack.id)
    .bind(plan_pack.story_id)
    .bind(ac_map_json)
    .bind(tasks_json)
    .bind(&plan_pack.architecture_impact)
    .bind(&plan_pack.risks)
    .bind(&plan_pack.unknowns)
    .bind(plan_pack.created_at)
    .execute(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    Ok(())
}

pub async fn get_plan_pack(pool: &PgPool, id: Uuid) -> Result<Option<PlanPack>, AppError> {
    let row = sqlx::query_as::<_, PlanPackRow>(
        "SELECT id, story_id, acceptance_criteria_map, proposed_tasks, \
         architecture_impact, risks, unknowns, created_at \
         FROM plan_packs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    match row {
        Some(row) => Ok(Some(row.try_into()?)),
        None => Ok(None),
    }
}

pub async fn get_plan_pack_by_story(
    pool: &PgPool,
    story_id: Uuid,
) -> Result<Option<PlanPack>, AppError> {
    let row = sqlx::query_as::<_, PlanPackRow>(
        "SELECT id, story_id, acceptance_criteria_map, proposed_tasks, \
         architecture_impact, risks, unknowns, created_at \
         FROM plan_packs WHERE story_id = $1",
    )
    .bind(story_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    match row {
        Some(row) => Ok(Some(row.try_into()?)),
        None => Ok(None),
    }
}

pub async fn delete_plan_pack(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    sqlx::query("DELETE FROM plan_packs WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

    Ok(())
}

pub async fn save_task_pack(pool: &PgPool, task_pack: &TaskPack) -> Result<(), AppError> {
    let non_goals_json =
        serde_json::to_value(&task_pack.non_goals).map_err(|_| AppError::InternalServerError)?;

    let ac_covered_json = serde_json::to_value(&task_pack.acceptance_criteria_covered)
        .map_err(|_| AppError::InternalServerError)?;

    let constraints_json =
        serde_json::to_value(&task_pack.constraints).map_err(|_| AppError::InternalServerError)?;

    let test_plan_json =
        serde_json::to_value(&task_pack.test_plan).map_err(|_| AppError::InternalServerError)?;

    let do_not_list_json =
        serde_json::to_value(&task_pack.do_not_list).map_err(|_| AppError::InternalServerError)?;

    let commit_plan_json =
        serde_json::to_value(&task_pack.commit_plan).map_err(|_| AppError::InternalServerError)?;

    let run_instructions_json = serde_json::to_value(&task_pack.run_instructions)
        .map_err(|_| AppError::InternalServerError)?;

    sqlx::query(
        "INSERT INTO task_packs (id, task_id, plan_pack_id, objectives, non_goals, \
         story_context, acceptance_criteria_covered, constraints, test_plan, do_not_list, \
         commit_plan, run_instructions, markdown_content, json_content, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
         ON CONFLICT (task_id) DO UPDATE SET \
         plan_pack_id = EXCLUDED.plan_pack_id, \
         objectives = EXCLUDED.objectives, \
         non_goals = EXCLUDED.non_goals, \
         story_context = EXCLUDED.story_context, \
         acceptance_criteria_covered = EXCLUDED.acceptance_criteria_covered, \
         constraints = EXCLUDED.constraints, \
         test_plan = EXCLUDED.test_plan, \
         do_not_list = EXCLUDED.do_not_list, \
         commit_plan = EXCLUDED.commit_plan, \
         run_instructions = EXCLUDED.run_instructions, \
         markdown_content = EXCLUDED.markdown_content, \
         json_content = EXCLUDED.json_content",
    )
    .bind(task_pack.id)
    .bind(task_pack.task_id)
    .bind(task_pack.plan_pack_id)
    .bind(&task_pack.objectives)
    .bind(non_goals_json)
    .bind(&task_pack.story_context)
    .bind(ac_covered_json)
    .bind(constraints_json)
    .bind(test_plan_json)
    .bind(do_not_list_json)
    .bind(commit_plan_json)
    .bind(run_instructions_json)
    .bind(&task_pack.markdown_content)
    .bind(&task_pack.json_content)
    .bind(task_pack.created_at)
    .execute(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    Ok(())
}

pub async fn get_task_pack(pool: &PgPool, id: Uuid) -> Result<Option<TaskPack>, AppError> {
    let row = sqlx::query_as::<_, TaskPackRow>(
        "SELECT id, task_id, plan_pack_id, objectives, non_goals, story_context, \
         acceptance_criteria_covered, constraints, test_plan, do_not_list, commit_plan, \
         run_instructions, markdown_content, json_content, created_at \
         FROM task_packs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    match row {
        Some(row) => Ok(Some(row.try_into()?)),
        None => Ok(None),
    }
}

pub async fn get_task_pack_by_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Option<TaskPack>, AppError> {
    let row = sqlx::query_as::<_, TaskPackRow>(
        "SELECT id, task_id, plan_pack_id, objectives, non_goals, story_context, \
         acceptance_criteria_covered, constraints, test_plan, do_not_list, commit_plan, \
         run_instructions, markdown_content, json_content, created_at \
         FROM task_packs WHERE task_id = $1",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| AppError::InternalServerError)?;

    match row {
        Some(row) => Ok(Some(row.try_into()?)),
        None => Ok(None),
    }
}

pub async fn delete_task_pack(pool: &PgPool, id: Uuid) -> Result<(), AppError> {
    sqlx::query("DELETE FROM task_packs WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

    Ok(())
}

#[async_trait]
impl PlanPackRepository for PgPool {
    async fn save_plan_pack(&self, plan_pack: &PlanPack) -> Result<(), AppError> {
        save_plan_pack(self, plan_pack).await
    }

    async fn get_plan_pack(&self, id: Uuid) -> Result<Option<PlanPack>, AppError> {
        get_plan_pack(self, id).await
    }

    async fn get_plan_pack_by_story(&self, story_id: Uuid) -> Result<Option<PlanPack>, AppError> {
        get_plan_pack_by_story(self, story_id).await
    }

    async fn delete_plan_pack(&self, id: Uuid) -> Result<(), AppError> {
        delete_plan_pack(self, id).await
    }
}

#[async_trait]
impl TaskPackRepository for PgPool {
    async fn save_task_pack(&self, task_pack: &TaskPack) -> Result<(), AppError> {
        save_task_pack(self, task_pack).await
    }

    async fn get_task_pack(&self, id: Uuid) -> Result<Option<TaskPack>, AppError> {
        get_task_pack(self, id).await
    }

    async fn get_task_pack_by_task(&self, task_id: Uuid) -> Result<Option<TaskPack>, AppError> {
        get_task_pack_by_task(self, task_id).await
    }

    async fn delete_task_pack(&self, id: Uuid) -> Result<(), AppError> {
        delete_task_pack(self, id).await
    }
}
