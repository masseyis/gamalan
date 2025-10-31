use crate::domain::{Sprint, TaskWithStory};
use common::AppError;
use sqlx::{PgPool, Row};
use tracing::error;
use uuid::Uuid;

pub async fn get_active_sprint(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Sprint>, AppError> {
    let sprint = sqlx::query_as::<_, Sprint>(
        "SELECT * FROM sprints WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "SQL error fetching active sprint");
        AppError::InternalServerError
    })?;

    Ok(sprint)
}

pub async fn get_sprint_by_id(pool: &PgPool, sprint_id: Uuid) -> Result<Option<Sprint>, AppError> {
    let sprint = sqlx::query_as::<_, Sprint>("SELECT * FROM sprints WHERE id = $1")
        .bind(sprint_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            error!(error = %e, "SQL error fetching sprint by id");
            AppError::InternalServerError
        })?;

    Ok(sprint)
}

/// Fetch all tasks from stories in the sprint with optional filters
/// Note: This queries the backlog database directly for read model purposes.
/// In a more mature architecture, this could be replaced with an API call or event-driven read model.
pub async fn get_sprint_tasks(
    pool: &PgPool,
    sprint_id: Uuid,
    status_filter: Option<String>,
    owner_filter: Option<Uuid>,
) -> Result<Vec<TaskWithStory>, AppError> {
    // Build dynamic query based on filters
    let mut query = String::from(
        "SELECT
            t.id as task_id,
            t.title,
            t.status,
            t.owner_user_id,
            t.story_id,
            s.title as story_title,
            t.acceptance_criteria_refs,
            t.estimated_hours,
            t.created_at,
            t.updated_at
         FROM tasks t
         INNER JOIN stories s ON t.story_id = s.id
         WHERE s.sprint_id = $1",
    );

    let mut param_count = 1;

    if status_filter.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND t.status = ${}", param_count));
    }

    if owner_filter.is_some() {
        param_count += 1;
        query.push_str(&format!(" AND t.owner_user_id = ${}", param_count));
    }

    query.push_str(" ORDER BY s.title, t.created_at");

    let mut db_query = sqlx::query(&query).bind(sprint_id);

    if let Some(status) = status_filter.as_ref() {
        db_query = db_query.bind(status);
    }

    if let Some(owner) = owner_filter {
        db_query = db_query.bind(owner);
    }

    let rows = db_query.fetch_all(pool).await.map_err(|e| {
        error!(error = %e, "SQL error fetching sprint tasks");
        AppError::InternalServerError
    })?;

    let tasks: Vec<TaskWithStory> = rows
        .iter()
        .map(|row| {
            let ac_refs: Vec<String> = row
                .try_get("acceptance_criteria_refs")
                .unwrap_or_else(|_| Vec::new());

            TaskWithStory {
                task_id: row.get("task_id"),
                title: row.get("title"),
                status: row.get("status"),
                owner_user_id: row.get("owner_user_id"),
                owner_name: None, // Will be populated by joining with users table in future
                story_id: row.get("story_id"),
                story_title: row.get("story_title"),
                acceptance_criteria_refs: ac_refs,
                estimated_hours: row.get("estimated_hours"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }
        })
        .collect();

    Ok(tasks)
}

/// Count unique stories in the sprint
pub async fn count_sprint_stories(pool: &PgPool, sprint_id: Uuid) -> Result<usize, AppError> {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(DISTINCT id) FROM stories WHERE sprint_id = $1")
            .bind(sprint_id)
            .fetch_one(pool)
            .await
            .map_err(|e| {
                error!(error = %e, "SQL error counting sprint stories");
                AppError::InternalServerError
            })?;

    Ok(count as usize)
}
