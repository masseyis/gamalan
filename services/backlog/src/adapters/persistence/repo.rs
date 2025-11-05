use crate::adapters::persistence::models::{AcceptanceCriteriaRow, ProjectRow, StoryRow, TaskRow};
use crate::domain::{AcceptanceCriteria, Project, Story, Task};
use common::AppError;
use sqlx::{PgPool, Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

pub async fn get_project(
    pool: &PgPool,
    id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<Project>, AppError> {
    let query = "SELECT id, name, description, team_id, organization_id, created_at, updated_at FROM projects
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $2) OR
             (organization_id IS NULL AND $2 IS NULL)
         ) AND deleted_at IS NULL";

    let fallback_query = "SELECT id, name, description, team_id, organization_id, created_at, updated_at FROM projects
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $2) OR
             (organization_id IS NULL AND $2 IS NULL)
         )";

    let project_row = match sqlx::query_as::<_, ProjectRow>(query)
        .bind(id)
        .bind(organization_id)
        .fetch_optional(pool)
        .await
    {
        Ok(row) => Ok(row),
        Err(err) => {
            if err
                .to_string()
                .contains("column \"deleted_at\" does not exist")
            {
                match sqlx::query_as::<_, ProjectRow>(fallback_query)
                    .bind(id)
                    .bind(organization_id)
                    .fetch_optional(pool)
                    .await
                {
                    Ok(row) => Ok(row),
                    Err(fallback_err) => {
                        tracing::error!(error = %fallback_err, "SQL error fetching project (fallback)");
                        Err(fallback_err)
                    }
                }
            } else {
                Err(err)
            }
        }
    }
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching project");
        AppError::InternalServerError
    })?;

    Ok(project_row.map(Project::from))
}

// Story persistence helpers
pub async fn create_story(pool: &PgPool, story: &Story) -> Result<Uuid, AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    sqlx::query(
        "INSERT INTO stories (id, project_id, organization_id, title, description, status, labels, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())",
    )
    .bind(story.id)
    .bind(story.project_id)
    .bind(story.organization_id)
    .bind(&story.title)
    .bind(&story.description)
    .bind(story.status.to_string())
    .bind(&story.labels)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error inserting story");
        AppError::InternalServerError
    })?;

    tx.commit()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    Ok(story.id)
}

pub async fn get_story(
    pool: &PgPool,
    id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<Story>, AppError> {
    let story_row = sqlx::query_as::<_, StoryRow>(
        "SELECT id, project_id, organization_id, title, description, status, labels, story_points, sprint_id, assigned_to_user_id, readiness_override, readiness_override_by, readiness_override_reason, readiness_override_at, created_at, updated_at FROM stories
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $2) OR
             (organization_id IS NULL AND $2 IS NULL)
         ) AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching story");
        AppError::InternalServerError
    })?;

    match story_row {
        Some(row) => {
            let mut story = Story::from(row);

            let acceptance_rows = sqlx::query_as::<_, AcceptanceCriteriaRow>(
                "SELECT id, story_id, ac_id, given, \"when\" AS when_clause, \"then\" AS then_clause, created_at
                 FROM acceptance_criteria
                 WHERE story_id = $1
                 ORDER BY created_at",
            )
            .bind(story.id)
            .fetch_all(pool)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "SQL error fetching acceptance criteria");
                AppError::InternalServerError
            })?;

            story.acceptance_criteria = acceptance_rows
                .into_iter()
                .map(AcceptanceCriteria::from)
                .collect();

            Ok(Some(story))
        }
        None => Ok(None),
    }
}

pub async fn update_story(pool: &PgPool, story: &Story) -> Result<(), AppError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    sqlx::query(
        "UPDATE stories SET title = $2, description = $3, status = $4, labels = $5, story_points = $6, sprint_id = $7, readiness_override = $8, readiness_override_by = $9, readiness_override_reason = $10, readiness_override_at = $11, updated_at = NOW()
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $12) OR
             (organization_id IS NULL AND $12 IS NULL)
         )",
    )
    .bind(story.id)
    .bind(&story.title)
    .bind(&story.description)
    .bind(story.status.to_string())
    .bind(&story.labels)
    .bind(story.story_points.map(|points| points as i32))
    .bind(story.sprint_id)
    .bind(story.readiness_override)
    .bind(story.readiness_override_by)
    .bind(&story.readiness_override_reason)
    .bind(story.readiness_override_at)
    .bind(story.organization_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error updating story");
        AppError::InternalServerError
    })?;

    sqlx::query("DELETE FROM acceptance_criteria WHERE story_id = $1")
        .bind(story.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error deleting acceptance criteria");
            AppError::InternalServerError
        })?;

    for ac in &story.acceptance_criteria {
        let ac_identifier = ac.id.to_string();
        sqlx::query(
            "INSERT INTO acceptance_criteria (id, story_id, organization_id, ac_id, given, \"when\", \"then\")
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(ac.id)
        .bind(story.id)
        .bind(story.organization_id)
        .bind(&ac_identifier)
        .bind(&ac.given)
        .bind(&ac.when)
        .bind(&ac.then)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error inserting acceptance criterion");
            AppError::InternalServerError
        })?;
    }

    tx.commit()
        .await
        .map_err(|_| AppError::InternalServerError)?;
    Ok(())
}

pub async fn update_story_with_transaction(
    tx: &mut Transaction<'_, Postgres>,
    story: &Story,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE stories SET title = $2, description = $3, status = $4, labels = $5, story_points = $6, sprint_id = $7, readiness_override = $8, readiness_override_by = $9, readiness_override_reason = $10, readiness_override_at = $11, updated_at = NOW()
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $12) OR
             (organization_id IS NULL AND $12 IS NULL)
         )",
    )
    .bind(story.id)
    .bind(&story.title)
    .bind(&story.description)
    .bind(story.status.to_string())
    .bind(&story.labels)
    .bind(story.story_points.map(|points| points as i32))
    .bind(story.sprint_id)
    .bind(story.readiness_override)
    .bind(story.readiness_override_by)
    .bind(&story.readiness_override_reason)
    .bind(story.readiness_override_at)
    .bind(story.organization_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error updating story");
        AppError::InternalServerError
    })?;

    sqlx::query("DELETE FROM acceptance_criteria WHERE story_id = $1")
        .bind(story.id)
        .execute(&mut **tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error deleting acceptance criteria");
            AppError::InternalServerError
        })?;

    for ac in &story.acceptance_criteria {
        let ac_identifier = ac.id.to_string();
        sqlx::query(
            "INSERT INTO acceptance_criteria (id, story_id, organization_id, ac_id, given, \"when\", \"then\")
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(ac.id)
        .bind(story.id)
        .bind(story.organization_id)
        .bind(&ac_identifier)
        .bind(&ac.given)
        .bind(&ac.when)
        .bind(&ac.then)
        .execute(&mut **tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error inserting acceptance criterion");
            AppError::InternalServerError
        })?;
    }

    Ok(())
}

pub async fn delete_story(
    pool: &PgPool,
    id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE stories SET deleted_at = NOW() WHERE id = $1 AND (
        (organization_id IS NOT NULL AND organization_id = $2) OR
        (organization_id IS NULL AND $2 IS NULL)
    )",
    )
    .bind(id)
    .bind(organization_id)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error deleting story");
        AppError::InternalServerError
    })?;
    Ok(())
}

pub async fn create_sprint(
    pool: &PgPool,
    project_id: Uuid,
    team_id: Uuid,
    organization_id: Option<Uuid>,
    name: String,
    goal: String,
    capacity_points: u32,
    status: &str,
    start_date: chrono::DateTime<chrono::Utc>,
    end_date: chrono::DateTime<chrono::Utc>,
    committed_points: u32,
    completed_points: u32,
) -> Result<Uuid, AppError> {
    let sprint_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO sprints (id, project_id, team_id, organization_id, name, goal, capacity_points, status, start_date, end_date, committed_points, completed_points, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())",
    )
    .bind(sprint_id)
    .bind(project_id)
    .bind(team_id)
    .bind(organization_id)
    .bind(name)
    .bind(goal)
    .bind(capacity_points as i32)
    .bind(status)
    .bind(start_date)
    .bind(end_date)
    .bind(committed_points as i32)
    .bind(completed_points as i32)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error creating sprint");
        AppError::InternalServerError
    })?;
    Ok(sprint_id)
}

pub async fn create_sprint_with_transaction(
    tx: &mut Transaction<'_, Postgres>,
    project_id: Uuid,
    team_id: Uuid,
    organization_id: Option<Uuid>,
    name: String,
    goal: String,
    capacity_points: u32,
    status: &str,
    start_date: chrono::DateTime<chrono::Utc>,
    end_date: chrono::DateTime<chrono::Utc>,
    committed_points: u32,
    completed_points: u32,
) -> Result<Uuid, AppError> {
    let sprint_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO sprints (id, project_id, team_id, organization_id, name, goal, capacity_points, status, start_date, end_date, committed_points, completed_points, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())",
    )
    .bind(sprint_id)
    .bind(project_id)
    .bind(team_id)
    .bind(organization_id)
    .bind(name)
    .bind(goal)
    .bind(capacity_points as i32)
    .bind(status)
    .bind(start_date)
    .bind(end_date)
    .bind(committed_points as i32)
    .bind(completed_points as i32)
    .execute(&mut **tx)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error creating sprint");
        AppError::InternalServerError
    })?;
    Ok(sprint_id)
}

pub async fn get_team_active_sprint(
    pool: &PgPool,
    team_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    #[derive(sqlx::FromRow)]
    struct TeamRow {
        active_sprint_id: Option<Uuid>,
    }

    let team_row = sqlx::query_as::<_, TeamRow>("SELECT active_sprint_id FROM teams WHERE id = $1")
        .bind(team_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error checking team active sprint");
            AppError::InternalServerError
        })?;

    match team_row {
        Some(row) => Ok(row.active_sprint_id),
        None => Err(AppError::NotFound("Team not found".to_string())),
    }
}

pub async fn set_team_active_sprint(
    pool: &PgPool,
    team_id: Uuid,
    sprint_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("UPDATE teams SET active_sprint_id = $2, updated_at = NOW() WHERE id = $1")
        .bind(team_id)
        .bind(sprint_id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error updating team active sprint");
            AppError::InternalServerError
        })?;

    Ok(())
}

pub async fn set_team_active_sprint_with_transaction(
    tx: &mut Transaction<'_, Postgres>,
    team_id: Uuid,
    sprint_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query("UPDATE teams SET active_sprint_id = $2, updated_at = NOW() WHERE id = $1")
        .bind(team_id)
        .bind(sprint_id)
        .execute(&mut **tx)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error updating team active sprint");
            AppError::InternalServerError
        })?;

    Ok(())
}

pub async fn update_sprint_committed_points(
    pool: &PgPool,
    sprint_id: Uuid,
    committed_points: u32,
) -> Result<(), AppError> {
    sqlx::query("UPDATE sprints SET committed_points = $2, updated_at = NOW() WHERE id = $1")
        .bind(sprint_id)
        .bind(committed_points as i32)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error updating sprint committed points");
            AppError::InternalServerError
        })?;

    Ok(())
}

pub async fn get_stories_by_project(
    pool: &PgPool,
    project_id: Uuid,
    organization_id: Option<Uuid>,
    sprint_id: Option<Uuid>,
) -> Result<Vec<Story>, AppError> {
    let story_rows = sqlx::query_as::<_, StoryRow>(
        "SELECT id, project_id, organization_id, title, description, status, labels, story_points, sprint_id, assigned_to_user_id, readiness_override, readiness_override_by, readiness_override_reason, readiness_override_at, created_at, updated_at FROM stories
         WHERE project_id = $1
           AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
           AND ($3::uuid IS NULL OR sprint_id = $3)
           AND deleted_at IS NULL
         ORDER BY title",
    )
    .bind(project_id)
    .bind(organization_id)
    .bind(sprint_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching stories by project");
        AppError::InternalServerError
    })?;

    let mut stories: Vec<Story> = story_rows.into_iter().map(Story::from).collect();
    let story_ids: Vec<Uuid> = stories.iter().map(|story| story.id).collect();

    if !story_ids.is_empty() {
        let acceptance_rows = sqlx::query_as::<_, AcceptanceCriteriaRow>(
            "SELECT id, story_id, ac_id, given, \"when\" AS when_clause, \"then\" AS then_clause, created_at
             FROM acceptance_criteria
             WHERE story_id = ANY($1)
             ORDER BY created_at",
        )
        .bind(&story_ids)
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error fetching acceptance criteria for stories");
            AppError::InternalServerError
        })?;

        let mut grouped: HashMap<Uuid, Vec<AcceptanceCriteria>> = HashMap::new();
        for row in acceptance_rows {
            grouped
                .entry(row.story_id)
                .or_default()
                .push(AcceptanceCriteria::from(row));
        }

        for story in &mut stories {
            if let Some(acs) = grouped.remove(&story.id) {
                story.acceptance_criteria = acs;
            }
        }
    }

    Ok(stories)
}

// Task persistence helpers
pub async fn create_task(pool: &PgPool, task: &Task) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO tasks (id, story_id, organization_id, title, description, acceptance_criteria_refs,
                           status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
    )
    .bind(task.id)
    .bind(task.story_id)
    .bind(task.organization_id)
    .bind(&task.title)
    .bind(&task.description)
    .bind(&task.acceptance_criteria_refs)
    .bind(task.status.to_string())
    .bind(task.owner_user_id)
    .bind(task.estimated_hours.map(|h| h as i32))
    .bind(task.created_at)
    .bind(task.updated_at)
    .bind(task.owned_at)
    .bind(task.completed_at)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error inserting task");
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn get_task(
    pool: &PgPool,
    id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<Task>, AppError> {
    let task_row = sqlx::query_as::<_, TaskRow>(
        "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs,
                status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at
         FROM tasks
         WHERE id = $1 AND (
             (organization_id IS NOT NULL AND organization_id = $2) OR
             (organization_id IS NULL AND $2 IS NULL)
         )",
    )
    .bind(id)
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching task");
        AppError::InternalServerError
    })?;

    Ok(task_row.map(Task::from))
}

pub async fn get_tasks_by_story(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<Task>, AppError> {
    let task_rows = sqlx::query_as::<_, TaskRow>(
        "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs,
                status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at
         FROM tasks
         WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
         ORDER BY title",
    )
    .bind(story_id)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching tasks by story");
        AppError::InternalServerError
    })?;

    Ok(task_rows.into_iter().map(Task::from).collect())
}

pub async fn update_task(pool: &PgPool, task: &Task) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE tasks SET title = $2, description = $3, acceptance_criteria_refs = $4,
                         status = $5, owner_user_id = $6, estimated_hours = $7,
                         updated_at = $8, owned_at = $9, completed_at = $10
         WHERE id = $1 AND (organization_id = $11 OR ($11 IS NULL AND organization_id IS NULL))",
    )
    .bind(task.id)
    .bind(&task.title)
    .bind(&task.description)
    .bind(&task.acceptance_criteria_refs)
    .bind(task.status.to_string())
    .bind(task.owner_user_id)
    .bind(task.estimated_hours.map(|h| h as i32))
    .bind(task.updated_at)
    .bind(task.owned_at)
    .bind(task.completed_at)
    .bind(task.organization_id)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error updating task");
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn delete_task(
    pool: &PgPool,
    id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM tasks WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))")
        .bind(id)
        .bind(organization_id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error deleting task");
            AppError::InternalServerError
        })?;
    Ok(())
}

pub async fn get_tasks_by_owner(
    pool: &PgPool,
    user_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<Task>, AppError> {
    let task_rows = if let Some(org_id) = organization_id {
        sqlx::query_as::<_, TaskRow>(
            "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs,
                    status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at
             FROM tasks
             WHERE owner_user_id = $1 AND organization_id = $2
             ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .bind(org_id)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, TaskRow>(
            "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs,
                    status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at
             FROM tasks
             WHERE owner_user_id = $1
             ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error fetching tasks by owner");
        AppError::InternalServerError
    })?;

    Ok(task_rows.into_iter().map(Task::from).collect())
}

pub async fn get_tasks_by_sprint(
    pool: &PgPool,
    sprint_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<Task>, AppError> {
    let task_rows = sqlx::query_as::<_, TaskRow>(
        "SELECT t.* FROM tasks t
         INNER JOIN stories s ON t.story_id = s.id
         WHERE s.sprint_id = $1
         AND (t.organization_id = $2 OR ($2 IS NULL AND t.organization_id IS NULL))
         ORDER BY t.created_at DESC",
    )
    .bind(sprint_id)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error getting tasks by sprint");
        AppError::InternalServerError
    })?;

    Ok(task_rows.into_iter().map(Task::from).collect())
}

pub async fn get_tasks_by_project(
    pool: &PgPool,
    project_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<Task>, AppError> {
    let task_rows = sqlx::query_as::<_, TaskRow>(
        "SELECT t.* FROM tasks t
         INNER JOIN stories s ON t.story_id = s.id
         WHERE s.project_id = $1
         AND (t.organization_id = $2 OR ($2 IS NULL AND t.organization_id IS NULL))
         ORDER BY t.created_at DESC",
    )
    .bind(project_id)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error getting tasks by project");
        AppError::InternalServerError
    })?;

    Ok(task_rows.into_iter().map(Task::from).collect())
}

pub async fn get_tasks_by_story_ids(
    pool: &PgPool,
    story_ids: &[Uuid],
    organization_id: Option<Uuid>,
) -> Result<Vec<Task>, AppError> {
    if story_ids.is_empty() {
        return Ok(vec![]);
    }

    let task_rows = sqlx::query_as::<_, TaskRow>(
        "SELECT * FROM tasks
         WHERE story_id = ANY($1)
         AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
         ORDER BY created_at DESC",
    )
    .bind(story_ids)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error getting tasks by story ids");
        AppError::InternalServerError
    })?;

    Ok(task_rows.into_iter().map(Task::from).collect())
}

pub async fn take_task_ownership_atomic(
    pool: &PgPool,
    task_id: Uuid,
    organization_id: Option<Uuid>,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let now = chrono::Utc::now();
    let result = sqlx::query(
        "UPDATE tasks
         SET status = $2, owner_user_id = $3, owned_at = $4, updated_at = $5
         WHERE id = $1
         AND status = 'available'
         AND (organization_id = $6 OR ($6 IS NULL AND organization_id IS NULL))",
    )
    .bind(task_id)
    .bind("owned")
    .bind(user_id)
    .bind(now)
    .bind(now)
    .bind(organization_id)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "SQL error taking task ownership atomically");
        AppError::InternalServerError
    })?;

    Ok(result.rows_affected() > 0)
}
