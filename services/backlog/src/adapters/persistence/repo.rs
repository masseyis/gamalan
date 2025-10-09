use crate::adapters::persistence::models::{AcceptanceCriteriaRow, StoryRow, TaskRow};
use crate::application::ports::{StoryRepository, TaskRepository};
use crate::domain::{AcceptanceCriteria, Story, Task};
use async_trait::async_trait;
use common::AppError;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

pub struct SqlStoryRepository {
    pool: PgPool,
}

impl SqlStoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // Labels are now stored as an array in the stories table
}

#[async_trait]
impl StoryRepository for SqlStoryRepository {
    async fn create_story(&self, story: &Story) -> Result<Uuid, AppError> {
        let mut tx = self
            .pool
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
            eprintln!("SQL Error in create_story: {}", e);
            AppError::InternalServerError
        })?;

        // Labels are now stored as an array in the stories table, no separate handling needed

        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(story.id)
    }

    async fn get_story(
        &self,
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
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            eprintln!("SQL Error in get_story: {}", e);
            AppError::InternalServerError
        })?;

        match story_row {
            Some(row) => {
                let mut story = Story::from(row);

                let acceptance_rows = sqlx::query_as::<_, AcceptanceCriteriaRow>(
                    "SELECT id, story_id, description, given, when_clause, then_clause, created_at
                     FROM acceptance_criteria
                     WHERE story_id = $1
                     ORDER BY created_at",
                )
                .bind(story.id)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    eprintln!("SQL Error in get_story (acceptance criteria): {}", e);
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

    async fn update_story(&self, story: &Story) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        sqlx::query(
            "UPDATE stories SET title = $2, description = $3, status = $4, labels = $5, story_points = $6, readiness_override = $7, readiness_override_by = $8, readiness_override_reason = $9, readiness_override_at = $10, updated_at = NOW()
             WHERE id = $1 AND (
                 (organization_id IS NOT NULL AND organization_id = $11) OR
                 (organization_id IS NULL AND $11 IS NULL)
             )",
        )
        .bind(story.id)
        .bind(&story.title)
        .bind(&story.description)
        .bind(story.status.to_string())
        .bind(&story.labels)
        .bind(story.story_points.map(|points| points as i32))
        .bind(story.readiness_override)
        .bind(story.readiness_override_by)
        .bind(&story.readiness_override_reason)
        .bind(story.readiness_override_at)
        .bind(story.organization_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        sqlx::query("DELETE FROM acceptance_criteria WHERE story_id = $1")
            .bind(story.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                eprintln!("SQL Error deleting acceptance criteria: {}", e);
                AppError::InternalServerError
            })?;

        for ac in &story.acceptance_criteria {
            sqlx::query(
                "INSERT INTO acceptance_criteria (id, story_id, description, given, when_clause, then_clause, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
            )
            .bind(ac.id)
            .bind(story.id)
            .bind(&ac.description)
            .bind(&ac.given)
            .bind(&ac.when)
            .bind(&ac.then)
            .bind(ac.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                eprintln!("SQL Error inserting acceptance criterion: {}", e);
                AppError::InternalServerError
            })?;
        }

        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn delete_story(&self, id: Uuid, organization_id: Option<Uuid>) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE stories SET deleted_at = NOW() WHERE id = $1 AND (
            (organization_id IS NOT NULL AND organization_id = $2) OR
            (organization_id IS NULL AND $2 IS NULL)
        )",
        )
        .bind(id)
        .bind(organization_id)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn get_stories_by_project(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Story>, AppError> {
        let story_rows = sqlx::query_as::<_, StoryRow>(
            "SELECT id, project_id, organization_id, title, description, status, labels, story_points, sprint_id, assigned_to_user_id, readiness_override, readiness_override_by, readiness_override_reason, readiness_override_at, created_at, updated_at FROM stories
             WHERE project_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) AND deleted_at IS NULL
             ORDER BY title",
        )
        .bind(project_id)
        .bind(organization_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        let mut stories: Vec<Story> = story_rows.into_iter().map(Story::from).collect();
        let story_ids: Vec<Uuid> = stories.iter().map(|story| story.id).collect();

        if !story_ids.is_empty() {
            let acceptance_rows = sqlx::query_as::<_, AcceptanceCriteriaRow>(
                "SELECT id, story_id, description, given, when_clause, then_clause, created_at
                 FROM acceptance_criteria
                 WHERE story_id = ANY($1)
                 ORDER BY created_at",
            )
            .bind(&story_ids)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                eprintln!(
                    "SQL Error in get_stories_by_project (acceptance criteria): {}",
                    e
                );
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
}

pub struct SqlTaskRepository {
    pool: PgPool,
}

impl SqlTaskRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TaskRepository for SqlTaskRepository {
    async fn create_task(&self, task: &Task) -> Result<(), AppError> {
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
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn get_task(
        &self,
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
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(task_row.map(Task::from))
    }

    async fn get_tasks_by_story(
        &self,
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
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(task_rows.into_iter().map(Task::from).collect())
    }

    async fn update_task(&self, task: &Task) -> Result<(), AppError> {
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
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn delete_task(&self, id: Uuid, organization_id: Option<Uuid>) -> Result<(), AppError> {
        sqlx::query("DELETE FROM tasks WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))")
            .bind(id)
            .bind(organization_id)
            .execute(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn get_tasks_by_owner(
        &self,
        user_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        let task_rows = sqlx::query_as::<_, TaskRow>(
            "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs,
                    status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at
             FROM tasks
             WHERE owner_user_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))
             ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .bind(organization_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(task_rows.into_iter().map(Task::from).collect())
    }

    async fn take_task_ownership_atomic(
        &self,
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
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(result.rows_affected() > 0)
    }
}
