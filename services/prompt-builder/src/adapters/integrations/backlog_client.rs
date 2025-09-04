use crate::application::ports::{BacklogService, StoryInfo, TaskInfo};
use async_trait::async_trait;
use common::AppError;
use serde::Deserialize;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct StoryResponse {
    id: Uuid,
    #[serde(rename = "projectId")]
    project_id: Uuid,
    title: String,
    description: Option<String>,
    status: String,
    labels: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TaskResponse {
    id: Uuid,
    #[serde(rename = "storyId")]
    story_id: Uuid,
    title: String,
    description: Option<String>,
    #[serde(rename = "acceptanceCriteriaRefs")]
    acceptance_criteria_refs: Vec<String>,
}

pub struct HttpBacklogService {
    client: reqwest::Client,
    base_url: String,
}

impl HttpBacklogService {
    pub fn new(base_url: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url,
        }
    }
}

#[async_trait]
impl BacklogService for HttpBacklogService {
    async fn get_story_info(&self, story_id: Uuid) -> Result<Option<StoryInfo>, AppError> {
        let url = format!("{}/stories/{}", self.base_url, story_id);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let story: StoryResponse = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(Some(StoryInfo {
            id: story.id,
            title: story.title,
            description: story.description,
            status: story.status,
        }))
    }

    async fn get_task_info(&self, task_id: Uuid) -> Result<Option<TaskInfo>, AppError> {
        // For now, we'll need to get the task by searching through stories
        // This could be optimized with a direct task endpoint in the future
        let url = format!("{}/tasks/{}", self.base_url, task_id);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let task: TaskResponse = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(Some(TaskInfo {
            id: task.id,
            story_id: task.story_id,
            title: task.title,
            description: task.description,
            acceptance_criteria_refs: task.acceptance_criteria_refs,
        }))
    }
}
