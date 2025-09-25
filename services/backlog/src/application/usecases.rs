use crate::application::ports::{ReadinessService, StoryRepository, TaskRepository};
use crate::domain::{Story, StoryStatus, Task};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct BacklogUsecases {
    story_repo: Arc<dyn StoryRepository>,
    task_repo: Arc<dyn TaskRepository>,
    readiness_service: Arc<dyn ReadinessService>,
}

impl BacklogUsecases {
    pub fn new(
        story_repo: Arc<dyn StoryRepository>,
        task_repo: Arc<dyn TaskRepository>,
        readiness_service: Arc<dyn ReadinessService>,
    ) -> Self {
        Self {
            story_repo,
            task_repo,
            readiness_service,
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

        self.story_repo.create_story(&story).await?;
        Ok(story.id)
    }

    pub async fn get_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Story>, AppError> {
        self.story_repo.get_story(id, organization_id).await
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

    pub async fn update_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        title: Option<String>,
        description: Option<String>,
        labels: Option<Vec<String>>,
    ) -> Result<(), AppError> {
        let mut story = self
            .story_repo
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", id)))?;

        if let Some(title) = title {
            story.title = title;
        }
        if let Some(description) = description {
            story.description = Some(description);
        }
        if let Some(labels) = labels {
            story.labels = labels;
        }

        self.story_repo.update_story(&story).await
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
            .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", id)))?;

        story.update_status(status)?;
        self.story_repo.update_story(&story).await
    }

    pub async fn delete_story(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        // Check if story exists
        self.story_repo
            .get_story(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", id)))?;

        self.story_repo.delete_story(id, organization_id).await
    }

    pub async fn create_task(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        title: String,
        description: Option<String>,
        acceptance_criteria_refs: Vec<String>,
    ) -> Result<Uuid, AppError> {
        // Verify story exists
        self.story_repo
            .get_story(story_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Story with id {} not found", story_id)))?;

        // Validate AC refs against the story's acceptance criteria
        let invalid_refs = self
            .readiness_service
            .validate_acceptance_criteria_refs(story_id, &acceptance_criteria_refs)
            .await?;

        if !invalid_refs.is_empty() {
            return Err(AppError::BadRequest(format!(
                "Invalid acceptance criteria references: {}",
                invalid_refs.join(", ")
            )));
        }

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

    #[allow(dead_code)]
    pub async fn get_task(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<Task>, AppError> {
        self.task_repo.get_task(id, organization_id).await
    }

    #[allow(dead_code)]
    pub async fn update_task(
        &self,
        id: Uuid,
        organization_id: Option<Uuid>,
        title: Option<String>,
        description: Option<String>,
        acceptance_criteria_refs: Option<Vec<String>>,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", id)))?;

        if let Some(title) = title {
            task.title = title;
        }
        if let Some(description) = description {
            task.description = Some(description);
        }
        if let Some(ac_refs) = acceptance_criteria_refs {
            // Validate AC refs against the story's acceptance criteria
            let invalid_refs = self
                .readiness_service
                .validate_acceptance_criteria_refs(task.story_id, &ac_refs)
                .await?;

            if !invalid_refs.is_empty() {
                return Err(AppError::BadRequest(format!(
                    "Invalid acceptance criteria references: {}",
                    invalid_refs.join(", ")
                )));
            }

            task.update_acceptance_criteria_refs(ac_refs)?;
        }

        self.task_repo.update_task(&task).await
    }

    // Task ownership self-selection use cases
    pub async fn take_task_ownership(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        let success = self
            .task_repo
            .take_task_ownership_atomic(task_id, organization_id, user_id)
            .await?;

        if !success {
            return Err(AppError::Conflict(
                "Task is already owned by another user".to_string(),
            ));
        }

        Ok(())
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
            .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", task_id)))?;

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
            .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", task_id)))?;

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
            .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", task_id)))?;

        task.complete(user_id)?;
        self.task_repo.update_task(&task).await
    }

    pub async fn set_task_estimate(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
        user_id: Uuid,
        estimated_hours: Option<u32>,
    ) -> Result<(), AppError> {
        let mut task = self
            .task_repo
            .get_task(task_id, organization_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", task_id)))?;

        // Verify user owns the task
        if task.owner_user_id != Some(user_id) {
            return Err(AppError::Forbidden(
                "Only the task owner can set estimates".to_string(),
            ));
        }

        task.set_estimated_hours(estimated_hours)?;
        self.task_repo.update_task(&task).await
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

        Ok(tasks
            .into_iter()
            .filter(|task| task.status.is_available())
            .collect())
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
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockStoryRepository {
        stories: Mutex<HashMap<Uuid, Story>>,
    }

    #[async_trait]
    impl StoryRepository for MockStoryRepository {
        async fn create_story(&self, story: &Story) -> Result<(), AppError> {
            let mut stories = self.stories.lock().unwrap();
            stories.insert(story.id, story.clone());
            Ok(())
        }

        async fn get_story(
            &self,
            id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<Story>, AppError> {
            let stories = self.stories.lock().unwrap();
            Ok(stories.get(&id).cloned())
        }

        async fn update_story(&self, story: &Story) -> Result<(), AppError> {
            let mut stories = self.stories.lock().unwrap();
            stories.insert(story.id, story.clone());
            Ok(())
        }

        async fn delete_story(
            &self,
            id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<(), AppError> {
            let mut stories = self.stories.lock().unwrap();
            stories.remove(&id);
            Ok(())
        }

        async fn get_stories_by_project(
            &self,
            project_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Vec<Story>, AppError> {
            let stories = self.stories.lock().unwrap();
            Ok(stories
                .values()
                .filter(|s| s.project_id == project_id)
                .cloned()
                .collect())
        }
    }

    #[derive(Default)]
    struct MockTaskRepository {
        tasks: Mutex<HashMap<Uuid, Task>>,
    }

    #[async_trait]
    impl TaskRepository for MockTaskRepository {
        async fn create_task(&self, task: &Task) -> Result<(), AppError> {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.insert(task.id, task.clone());
            Ok(())
        }

        async fn get_task(
            &self,
            id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Option<Task>, AppError> {
            let tasks = self.tasks.lock().unwrap();
            Ok(tasks.get(&id).cloned())
        }

        async fn get_tasks_by_story(
            &self,
            story_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Vec<Task>, AppError> {
            let tasks = self.tasks.lock().unwrap();
            Ok(tasks
                .values()
                .filter(|t| t.story_id == story_id)
                .cloned()
                .collect())
        }

        async fn update_task(&self, task: &Task) -> Result<(), AppError> {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.insert(task.id, task.clone());
            Ok(())
        }

        async fn delete_task(
            &self,
            id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<(), AppError> {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.remove(&id);
            Ok(())
        }

        async fn get_tasks_by_owner(
            &self,
            user_id: Uuid,
            _organization_id: Option<Uuid>,
        ) -> Result<Vec<Task>, AppError> {
            let tasks = self.tasks.lock().unwrap();
            Ok(tasks
                .values()
                .filter(|t| t.owner_user_id == Some(user_id))
                .cloned()
                .collect())
        }

        async fn take_task_ownership_atomic(
            &self,
            task_id: Uuid,
            _organization_id: Option<Uuid>,
            user_id: Uuid,
        ) -> Result<bool, AppError> {
            let mut tasks = self.tasks.lock().unwrap();
            if let Some(task) = tasks.get_mut(&task_id) {
                if task.status == crate::domain::TaskStatus::Available {
                    task.status = crate::domain::TaskStatus::Owned;
                    task.owner_user_id = Some(user_id);
                    task.owned_at = Some(chrono::Utc::now());
                    task.updated_at = chrono::Utc::now();
                    return Ok(true);
                }
            }
            Ok(false)
        }
    }

    struct MockReadinessService;

    #[async_trait]
    impl ReadinessService for MockReadinessService {
        async fn validate_acceptance_criteria_refs(
            &self,
            _story_id: Uuid,
            ac_refs: &[String],
        ) -> Result<Vec<String>, AppError> {
            // For testing, assume AC1, AC2, AC3 are valid
            let valid_refs = ["AC1", "AC2", "AC3"];
            let invalid = ac_refs
                .iter()
                .filter(|r| !valid_refs.contains(&r.as_str()))
                .cloned()
                .collect();
            Ok(invalid)
        }
    }

    fn setup_usecases() -> BacklogUsecases {
        let story_repo = Arc::new(MockStoryRepository::default());
        let task_repo = Arc::new(MockTaskRepository::default());
        let readiness_service = Arc::new(MockReadinessService);
        BacklogUsecases::new(story_repo, task_repo, readiness_service)
    }

    #[tokio::test]
    async fn test_create_and_get_story() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();

        let story_id = usecases
            .create_story(
                project_id,
                None,
                "Test story".to_string(),
                Some("Description".to_string()),
                vec!["label1".to_string()],
            )
            .await
            .unwrap();

        let story = usecases.get_story(story_id, None).await.unwrap().unwrap();
        assert_eq!(story.title, "Test story");
        assert_eq!(story.project_id, project_id);
        assert!(story.labels.contains(&"label1".to_string()));
    }

    #[tokio::test]
    async fn test_create_task_with_valid_ac_refs() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();

        // First create a story
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        // Create task with valid AC refs
        let task_id = usecases
            .create_task(
                story_id,
                None,
                "Test task".to_string(),
                None,
                vec!["AC1".to_string(), "AC2".to_string()],
            )
            .await
            .unwrap();

        let task = usecases.get_task(task_id, None).await.unwrap().unwrap();
        assert_eq!(task.title, "Test task");
        assert_eq!(task.acceptance_criteria_refs, vec!["AC1", "AC2"]);
    }

    #[tokio::test]
    async fn test_create_task_with_invalid_ac_refs() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();

        // First create a story
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        // Try to create task with invalid AC refs
        let result = usecases
            .create_task(
                story_id,
                None,
                "Test task".to_string(),
                None,
                vec!["INVALID_AC".to_string()],
            )
            .await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::BadRequest(_)));
    }

    #[tokio::test]
    async fn test_take_task_ownership() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        // Create story and task
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        let task_id = usecases
            .create_task(
                story_id,
                None,
                "Test task".to_string(),
                None,
                vec!["AC1".to_string()],
            )
            .await
            .unwrap();

        // Take ownership
        usecases
            .take_task_ownership(task_id, None, user_id)
            .await
            .unwrap();

        // Verify ownership
        let task = usecases.get_task(task_id, None).await.unwrap().unwrap();
        assert_eq!(task.owner_user_id, Some(user_id));
        assert!(!task.status.is_available());
    }

    #[tokio::test]
    async fn test_start_and_complete_task_work() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        // Create story and task
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        let task_id = usecases
            .create_task(
                story_id,
                None,
                "Test task".to_string(),
                None,
                vec!["AC1".to_string()],
            )
            .await
            .unwrap();

        // Take ownership and start work
        usecases
            .take_task_ownership(task_id, None, user_id)
            .await
            .unwrap();

        usecases
            .start_task_work(task_id, None, user_id)
            .await
            .unwrap();

        // Verify in progress
        let task = usecases.get_task(task_id, None).await.unwrap().unwrap();
        assert!(task.status.is_active());

        // Complete work
        usecases
            .complete_task_work(task_id, None, user_id)
            .await
            .unwrap();

        // Verify completed
        let task = usecases.get_task(task_id, None).await.unwrap().unwrap();
        assert!(task.status.is_completed());
    }

    #[tokio::test]
    async fn test_get_available_tasks() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        // Create story and tasks
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        let task1_id = usecases
            .create_task(
                story_id,
                None,
                "Available task".to_string(),
                None,
                vec!["AC1".to_string()],
            )
            .await
            .unwrap();

        let task2_id = usecases
            .create_task(
                story_id,
                None,
                "Owned task".to_string(),
                None,
                vec!["AC2".to_string()],
            )
            .await
            .unwrap();

        // Take ownership of one task
        usecases
            .take_task_ownership(task2_id, None, user_id)
            .await
            .unwrap();

        // Get available tasks
        let available_tasks = usecases.get_available_tasks(story_id, None).await.unwrap();

        assert_eq!(available_tasks.len(), 1);
        assert_eq!(available_tasks[0].id, task1_id);
    }

    #[tokio::test]
    async fn test_get_user_owned_tasks() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        // Create story and tasks
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        let task1_id = usecases
            .create_task(
                story_id,
                None,
                "User task 1".to_string(),
                None,
                vec!["AC1".to_string()],
            )
            .await
            .unwrap();

        let task2_id = usecases
            .create_task(
                story_id,
                None,
                "User task 2".to_string(),
                None,
                vec!["AC2".to_string()],
            )
            .await
            .unwrap();

        // Take ownership of both tasks
        usecases
            .take_task_ownership(task1_id, None, user_id)
            .await
            .unwrap();
        usecases
            .take_task_ownership(task2_id, None, user_id)
            .await
            .unwrap();

        // Get user owned tasks
        let owned_tasks = usecases.get_user_owned_tasks(user_id, None).await.unwrap();

        assert_eq!(owned_tasks.len(), 2);
        let task_ids: Vec<_> = owned_tasks.iter().map(|t| t.id).collect();
        assert!(task_ids.contains(&task1_id));
        assert!(task_ids.contains(&task2_id));
    }

    #[tokio::test]
    async fn test_set_task_estimate_authorization() {
        let usecases = setup_usecases();
        let project_id = Uuid::new_v4();
        let owner_id = Uuid::new_v4();
        let other_user_id = Uuid::new_v4();

        // Create story and task
        let story_id = usecases
            .create_story(project_id, None, "Test story".to_string(), None, vec![])
            .await
            .unwrap();

        let task_id = usecases
            .create_task(
                story_id,
                None,
                "Test task".to_string(),
                None,
                vec!["AC1".to_string()],
            )
            .await
            .unwrap();

        // Take ownership
        usecases
            .take_task_ownership(task_id, None, owner_id)
            .await
            .unwrap();

        // Owner can set estimate
        usecases
            .set_task_estimate(task_id, None, owner_id, Some(8))
            .await
            .unwrap();

        let task = usecases.get_task(task_id, None).await.unwrap().unwrap();
        assert_eq!(task.estimated_hours, Some(8));

        // Other user cannot set estimate
        let result = usecases
            .set_task_estimate(task_id, None, other_user_id, Some(16))
            .await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::Forbidden(_)));
    }
}
