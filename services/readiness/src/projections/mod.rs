use crate::application::ports::{StoryInfo, StoryService, TaskInfo};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use common::AppError;
use event_bus::{
    BacklogEvent, DomainEvent, EventBus, EventEnvelope, SprintEvent, StoryRecord, TaskRecord,
};
use serde_json::json;
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tracing::error;
use uuid::Uuid;

#[derive(FromRow)]
struct StoryRow {
    id: Uuid,
    project_id: Uuid,
    organization_id: Option<Uuid>,
    title: String,
    description: Option<String>,
    status: String,
    labels: Option<Vec<String>>,
    story_points: Option<i32>,
    sprint_id: Option<Uuid>,
    assigned_to_user_id: Option<Uuid>,
    readiness_override: Option<bool>,
    readiness_override_by: Option<Uuid>,
    readiness_override_reason: Option<String>,
    readiness_override_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct AcceptanceRow {
    id: Uuid,
    story_id: Uuid,
    description: String,
    given: String,
    when_clause: String,
    then_clause: String,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct TaskRow {
    id: Uuid,
    story_id: Uuid,
    organization_id: Option<Uuid>,
    title: String,
    description: Option<String>,
    acceptance_criteria_refs: Option<Vec<String>>,
    status: String,
    owner_user_id: Option<Uuid>,
    estimated_hours: Option<i32>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    owned_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(FromRow)]
struct StoryProjectionRow {
    id: Uuid,
    title: String,
    description: Option<String>,
    story_points: Option<i32>,
}

#[derive(FromRow)]
struct TaskProjectionRow {
    id: Uuid,
    story_id: Uuid,
    title: String,
    description: Option<String>,
    acceptance_criteria_refs: Option<Vec<String>>,
    estimated_hours: Option<i32>,
}

#[derive(Clone)]
pub struct ProjectionStore {
    pool: Arc<PgPool>,
}

impl ProjectionStore {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn hydrate(&self) {
        if let Err(err) = self.hydrate_internal().await {
            error!(error = %err, "Failed to hydrate readiness projections");
        }
    }

    async fn hydrate_internal(&self) -> Result<(), sqlx::Error> {
        let stories = sqlx::query_as::<_, StoryRow>(
            r#"
            SELECT
                id,
                project_id,
                organization_id,
                title,
                description,
                status,
                labels,
                story_points,
                sprint_id,
                assigned_to_user_id,
                readiness_override,
                readiness_override_by,
                readiness_override_reason,
                readiness_override_at,
                created_at,
                updated_at
            FROM stories
            WHERE deleted_at IS NULL
            "#,
        )
        .fetch_all(&*self.pool)
        .await?;

        let story_ids: Vec<Uuid> = stories.iter().map(|row| row.id).collect();

        let mut acceptance_map: HashMap<Uuid, Vec<_>> = HashMap::new();
        if !story_ids.is_empty() {
            let acceptance_rows = sqlx::query_as::<_, AcceptanceRow>(
                r#"
                SELECT
                    id,
                    story_id,
                    description,
                    given,
                    when_clause,
                    then_clause,
                    created_at
                FROM acceptance_criteria
                WHERE story_id = ANY($1)
                "#,
            )
            .bind(&story_ids)
            .fetch_all(&*self.pool)
            .await?;

            for row in acceptance_rows {
                acceptance_map.entry(row.story_id).or_default().push((
                    row.id,
                    row.description,
                    row.given,
                    row.when_clause,
                    row.then_clause,
                    row.created_at,
                ));
            }
        }

        let mut task_map: HashMap<Uuid, Vec<_>> = HashMap::new();
        if !story_ids.is_empty() {
            let task_rows = sqlx::query_as::<_, TaskRow>(
                r#"
                SELECT
                    id,
                    story_id,
                    organization_id,
                    title,
                    description,
                    acceptance_criteria_refs,
                    status,
                    owner_user_id,
                    estimated_hours,
                    created_at,
                    updated_at,
                    owned_at,
                    completed_at
                FROM tasks
                WHERE story_id = ANY($1)
                "#,
            )
            .bind(&story_ids)
            .fetch_all(&*self.pool)
            .await?;

            for row in task_rows {
                task_map.entry(row.story_id).or_default().push(row);
            }
        }

        for story in stories {
            let record = StoryRecord {
                id: story.id,
                project_id: story.project_id,
                organization_id: story.organization_id,
                title: story.title,
                description: story.description,
                status: story.status,
                labels: story.labels.unwrap_or_default(),
                acceptance_criteria: acceptance_map
                    .remove(&story.id)
                    .unwrap_or_default()
                    .into_iter()
                    .map(
                        |(id, description, given, when_clause, then_clause, created_at)| {
                            event_bus::AcceptanceCriterionRecord {
                                id,
                                story_id: story.id,
                                description,
                                given,
                                when: when_clause,
                                then: then_clause,
                                created_at,
                            }
                        },
                    )
                    .collect(),
                story_points: story.story_points.map(|val| val as u32),
                sprint_id: story.sprint_id,
                assigned_to_user_id: story.assigned_to_user_id,
                readiness_override: story.readiness_override.unwrap_or(false),
                readiness_override_by: story.readiness_override_by,
                readiness_override_reason: story.readiness_override_reason,
                readiness_override_at: story.readiness_override_at,
                created_at: story.created_at,
                updated_at: story.updated_at,
            };

            self.upsert_story(&record).await?;

            if let Some(tasks) = task_map.remove(&story.id) {
                for task in tasks {
                    let record = TaskRecord {
                        id: task.id,
                        story_id: task.story_id,
                        organization_id: task.organization_id,
                        title: task.title,
                        description: task.description,
                        acceptance_criteria_refs: task.acceptance_criteria_refs.unwrap_or_default(),
                        status: task.status,
                        owner_user_id: task.owner_user_id,
                        estimated_hours: task.estimated_hours.map(|v| v as u32),
                        created_at: task.created_at,
                        updated_at: task.updated_at,
                        owned_at: task.owned_at,
                        completed_at: task.completed_at,
                    };
                    self.upsert_task(&record).await?;
                }
            }
        }

        Ok(())
    }

    pub async fn handle_event(&self, envelope: &EventEnvelope) {
        if let Err(err) = self.apply_event(&envelope.event).await {
            error!(
                error = %err,
                event_id = %envelope.id,
                "Failed to apply backlog event to readiness projections"
            );
        }
    }

    // ... (rest of the file)

    async fn apply_event(&self, event: &DomainEvent) -> Result<(), sqlx::Error> {
        match event {
            DomainEvent::Backlog(backlog_event) => self.handle_backlog_event(backlog_event).await?,
            DomainEvent::Sprint(sprint_event) => self.handle_sprint_event(sprint_event).await?,
        }

        Ok(())
    }

    async fn handle_backlog_event(&self, backlog_event: &BacklogEvent) -> Result<(), sqlx::Error> {
        match backlog_event {
            BacklogEvent::StoryCreated { story } | BacklogEvent::StoryUpdated { story } => {
                self.upsert_story(story).await?
            }
            BacklogEvent::StoryDeleted { story_id, .. } => self.delete_story(*story_id).await?,
            BacklogEvent::TaskCreated { task } | BacklogEvent::TaskUpdated { task } => {
                self.upsert_task(task).await?
            }
            BacklogEvent::TaskDeleted { task_id, .. } => self.delete_task(*task_id).await?,
        }

        Ok(())
    }

    async fn handle_sprint_event(&self, sprint_event: &SprintEvent) -> Result<(), sqlx::Error> {
        match sprint_event {
            SprintEvent::Deleted { sprint_id, .. } => {
                self.clear_sprint_assignments(*sprint_id).await?;
            }
            SprintEvent::Created { .. } | SprintEvent::Updated { .. } => {
                // No projection changes required yet; sprint data is sourced via backlog stories.
            }
        }

        Ok(())
    }

    async fn clear_sprint_assignments(&self, sprint_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE readiness_story_projections
            SET sprint_id = NULL
            WHERE sprint_id = $1
            "#,
        )
        .bind(sprint_id)
        .execute(&*self.pool)
        .await?;

        Ok(())
    }

    async fn upsert_story(&self, story: &StoryRecord) -> Result<(), sqlx::Error> {
        let criteria_json = serde_json::to_value(&story.acceptance_criteria).unwrap_or(json!([]));
        sqlx::query(
            r#"
            INSERT INTO readiness_story_projections (
                id,
                organization_id,
                project_id,
                title,
                description,
                status,
                labels,
                story_points,
                acceptance_criteria,
                sprint_id,
                assigned_to_user_id,
                readiness_override,
                readiness_override_by,
                readiness_override_reason,
                readiness_override_at,
                created_at,
                updated_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
            )
            ON CONFLICT (id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                project_id = EXCLUDED.project_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                status = EXCLUDED.status,
                labels = EXCLUDED.labels,
                story_points = EXCLUDED.story_points,
                acceptance_criteria = EXCLUDED.acceptance_criteria,
                sprint_id = EXCLUDED.sprint_id,
                assigned_to_user_id = EXCLUDED.assigned_to_user_id,
                readiness_override = EXCLUDED.readiness_override,
                readiness_override_by = EXCLUDED.readiness_override_by,
                readiness_override_reason = EXCLUDED.readiness_override_reason,
                readiness_override_at = EXCLUDED.readiness_override_at,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(story.id)
        .bind(story.organization_id)
        .bind(story.project_id)
        .bind(&story.title)
        .bind(&story.description)
        .bind(&story.status)
        .bind(&story.labels)
        .bind(story.story_points.map(|v| v as i32))
        .bind(criteria_json)
        .bind(story.sprint_id)
        .bind(story.assigned_to_user_id)
        .bind(story.readiness_override)
        .bind(story.readiness_override_by)
        .bind(&story.readiness_override_reason)
        .bind(story.readiness_override_at)
        .bind(story.created_at)
        .bind(story.updated_at)
        .execute(&*self.pool)
        .await?;

        Ok(())
    }

    async fn delete_story(&self, story_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM readiness_story_projections WHERE id = $1")
            .bind(story_id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }

    async fn upsert_task(&self, task: &TaskRecord) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO readiness_task_projections (
                id,
                story_id,
                organization_id,
                title,
                description,
                acceptance_criteria_refs,
                status,
                owner_user_id,
                estimated_hours,
                created_at,
                updated_at,
                owned_at,
                completed_at
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
            )
            ON CONFLICT (id) DO UPDATE SET
                story_id = EXCLUDED.story_id,
                organization_id = EXCLUDED.organization_id,
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                acceptance_criteria_refs = EXCLUDED.acceptance_criteria_refs,
                status = EXCLUDED.status,
                owner_user_id = EXCLUDED.owner_user_id,
                estimated_hours = EXCLUDED.estimated_hours,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                owned_at = EXCLUDED.owned_at,
                completed_at = EXCLUDED.completed_at
            "#,
        )
        .bind(task.id)
        .bind(task.story_id)
        .bind(task.organization_id)
        .bind(&task.title)
        .bind(&task.description)
        .bind(&task.acceptance_criteria_refs)
        .bind(&task.status)
        .bind(task.owner_user_id)
        .bind(task.estimated_hours.map(|v| v as i32))
        .bind(task.created_at)
        .bind(task.updated_at)
        .bind(task.owned_at)
        .bind(task.completed_at)
        .execute(&*self.pool)
        .await?;
        Ok(())
    }

    async fn delete_task(&self, task_id: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM readiness_task_projections WHERE id = $1")
            .bind(task_id)
            .execute(&*self.pool)
            .await?;
        Ok(())
    }
}

pub struct ProjectionWorker {
    #[allow(dead_code)]
    handle: JoinHandle<()>,
}

impl ProjectionWorker {
    pub fn spawn(store: ProjectionStore, event_bus: Arc<EventBus>) -> Self {
        let subscription = event_bus.subscribe();

        let handle = tokio::spawn(async move {
            loop {
                let envelope = subscription.recv().await;
                store.handle_event(&envelope).await;
            }
        });

        Self { handle }
    }
}

#[derive(Clone)]
pub struct ProjectionStoryService {
    pool: Arc<PgPool>,
}

impl ProjectionStoryService {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl StoryService for ProjectionStoryService {
    async fn get_story_info(
        &self,
        story_id: Uuid,
        _organization_id: Option<Uuid>,
    ) -> Result<Option<StoryInfo>, AppError> {
        let row = sqlx::query_as::<_, StoryProjectionRow>(
            r#"
            SELECT id, title, description, story_points
            FROM readiness_story_projections
            WHERE id = $1
            "#,
        )
        .bind(story_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to fetch story projection");
            AppError::InternalServerError
        })?;

        Ok(row.map(|record| StoryInfo {
            id: record.id,
            title: record.title,
            description: record.description,
            story_points: record.story_points.map(|v| v as u32),
        }))
    }

    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        _organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError> {
        let rows = sqlx::query_as::<_, TaskProjectionRow>(
            r#"
            SELECT id, story_id, title, description, acceptance_criteria_refs, estimated_hours
            FROM readiness_task_projections
            WHERE story_id = $1
            ORDER BY created_at
            "#,
        )
        .bind(story_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to fetch task projections");
            AppError::InternalServerError
        })?;

        Ok(rows
            .into_iter()
            .map(|row| TaskInfo {
                id: row.id,
                story_id: row.story_id,
                title: row.title,
                description: row.description,
                acceptance_criteria_refs: row.acceptance_criteria_refs.unwrap_or_default(),
                estimated_hours: row.estimated_hours.map(|v| v as u32),
            })
            .collect())
    }

    async fn get_task_info(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskInfo>, AppError> {
        let row = sqlx::query_as::<_, TaskProjectionRow>(
            r#"
            SELECT id, story_id, title, description, acceptance_criteria_refs, estimated_hours
            FROM readiness_task_projections
            WHERE id = $1 AND organization_id = $2
            "#,
        )
        .bind(task_id)
        .bind(organization_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|err| {
            error!(error = %err, %task_id, "Failed to fetch task projection by id");
            AppError::InternalServerError
        })?;

        Ok(row.map(|row| TaskInfo {
            id: row.id,
            story_id: row.story_id,
            title: row.title,
            description: row.description,
            acceptance_criteria_refs: row.acceptance_criteria_refs.unwrap_or_default(),
            estimated_hours: row.estimated_hours.map(|v| v as u32),
        }))
    }
}
