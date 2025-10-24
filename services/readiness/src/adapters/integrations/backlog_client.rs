use crate::application::ports::{StoryInfo, StoryService, TaskInfo};
use async_trait::async_trait;
use common::AppError;
use serde::Deserialize;
use std::sync::Arc;
use tracing::{error, warn};
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Clone)]
pub struct InProcessBacklogService {
    backlog: Arc<backlog::application::BacklogUsecases>,
}

impl InProcessBacklogService {
    pub fn new(backlog: Arc<backlog::application::BacklogUsecases>) -> Self {
        Self { backlog }
    }
}

#[async_trait]
impl StoryService for InProcessBacklogService {
    async fn get_story_info(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<StoryInfo>, AppError> {
        let story = self.backlog.get_story(story_id, organization_id).await?;

        Ok(story.map(|story| StoryInfo {
            id: story.id,
            title: story.title,
            description: story.description,
            story_points: story.story_points,
        }))
    }

    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError> {
        let tasks = self
            .backlog
            .get_tasks_by_story(story_id, organization_id)
            .await?;

        Ok(tasks
            .into_iter()
            .map(|task| TaskInfo {
                id: task.id,
                story_id: task.story_id,
                title: task.title,
                acceptance_criteria_refs: task.acceptance_criteria_refs,
            })
            .collect())
    }
}

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
    #[serde(rename = "storyPoints")]
    story_points: Option<u32>,
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
        let normalized = base_url.trim_end_matches('/').to_string();
        tracing::info!("Initializing backlog client with base URL: {}", normalized);

        Self {
            client: reqwest::Client::new(),
            base_url: normalized,
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
        let response = self.client.get(&url).send().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to contact backlog service for story info"
            );
            AppError::InternalServerError
        })?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<body unavailable>".to_string());
            warn!(
                %story_id,
                %status,
                body = %body,
                "Backlog service returned non-success status for story info"
            );
            return Err(AppError::InternalServerError);
        }

        let story: StoryResponse = response.json().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to deserialize story response from backlog service"
            );
            AppError::InternalServerError
        })?;

        Ok(Some(StoryInfo {
            id: story.id,
            title: story.title,
            description: story.description,
            story_points: story.story_points,
        }))
    }

    async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        _organization_id: Option<Uuid>,
    ) -> Result<Vec<TaskInfo>, AppError> {
        let url = format!("{}/stories/{}/tasks", self.base_url, story_id);
        let response = self.client.get(&url).send().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to contact backlog service for task list"
            );
            AppError::InternalServerError
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<body unavailable>".to_string());
            warn!(
                %story_id,
                %status,
                body = %body,
                "Backlog service returned non-success status for task list"
            );
            return Ok(Vec::new());
        }

        let tasks: Vec<TaskResponse> = response.json().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to deserialize task response from backlog service"
            );
            AppError::InternalServerError
        })?;

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
