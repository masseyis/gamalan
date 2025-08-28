use crate::application::ports::{LlmService, StoryInfo};
use crate::domain::AcceptanceCriterion;
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
                "AC1".to_string(),
                "user is authenticated".to_string(),
                "user interacts with the feature".to_string(),
                "system responds appropriately".to_string(),
            )?,
            AcceptanceCriterion::new(
                story_info.id,
                "AC2".to_string(),
                "system is in valid state".to_string(),
                "user completes the action".to_string(),
                "changes are saved successfully".to_string(),
            )?,
        ];

        Ok(criteria)
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
                AcceptanceCriterion::new(story_info.id, c.ac_id, c.given, c.when, c.then)?;
            criteria.push(criterion);
        }

        Ok(criteria)
    }
}
