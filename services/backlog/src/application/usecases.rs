use crate::application::ports::{StoryRepository, TaskRepository};
use crate::domain::{AcceptanceCriteria, Story, StoryStatus, Task, TaskStatus};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct BacklogUsecases {
    story_repo: Arc<dyn StoryRepository>,
    task_repo: Arc<dyn TaskRepository>,
}

impl BacklogUsecases {
    pub fn new(story_repo: Arc<dyn StoryRepository>, task_repo: Arc<dyn TaskRepository>) -> Self {
        Self {
            story_repo,
            task_repo,
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
        self.story_repo.create_story(&story).await
    }

    pub async fn get_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Story>, AppError> {
        self.story_repo.get_story(id, organization_id).await
    }

    pub async fn update_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        title: Option<String>,
        description: Option<Option<String>>,
        labels: Option<Vec<String>>,
        story_points: Option<u32>,
    ) -> Result<(), AppError> {
        let mut story = self
            .story_repo
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.update(title, description, labels, story_points)?;
        self.story_repo.update_story(&story).await
    }

    pub async fn override_story_ready(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
        reason: Option<String>,
    ) -> Result<Story, AppError> {
        let mut story = self
            .story_repo
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.apply_readiness_override(user_id, reason);
        self.story_repo.update_story(&story).await?;
        Ok(story)
    }

    pub async fn update_story_status(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        status: StoryStatus,
    ) -> Result<(), AppError> {
        let mut story = self
            .story_repo
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.update_status(status)?;
        self.story_repo.update_story(&story).await
    }

    pub async fn delete_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        self.story_repo.delete_story(id, organization_id).await
    }

    pub async fn get_stories_by_project(
        &self,
        project_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Story>, AppError> {
        self.story_repo
            .get_stories_by_project(project_id, organization_id)
            .await
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
        self.task_repo.create_task(&task).await?;
        Ok(task.id)
    }

    pub async fn get_tasks_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        self.task_repo
            .get_tasks_by_story(story_id, organization_id)
            .await
    }

    pub async fn get_available_tasks(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<Task>, AppError> {
        let tasks = self
            .task_repo
            .get_tasks_by_story(story_id, organization_id)
            .await?;
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
        self.task_repo
            .get_tasks_by_owner(user_id, organization_id)
            .await
    }

    pub async fn take_task_ownership(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.take_ownership(user_id)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn release_task_ownership(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.release_ownership(user_id)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn start_task_work(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.start_work(user_id)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn complete_task_work(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.complete(user_id)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn update_task_status(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
        status: TaskStatus,
    ) -> Result<Task, AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.transition_to_status(status, user_id)?;
        self.task_repo.update_task(&task).await?;

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
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

        task.set_estimated_hours(estimated_hours)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn get_acceptance_criteria(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriteria>, AppError> {
        let story = self
            .story_repo
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
            .story_repo
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        let description = format!("Given {}, when {}, then {}", given, when, then);
        let ac = AcceptanceCriteria::new(description, given, when, then)?;
        let ac_id = ac.id;
        story.add_acceptance_criteria(ac);
        self.story_repo.update_story(&story).await?;
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
            .story_repo
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

        self.story_repo.update_story(&story).await
    }

    pub async fn delete_acceptance_criterion(
        &self,
        criterion_id: Uuid,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        let mut story = self
            .story_repo
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Story not found".to_string()))?;

        story.remove_acceptance_criteria(criterion_id)?;
        self.story_repo.update_story(&story).await
    }
}
