use crate::application::ports::{StoryInfo, StoryService, TaskInfo};
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

#[allow(dead_code)]
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
impl StoryService for HttpBacklogService {
    async fn get_story_info(
        &self,
        story_id: Uuid,
        _organization_id: Option<Uuid>,
    ) -> Result<Option<StoryInfo>, AppError> {
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
        }))
    }

    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        _organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError> {
        let url = format!("{}/stories/{}/tasks", self.base_url, story_id);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if !response.status().is_success() {
            return Ok(Vec::new());
        }

        let tasks: Vec<TaskResponse> = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(tasks
            .into_iter()
            .map(|t| TaskInfo {
                id: t.id,
                story_id: t.story_id,
                title: t.title,
                acceptance_criteria_refs: t.acceptance_criteria_refs,
            })
            .collect())
    }
}
