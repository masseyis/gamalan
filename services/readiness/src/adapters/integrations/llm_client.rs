use crate::application::ports::{LlmService, StoryInfo, TaskInfo};
use crate::domain::{AcceptanceCriterion, DimensionScore, TaskClarityAnalysis, TaskSuggestion};
use async_trait::async_trait;
use common::AppError;
use serde::{Deserialize, Serialize};

// Mock implementation for development
pub struct MockLlmService;

#[async_trait]
impl LlmService for MockLlmService {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        // Generate simple default criteria for development
        let criteria = vec![
            AcceptanceCriterion::new(
                story_info.id,
                None,
                "AC1".to_string(),
                "user is authenticated".to_string(),
                "user interacts with the feature".to_string(),
                "system responds appropriately".to_string(),
            )?,
            AcceptanceCriterion::new(
                story_info.id,
                None,
                "AC2".to_string(),
                "system is in valid state".to_string(),
                "user completes the action".to_string(),
                "changes are saved successfully".to_string(),
            )?,
        ];

        Ok(criteria)
    }

    async fn analyze_task(
        &self,
        task_info: &TaskInfo,
        _ac_refs: &[AcceptanceCriterion],
    ) -> Result<TaskClarityAnalysis, AppError> {
        // Mock analysis based on task characteristics
        let has_file_paths = task_info
            .description
            .as_ref()
            .map(|d| d.contains("services/") || d.contains(".rs"))
            .unwrap_or(false);

        let has_vague_terms = task_info
            .description
            .as_ref()
            .map(|d| d.contains("should") || d.contains("maybe") || d.contains("might"))
            .unwrap_or(false);

        let has_ac_refs = !task_info.acceptance_criteria_refs.is_empty();

        // Calculate mock dimensions
        let technical_score = if has_file_paths { 85 } else { 50 };
        let specificity_score = if has_vague_terms { 45 } else { 75 };
        let completeness_score = if has_ac_refs { 80 } else { 60 };

        let dimensions = vec![
            DimensionScore::new(
                "technical".to_string(),
                technical_score,
                0.25,
                Some("Technical details assessment".to_string()),
            ),
            DimensionScore::new(
                "specificity".to_string(),
                specificity_score,
                0.15,
                Some("Language specificity assessment".to_string()),
            ),
            DimensionScore::new(
                "completeness".to_string(),
                completeness_score,
                0.20,
                Some("Context completeness assessment".to_string()),
            ),
        ];

        let overall_score = (technical_score as f32 * 0.25
            + specificity_score as f32 * 0.15
            + completeness_score as f32 * 0.20) as u8;

        let mut recommendations = Vec::new();
        if !has_file_paths {
            recommendations.push("Add specific file paths and components to modify".to_string());
        }
        if has_vague_terms {
            recommendations.push("Replace vague terms with concrete actions".to_string());
        }
        if !has_ac_refs {
            recommendations.push("Reference specific acceptance criteria".to_string());
        }

        let flagged_terms = if has_vague_terms {
            vec!["should".to_string(), "maybe".to_string()]
        } else {
            vec![]
        };

        Ok(TaskClarityAnalysis::new(
            task_info.id,
            overall_score,
            dimensions,
            recommendations,
            flagged_terms,
        ))
    }

    async fn suggest_tasks(
        &self,
        story_info: &StoryInfo,
        _github_context: &str,
        _existing_tasks: &[TaskInfo],
    ) -> Result<Vec<TaskSuggestion>, AppError> {
        // Generate mock task suggestions based on story characteristics
        let is_backend = story_info.title.to_lowercase().contains("api")
            || story_info.title.to_lowercase().contains("backend")
            || story_info.title.to_lowercase().contains("service");

        let is_frontend = story_info.title.to_lowercase().contains("ui")
            || story_info.title.to_lowercase().contains("frontend")
            || story_info.title.to_lowercase().contains("component");

        let mut suggestions = Vec::new();

        if is_backend {
            suggestions.push(TaskSuggestion::new(
                format!("[Backend] Implement domain logic for {}", story_info.title),
                "Create domain entities and business logic in services/<name>/src/domain/"
                    .to_string(),
                vec!["AC1".to_string()],
                Some(3),
                vec!["services/<name>/src/domain/".to_string()],
                0.85,
            ));

            suggestions.push(TaskSuggestion::new(
                format!("[Backend] Add API endpoints for {}", story_info.title),
                "Implement HTTP handlers in adapters/http/".to_string(),
                vec!["AC1".to_string(), "AC2".to_string()],
                Some(2),
                vec!["services/<name>/src/adapters/http/handlers.rs".to_string()],
                0.80,
            ));
        }

        if is_frontend {
            suggestions.push(TaskSuggestion::new(
                format!("[Frontend] Create UI components for {}", story_info.title),
                "Build React components in apps/web/components/".to_string(),
                vec!["AC1".to_string()],
                Some(4),
                vec!["apps/web/components/".to_string()],
                0.82,
            ));
        }

        // Always suggest tests
        suggestions.push(TaskSuggestion::new(
            format!("[QA] Write tests for {}", story_info.title),
            "Create unit and integration tests covering all acceptance criteria".to_string(),
            vec!["AC1".to_string(), "AC2".to_string()],
            Some(2),
            vec!["tests/".to_string()],
            0.90,
        ));

        Ok(suggestions)
    }
}

#[derive(Debug, Serialize)]
struct GenerateRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
}

#[derive(Debug, Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct GenerateResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

pub struct OpenAiLlmService {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl OpenAiLlmService {
    pub fn new(api_key: String, model: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key,
            model: model.unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
        }
    }

    fn create_prompt(&self, story_info: &StoryInfo) -> String {
        let description = story_info
            .description
            .as_deref()
            .unwrap_or("No description provided");

        format!(
            "Given the following user story, generate 2-5 acceptance criteria in Given/When/Then format.\n\n\
            Story Title: {}\n\
            Description: {}\n\n\
            Please respond with ONLY a JSON array where each item has the format:\n\
            {{\"ac_id\": \"AC1\", \"given\": \"...\", \"when\": \"...\", \"then\": \"...\"}}\n\n\
            Make sure each ac_id is unique (AC1, AC2, AC3, etc.) and each criterion is specific and testable.",
            story_info.title, description
        )
    }
}

#[async_trait]
impl LlmService for OpenAiLlmService {
    async fn generate_acceptance_criteria(
        &self,
        story_info: &StoryInfo,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        let prompt = self.create_prompt(story_info);

        let request = GenerateRequest {
            model: self.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: prompt,
            }],
            temperature: 0.3,
        };

        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        if !response.status().is_success() {
            return Err(AppError::InternalServerError);
        }

        let response_data: GenerateResponse = response
            .json()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        let content = response_data
            .choices
            .first()
            .ok_or(AppError::InternalServerError)?
            .message
            .content
            .clone();

        // Parse the JSON response
        #[derive(Deserialize)]
        struct CriterionJson {
            ac_id: String,
            given: String,
            when: String,
            then: String,
        }

        let criteria_json: Vec<CriterionJson> = serde_json::from_str(&content)
            .map_err(|_| AppError::BadRequest("LLM returned invalid JSON format".to_string()))?;

        let mut criteria = Vec::new();
        for c in criteria_json {
            let criterion =
                AcceptanceCriterion::new(story_info.id, None, c.ac_id, c.given, c.when, c.then)?;
            criteria.push(criterion);
        }

        Ok(criteria)
    }

    async fn analyze_task(
        &self,
        _task_info: &TaskInfo,
        _ac_refs: &[AcceptanceCriterion],
    ) -> Result<TaskClarityAnalysis, AppError> {
        // TODO: Implement OpenAI-based task analysis
        // For now, return error - use MockLlmService for development
        Err(AppError::BadRequest(
            "OpenAI task analysis not yet implemented - use MockLlmService".to_string(),
        ))
    }

    async fn suggest_tasks(
        &self,
        _story_info: &StoryInfo,
        _github_context: &str,
        _existing_tasks: &[TaskInfo],
    ) -> Result<Vec<TaskSuggestion>, AppError> {
        // TODO: Implement OpenAI-based task suggestions
        // For now, return error - use MockLlmService for development
        Err(AppError::BadRequest(
            "OpenAI task suggestions not yet implemented - use MockLlmService".to_string(),
        ))
    }
}
