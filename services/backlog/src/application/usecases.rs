use crate::adapters::persistence::repo;
use crate::domain::{AcceptanceCriteria, Story, StoryStatus, Task, TaskStatus};
use common::AppError;
use event_bus::{
    AcceptanceCriterionRecord, BacklogEvent, DomainEvent, EventPublisher, SprintEvent,
    SprintRecord, StoryRecord, TaskRecord,
};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct BacklogUsecases {
    pool: Arc<PgPool>,
    events: Arc<dyn EventPublisher>,
}

impl BacklogUsecases {
    pub fn new(pool: Arc<PgPool>, events: Arc<dyn EventPublisher>) -> Self {
        Self { pool, events }
    }

    async fn publish(&self, event: DomainEvent) {
        self.events.publish(event).await;
    }

    fn acceptance_record(story_id: Uuid, ac: &AcceptanceCriteria) -> AcceptanceCriterionRecord {
        AcceptanceCriterionRecord {
            id: ac.id,
            story_id,
            description: ac.description.clone(),
            given: ac.given.clone(),
            when: ac.when.clone(),
            then: ac.then.clone(),
            created_at: ac.created_at,
        }
    }

    fn story_record(story: &Story) -> StoryRecord {
        StoryRecord {
            id: story.id,
            project_id: story.project_id,
            organization_id: story.organization_id,
            title: story.title.clone(),
            description: story.description.clone(),
            status: story.status.to_string(),
            labels: story.labels.clone(),
            acceptance_criteria: story
                .acceptance_criteria
                .iter()
                .map(|ac| Self::acceptance_record(story.id, ac))
                .collect(),
            story_points: story.story_points,
            sprint_id: story.sprint_id,
            assigned_to_user_id: story.assigned_to_user_id,
            readiness_override: story.readiness_override,
            readiness_override_by: story.readiness_override_by,
            readiness_override_reason: story.readiness_override_reason.clone(),
            readiness_override_at: story.readiness_override_at,
            created_at: story.created_at,
            updated_at: story.updated_at,
        }
    }

    fn task_record(task: &Task) -> TaskRecord {
        TaskRecord {
            id: task.id,
            story_id: task.story_id,
            organization_id: task.organization_id,
            title: task.title.clone(),
            description: task.description.clone(),
            acceptance_criteria_refs: task.acceptance_criteria_refs.clone(),
            status: task.status.to_string(),
            owner_user_id: task.owner_user_id,
            estimated_hours: task.estimated_hours,
            created_at: task.created_at,
            updated_at: task.updated_at,
            owned_at: task.owned_at,
            completed_at: task.completed_at,
        }
    }

    pub async fn create_story(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
        labels: Vec<String>,
    ) -> Result<Uuid, AppError> {
        let mut story = Story::new(project_id, organization_id, title, description)?;
        for label in labels {
            story.add_label(label);
        }
        repo::create_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryCreated {
            story: record,
        }))
        .await;
        Ok(story.id)
    }

    pub async fn get_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Story>, AppError> {
        repo::get_story(&self.pool, id, organization_id).await
    }

    pub async fn update_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        title: Option<String>,
        description: Option<Option<String>>,
        labels: Option<Vec<String>>,
        story_points: Option<u32>,
        sprint_id: Option<Option<Uuid>>,
    ) -> Result<(), AppError> {
        let mut story = self
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.update(title, description, labels, story_points, sprint_id)?;
        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(())
    }

    pub async fn override_story_ready(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
        reason: Option<String>,
    ) -> Result<Story, AppError> {
        let mut story = self
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.apply_readiness_override(user_id, reason);
        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(story)
    }

    pub async fn update_story_status(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        status: StoryStatus,
    ) -> Result<(), AppError> {
        let mut story = self
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.update_status(status)?;
        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(())
    }

    pub async fn delete_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        repo::delete_story(&self.pool, id, organization_id).await?;
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryDeleted {
            story_id: id,
            organization_id,
        }))
        .await;
        Ok(())
    }

    pub async fn create_sprint(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
        name: String,
        goal: String,
        stories: Vec<Uuid>,
        capacity_points: Option<u32>,
    ) -> Result<Uuid, AppError> {
        let project = repo::get_project(&self.pool, project_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

        let team_id = project.team_id.ok_or_else(|| {
            AppError::BadRequest(
                "Project is missing a team assignment; assign a team before creating sprints."
                    .to_string(),
            )
        })?;

        if let Some(current_sprint) = repo::get_team_active_sprint(&self.pool, team_id).await? {
            return Err(AppError::BadRequest(format!(
                "Team already has an active sprint ({})",
                current_sprint
            )));
        }

        let effective_org_id = organization_id.or(project.organization_id);

        // Default sprint configuration until UI surfaces advanced controls.
        const DEFAULT_SPRINT_CAPACITY: u32 = 40;
        const DEFAULT_SPRINT_DURATION_DAYS: i64 = 14;
        let capacity_points = capacity_points.unwrap_or(DEFAULT_SPRINT_CAPACITY);
        if capacity_points == 0 {
            return Err(AppError::BadRequest(
                "Sprint capacity must be greater than 0".to_string(),
            ));
        }

        let start_date = chrono::Utc::now();
        let end_date = start_date + chrono::Duration::days(DEFAULT_SPRINT_DURATION_DAYS);

        let mut stories_to_commit: Vec<Story> = Vec::new();
        for story_id in &stories {
            let story = self
                .get_story(*story_id, organization_id)
                .await?
                .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;
            stories_to_commit.push(story);
        }

        let committed_points: u32 = stories_to_commit
            .iter()
            .map(|story| story.story_points.unwrap_or(0))
            .sum();

        if committed_points > capacity_points {
            return Err(AppError::BadRequest(format!(
                "Committed story points ({}) exceed sprint capacity ({})",
                committed_points, capacity_points
            )));
        }

        let goal = goal.trim().to_string();

        // Start a transaction to ensure all operations succeed or fail together
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        let sprint_id = repo::create_sprint_with_transaction(
            &mut tx,
            project_id,
            team_id,
            effective_org_id,
            name.clone(),
            goal.clone(),
            capacity_points,
            "active",
            start_date,
            end_date,
            committed_points,
            0,
        )
        .await?;

        // Update all stories within the same transaction
        for story in &mut stories_to_commit {
            story.assign_to_sprint(sprint_id)?;
            story.update_status(StoryStatus::Committed)?;
            repo::update_story_with_transaction(&mut tx, story).await?;
        }

        // Set team active sprint within the same transaction
        repo::set_team_active_sprint_with_transaction(&mut tx, team_id, sprint_id).await?;

        // Commit the transaction - if any operation failed, this will rollback everything
        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        // Publish events after successful transaction commit
        for story in &stories_to_commit {
            let record = Self::story_record(story);
            self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
                story: record,
            }))
            .await;
        }

        self.publish(DomainEvent::Sprint(SprintEvent::Created {
            sprint: SprintRecord {
                id: sprint_id,
                team_id,
                organization_id: effective_org_id,
                name,
                goal: if goal.is_empty() { None } else { Some(goal) },
                capacity_points: Some(capacity_points),
                status: "Active".to_string(),
                start_date: Some(start_date),
                end_date: Some(end_date),
                committed_points: Some(committed_points),
                completed_points: Some(0),
                created_at: start_date,
                updated_at: start_date,
            },
        }))
        .await;

        Ok(sprint_id)
    }

    pub async fn get_stories_by_project(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
        status: Option<StoryStatus>,
        sprint_id: Option<Uuid>,
    ) -> Result<Vec<Story>, AppError> {
        let stories =
            repo::get_stories_by_project(&self.pool, project_id, organization_id, sprint_id)
                .await?;

        if let Some(status_filter) = status {
            Ok(stories
                .into_iter()
                .filter(|story| story.status == status_filter)
                .collect())
        } else {
            Ok(stories)
        }
    }

    pub async fn get_task(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Task>, AppError> {
        repo::get_task(&self.pool, task_id, organization_id).await
    }

    pub async fn create_task(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
        acceptance_criteria_refs: Vec<String>,
    ) -> Result<Uuid, AppError> {
        let task = Task::new(
            story_id,
            organization_id,
            title,
            description,
            acceptance_criteria_refs,
        )?;
        repo::create_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskCreated {
            task: record,
        }))
        .await;
        Ok(task.id)
    }

    pub async fn get_tasks_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        repo::get_tasks_by_story(&self.pool, story_id, organization_id).await
    }

    pub async fn get_available_tasks(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        let tasks = repo::get_tasks_by_story(&self.pool, story_id, organization_id).await?;
        let available_tasks = tasks
            .into_iter()
            .filter(|task| task.is_available_for_ownership())
            .collect();
        Ok(available_tasks)
    }

    pub async fn get_user_owned_tasks(
        &self,
        user_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        repo::get_tasks_by_owner(&self.pool, user_id, organization_id).await
    }

    pub async fn get_recommended_tasks(
        &self,
        filters: crate::domain::RecommendationFilters,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<crate::domain::TaskRecommendation>, AppError> {
        use crate::domain::TaskRecommender;

        // Get tasks based on filters
        let tasks = if let Some(sprint_id) = filters.sprint_id {
            repo::get_tasks_by_sprint(&self.pool, sprint_id, organization_id).await?
        } else if let Some(project_id) = filters.project_id {
            repo::get_tasks_by_project(&self.pool, project_id, organization_id).await?
        } else if let Some(ref story_ids) = filters.story_ids {
            repo::get_tasks_by_story_ids(&self.pool, story_ids, organization_id).await?
        } else {
            // If no specific filter, return empty (avoiding returning all tasks in the system)
            vec![]
        };

        // Apply recommendation engine
        let recommender = TaskRecommender::with_default_strategy();
        let recommendations = recommender.recommend(tasks, &filters);

        Ok(recommendations)
    }

    pub async fn take_task_ownership(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<Task, AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.take_ownership(user_id)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;
        Ok(task)
    }

    pub async fn release_task_ownership(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<Task, AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        let previous_owner = task.owner_user_id;
        task.release_ownership(user_id)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;

        // Store previous_owner in task for WebSocket event
        let mut task_with_prev_owner = task.clone();
        if let Some(prev_owner) = previous_owner {
            task_with_prev_owner.owner_user_id = Some(prev_owner);
        }
        Ok(task_with_prev_owner)
    }

    pub async fn start_task_work(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.start_work(user_id)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;
        Ok(())
    }

    pub async fn complete_task_work(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.complete(user_id)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;
        Ok(())
    }

    pub async fn update_task_status(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
        status: TaskStatus,
    ) -> Result<Task, AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.transition_to_status(status, user_id)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;

        Ok(task)
    }

    pub async fn set_task_estimate(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        _user_id: Uuid,
        estimated_hours: Option<u32>,
    ) -> Result<(), AppError> {
        let mut task = self
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.set_estimated_hours(estimated_hours)?;
        repo::update_task(&self.pool, &task).await?;
        let record = Self::task_record(&task);
        self.publish(DomainEvent::Backlog(BacklogEvent::TaskUpdated {
            task: record,
        }))
        .await;
        Ok(())
    }

    pub async fn get_acceptance_criteria(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriteria>, AppError> {
        let story = self
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        Ok(story.acceptance_criteria)
    }

    pub async fn create_acceptance_criterion(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        given: String,
        when: String,
        then: String,
    ) -> Result<Uuid, AppError> {
        let mut story = self
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        let description = format!("Given {}, when {}, then {}", given, when, then);
        let ac = AcceptanceCriteria::new(description, given, when, then)?;
        let ac_id = ac.id;
        story.add_acceptance_criteria(ac);
        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(ac_id)
    }

    pub async fn update_acceptance_criterion(
        &self,
        criterion_id: Uuid,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        given: Option<String>,
        when: Option<String>,
        then: Option<String>,
    ) -> Result<(), AppError> {
        let mut story = self
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        let ac = story
            .acceptance_criteria
            .iter_mut()
            .find(|ac| ac.id == criterion_id)
            .ok_or_else(|| AppError::NotFound("Acceptance criterion not found".to_string()))?;

        if let Some(given) = given {
            ac.given = given;
        }
        if let Some(when) = when {
            ac.when = when;
        }
        if let Some(then) = then {
            ac.then = then;
        }

        ac.description = format!("Given {}, when {}, then {}", ac.given, ac.when, ac.then);

        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(())
    }

    pub async fn delete_acceptance_criterion(
        &self,
        criterion_id: Uuid,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let mut story = self
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.remove_acceptance_criteria(criterion_id)?;
        repo::update_story(&self.pool, &story).await?;
        let record = Self::story_record(&story);
        self.publish(DomainEvent::Backlog(BacklogEvent::StoryUpdated {
            story: record,
        }))
        .await;
        Ok(())
    }

    pub async fn get_sprint_task_board(
        &self,
        sprint_id: Uuid,
        organization_id: Option<Uuid>,
        status_filter: Option<String>,
        group_by: Option<String>,
    ) -> Result<crate::adapters::http::handlers::SprintTaskBoardResponse, AppError> {
        use crate::adapters::http::handlers::{
            SprintMetadata, SprintTaskBoardResponse, SprintTaskView,
        };
        use chrono::Utc;
        use std::collections::HashMap;

        // Get sprint metadata
        let sprint_row = sqlx::query!(
            r#"
            SELECT id, name, goal, status, start_date, end_date,
                   capacity_points, committed_points, completed_points
            FROM sprints
            WHERE id = $1
            "#,
            sprint_id
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "SQL error fetching sprint");
            AppError::InternalServerError
        })?
        .ok_or_else(|| AppError::NotFound("Sprint not found".to_string()))?;

        // Calculate days remaining
        let now = Utc::now();
        let days_remaining = (sprint_row.end_date - now).num_days().max(0);

        // Get all stories in the sprint with organization filter
        let stories_query: Vec<(Uuid, String)> = if let Some(org_id) = organization_id {
            sqlx::query_as::<_, (Uuid, String)>(
                r#"
                SELECT id, title
                FROM stories
                WHERE sprint_id = $1 AND organization_id = $2
                "#,
            )
            .bind(sprint_id)
            .bind(org_id)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "SQL error fetching stories for sprint");
                AppError::InternalServerError
            })?
        } else {
            sqlx::query_as::<_, (Uuid, String)>(
                r#"
                SELECT id, title
                FROM stories
                WHERE sprint_id = $1
                "#,
            )
            .bind(sprint_id)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "SQL error fetching stories for sprint");
                AppError::InternalServerError
            })?
        };

        let total_stories = stories_query.len() as i64;
        let story_map: HashMap<Uuid, String> = stories_query.into_iter().collect();

        if story_map.is_empty() {
            // No stories in sprint - return empty response
            return Ok(SprintTaskBoardResponse {
                sprint: SprintMetadata {
                    id: sprint_row.id,
                    name: sprint_row.name,
                    goal: sprint_row.goal,
                    start_date: sprint_row.start_date,
                    end_date: sprint_row.end_date,
                    days_remaining,
                    status: sprint_row.status,
                    total_stories: 0,
                    total_tasks: 0,
                    completed_tasks: 0,
                    progress_percentage: 0.0,
                },
                tasks: vec![],
                groups: serde_json::json!({}),
            });
        }

        let story_ids: Vec<Uuid> = story_map.keys().copied().collect();

        // Define a struct for task row data
        #[derive(sqlx::FromRow)]
        struct TaskRowData {
            id: Uuid,
            story_id: Uuid,
            title: String,
            description: Option<String>,
            status: String,
            owner_user_id: Option<Uuid>,
            acceptance_criteria_refs: Vec<String>,
            estimated_hours: Option<i32>,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        // Get all tasks for these stories with optional status filter
        let tasks_rows: Vec<TaskRowData> = if let Some(status) = &status_filter {
            sqlx::query_as::<_, TaskRowData>(
                r#"
                SELECT id, story_id, title, description, status,
                       owner_user_id, acceptance_criteria_refs,
                       estimated_hours, created_at, updated_at
                FROM tasks
                WHERE story_id = ANY($1) AND status = $2
                ORDER BY story_id, created_at
                "#,
            )
            .bind(&story_ids)
            .bind(status)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "SQL error fetching tasks for sprint");
                AppError::InternalServerError
            })?
        } else {
            sqlx::query_as::<_, TaskRowData>(
                r#"
                SELECT id, story_id, title, description, status,
                       owner_user_id, acceptance_criteria_refs,
                       estimated_hours, created_at, updated_at
                FROM tasks
                WHERE story_id = ANY($1)
                ORDER BY story_id, created_at
                "#,
            )
            .bind(&story_ids)
            .fetch_all(self.pool.as_ref())
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "SQL error fetching tasks for sprint");
                AppError::InternalServerError
            })?
        };

        // Build task views
        let mut tasks: Vec<SprintTaskView> = Vec::new();
        let mut completed_tasks = 0i64;

        for row in tasks_rows {
            if row.status == "completed" {
                completed_tasks += 1;
            }

            let story_title = story_map
                .get(&row.story_id)
                .cloned()
                .unwrap_or_else(|| "Unknown Story".to_string());

            tasks.push(SprintTaskView {
                id: row.id,
                story_id: row.story_id,
                story_title,
                title: row.title,
                description: row.description,
                status: row.status,
                owner_user_id: row.owner_user_id,
                acceptance_criteria_refs: row.acceptance_criteria_refs,
                estimated_hours: row.estimated_hours.map(|h| h as u32),
                created_at: row.created_at,
                updated_at: row.updated_at,
            });
        }

        let total_tasks = tasks.len() as i64;
        let progress_percentage = if total_tasks > 0 {
            (completed_tasks as f64 / total_tasks as f64) * 100.0
        } else {
            0.0
        };

        // Build groups based on group_by parameter
        let groups = match group_by.as_deref() {
            Some("status") => {
                let mut status_groups: HashMap<String, serde_json::Value> = HashMap::new();

                for task in &tasks {
                    let entry = status_groups.entry(task.status.clone()).or_insert_with(|| {
                        serde_json::json!({
                            "count": 0,
                            "tasks": Vec::<Uuid>::new()
                        })
                    });

                    if let Some(obj) = entry.as_object_mut() {
                        if let Some(count) = obj.get_mut("count") {
                            *count = serde_json::json!(count.as_i64().unwrap_or(0) + 1);
                        }
                        if let Some(task_list) = obj.get_mut("tasks") {
                            if let Some(arr) = task_list.as_array_mut() {
                                arr.push(serde_json::json!(task.id.to_string()));
                            }
                        }
                    }
                }

                serde_json::to_value(status_groups).unwrap_or_else(|_| serde_json::json!({}))
            }
            _ => {
                // Default to grouping by story
                let mut story_groups: HashMap<String, serde_json::Value> = HashMap::new();

                for task in &tasks {
                    let entry = story_groups
                        .entry(task.story_id.to_string())
                        .or_insert_with(|| {
                            serde_json::json!({
                                "count": 0,
                                "tasks": Vec::<Uuid>::new()
                            })
                        });

                    if let Some(obj) = entry.as_object_mut() {
                        if let Some(count) = obj.get_mut("count") {
                            *count = serde_json::json!(count.as_i64().unwrap_or(0) + 1);
                        }
                        if let Some(task_list) = obj.get_mut("tasks") {
                            if let Some(arr) = task_list.as_array_mut() {
                                arr.push(serde_json::json!(task.id.to_string()));
                            }
                        }
                    }
                }

                serde_json::to_value(story_groups).unwrap_or_else(|_| serde_json::json!({}))
            }
        };

        Ok(SprintTaskBoardResponse {
            sprint: SprintMetadata {
                id: sprint_row.id,
                name: sprint_row.name,
                goal: sprint_row.goal,
                start_date: sprint_row.start_date,
                end_date: sprint_row.end_date,
                days_remaining,
                status: sprint_row.status,
                total_stories,
                total_tasks,
                completed_tasks,
                progress_percentage,
            },
            tasks,
            groups,
        })
    }
}
