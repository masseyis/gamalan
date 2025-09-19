use crate::adapters::persistence::models::{LabelRow, StoryRow, TaskRow};
use crate::application::ports::{StoryRepository, TaskRepository};
use crate::domain::{Story, Task};
use async_trait::async_trait;
use common::AppError;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SqlStoryRepository {
    pool: PgPool,
}

impl SqlStoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn load_labels(&self, story_id: Uuid) -> Result<Vec<String>, sqlx::Error> {
        let labels: Vec<LabelRow> = sqlx::query_as::<_, LabelRow>(
            "SELECT l.id, l.name FROM labels l 
             JOIN story_labels sl ON l.id = sl.label_id 
             WHERE sl.story_id = $1",
        )
        .bind(story_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(labels.into_iter().map(|l| l.name).collect())
    }

    async fn get_or_create_label_id(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        label: &str,
    ) -> Result<Uuid, AppError> {
        // First try to get existing label
        if let Ok(id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM labels WHERE name = $1")
            .bind(label)
            .fetch_one(&mut **tx)
            .await
        {
            return Ok(id);
        }

        // If not found, create new label
        let new_id = Uuid::new_v4();
        sqlx::query("INSERT INTO labels (id, name) VALUES ($1, $2)")
            .bind(new_id)
            .bind(label)
            .execute(&mut **tx)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(new_id)
    }

    #[allow(dead_code)]
    async fn get_or_create_label_id_pool(&self, label: &str) -> Result<Uuid, AppError> {
        // First try to get existing label
        if let Ok(id) = sqlx::query_scalar::<_, Uuid>("SELECT id FROM labels WHERE name = $1")
            .bind(label)
            .fetch_one(&self.pool)
            .await
        {
            return Ok(id);
        }

        // If not found, create new label
        let new_id = Uuid::new_v4();
        sqlx::query("INSERT INTO labels (id, name) VALUES ($1, $2)")
            .bind(new_id)
            .bind(label)
            .execute(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(new_id)
    }

    #[allow(dead_code)]
    async fn save_labels(&self, story_id: Uuid, labels: &[String]) -> Result<(), AppError> {
        // First, clear existing labels
        sqlx::query("DELETE FROM story_labels WHERE story_id = $1")
            .bind(story_id)
            .execute(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        // Then insert new labels
        for label in labels {
            let label_id = self.get_or_create_label_id_pool(label).await?;

            // Link label to story
            sqlx::query(
                "INSERT INTO story_labels (story_id, label_id) VALUES ($1, $2) 
                 ON CONFLICT DO NOTHING",
            )
            .bind(story_id)
            .bind(label_id)
            .execute(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;
        }

        Ok(())
    }
}

#[async_trait]
impl StoryRepository for SqlStoryRepository {
    async fn create_story(&self, story: &Story) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        sqlx::query(
            "INSERT INTO stories (id, project_id, organization_id, title, description, status)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(story.id)
        .bind(story.project_id)
        .bind(story.organization_id)
        .bind(&story.title)
        .bind(&story.description)
        .bind(story.status.to_string())
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        // Save labels
        for label in &story.labels {
            let label_id = self.get_or_create_label_id(&mut tx, label).await?;

            sqlx::query("INSERT INTO story_labels (story_id, label_id) VALUES ($1, $2)")
                .bind(story.id)
                .bind(label_id)
                .execute(&mut *tx)
                .await
                .map_err(|_| AppError::InternalServerError)?;
        }

        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn get_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Story>, AppError> {
        let story_row = sqlx::query_as::<_, StoryRow>(
            "SELECT id, project_id, organization_id, title, description, status FROM stories
             WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(organization_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        match story_row {
            Some(row) => {
                let mut story = Story::from(row);
                story.labels = self
                    .load_labels(id)
                    .await
                    .map_err(|_| AppError::InternalServerError)?;
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
            "UPDATE stories SET title = $2, description = $3, status = $4
             WHERE id = $1 AND (organization_id = $5 OR ($5 IS NULL AND organization_id IS NULL))",
        )
        .bind(story.id)
        .bind(&story.title)
        .bind(&story.description)
        .bind(story.status.to_string())
        .bind(story.organization_id)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        // Update labels
        sqlx::query("DELETE FROM story_labels WHERE story_id = $1")
            .bind(story.id)
            .execute(&mut *tx)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        for label in &story.labels {
            let label_id = self.get_or_create_label_id(&mut tx, label).await?;

            sqlx::query("INSERT INTO story_labels (story_id, label_id) VALUES ($1, $2)")
                .bind(story.id)
                .bind(label_id)
                .execute(&mut *tx)
                .await
                .map_err(|_| AppError::InternalServerError)?;
        }

        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;
        Ok(())
    }

    async fn delete_story(&self, id: Uuid, organization_id: Option<Uuid>) -> Result<(), AppError> {
        sqlx::query("UPDATE stories SET deleted_at = NOW() WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))")
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
            "SELECT id, project_id, organization_id, title, description, status FROM stories
             WHERE project_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) AND deleted_at IS NULL
             ORDER BY title",
        )
        .bind(project_id)
        .bind(organization_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        let mut stories = Vec::new();
        for row in story_rows {
            let mut story = Story::from(row);
            story.labels = self
                .load_labels(story.id)
                .await
                .map_err(|_| AppError::InternalServerError)?;
            stories.push(story);
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
            "INSERT INTO tasks (id, story_id, organization_id, title, description, acceptance_criteria_refs)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(task.id)
        .bind(task.story_id)
        .bind(task.organization_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.acceptance_criteria_refs)
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
            "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs FROM tasks
             WHERE id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL))",
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
            "SELECT id, story_id, organization_id, title, description, acceptance_criteria_refs FROM tasks
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
            "UPDATE tasks SET title = $2, description = $3, acceptance_criteria_refs = $4
             WHERE id = $1 AND (organization_id = $5 OR ($5 IS NULL AND organization_id IS NULL))",
        )
        .bind(task.id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.acceptance_criteria_refs)
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
}
