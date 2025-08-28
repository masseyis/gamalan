use crate::application::ports::{
    AcceptanceCriterion, LlmService, PlanPackGeneration, ProposedTaskGeneration, StoryInfo,
    TaskInfo, TaskPackGeneration,
};
use async_trait::async_trait;
use common::AppError;
use serde::{Deserialize, Serialize};

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

    async fn generate_completion(&self, prompt: String) -> Result<String, AppError> {
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

        Ok(response_data
            .choices
            .first()
            .ok_or(AppError::InternalServerError)?
            .message
            .content
            .clone())
    }

    fn create_plan_pack_prompt(
        &self,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> String {
        let description = story
            .description
            .as_deref()
            .unwrap_or("No description provided");
        let criteria_text = criteria
            .iter()
            .map(|ac| {
                format!(
                    "- {}: Given {}, when {}, then {}",
                    ac.ac_id, ac.given, ac.when, ac.then
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            "Generate a Plan Pack for this user story. Analyze the story and acceptance criteria to propose 2-5 implementation tasks.\n\n\
            Story: {}\n\
            Description: {}\n\n\
            Acceptance Criteria:\n{}\n\n\
            Respond with ONLY a JSON object with this structure:\n\
            {{\n  \
              \"proposed_tasks\": [\n    \
                {{\n      \
                  \"title\": \"Task title\",\n      \
                  \"description\": \"Detailed task description\",\n      \
                  \"acceptance_criteria_refs\": [\"AC1\", \"AC2\"],\n      \
                  \"estimated_effort\": \"Small/Medium/Large\",\n      \
                  \"technical_notes\": \"Optional technical considerations\"\n    \
                }}\n  \
              ],\n  \
              \"architecture_impact\": \"Description of architectural changes\",\n  \
              \"risks\": [\"Risk 1\", \"Risk 2\"],\n  \
              \"unknowns\": [\"Unknown 1\", \"Unknown 2\"]\n\
            }}\n\n\
            Ensure all acceptance criteria are covered by at least one task. Each task should be small enough to complete in 1-2 days.",
            story.title, description, criteria_text
        )
    }

    fn create_task_pack_prompt(
        &self,
        task: &TaskInfo,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> String {
        let task_description = task
            .description
            .as_deref()
            .unwrap_or("No description provided");
        let story_description = story
            .description
            .as_deref()
            .unwrap_or("No description provided");
        let criteria_text = criteria
            .iter()
            .map(|ac| {
                format!(
                    "- {}: Given {}, when {}, then {}",
                    ac.ac_id, ac.given, ac.when, ac.then
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        format!(
            "Generate a Task Pack for this implementation task. Create comprehensive, unambiguous instructions for a developer (potentially AI/junior).\n\n\
            Story Context: {} - {}\n\
            Task: {} - {}\n\n\
            Acceptance Criteria to Cover:\n{}\n\n\
            Respond with ONLY a JSON object with this structure:\n\
            {{\n  \
              \"objectives\": \"Clear, specific objectives for this task\",\n  \
              \"non_goals\": [\"What NOT to implement in this task\"],\n  \
              \"file_paths\": [\"src/handlers.rs\", \"src/domain/user.rs\"],\n  \
              \"ports_to_implement\": [\"UserRepository\", \"EmailService\"],\n  \
              \"dtos_to_create\": [\"CreateUserRequest\", \"UserResponse\"],\n  \
              \"architecture_notes\": \"Follow hexagonal architecture patterns\",\n  \
              \"unit_tests\": [\"Test user creation\", \"Test validation\"],\n  \
              \"integration_tests\": [\"Test user API endpoint\"],\n  \
              \"contract_tests\": [\"Test OpenAPI compliance\"],\n  \
              \"coverage_threshold\": 85,\n  \
              \"forbidden_actions\": [\"Skip tests\", \"Bypass validation\"],\n  \
              \"no_shortcuts\": [\"Don't hardcode values\", \"Don't skip error handling\"],\n  \
              \"required_practices\": [\"Write tests first\", \"Follow TDD\"],\n  \
              \"commit_message_template\": \"feat: implement user creation functionality\",\n  \
              \"pre_commit_checks\": [\"cargo fmt\", \"cargo clippy\", \"cargo test\"],\n  \
              \"run_instructions\": [\"Run cargo test\", \"Run integration tests\"]\n\
            }}\n\n\
            Focus on creating safe, testable, architecture-compliant code. Include specific do-not items to prevent shortcuts.",
            story.title, story_description, task.title, task_description, criteria_text
        )
    }
}

#[async_trait]
impl LlmService for OpenAiLlmService {
    async fn generate_plan_pack(
        &self,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<PlanPackGeneration, AppError> {
        let prompt = self.create_plan_pack_prompt(story, criteria);
        let response = self.generate_completion(prompt).await?;

        #[derive(Deserialize)]
        struct PlanPackResponse {
            proposed_tasks: Vec<ProposedTaskResponse>,
            architecture_impact: Option<String>,
            risks: Vec<String>,
            unknowns: Vec<String>,
        }

        #[derive(Deserialize)]
        struct ProposedTaskResponse {
            title: String,
            description: String,
            acceptance_criteria_refs: Vec<String>,
            estimated_effort: Option<String>,
            technical_notes: Option<String>,
        }

        let parsed: PlanPackResponse = serde_json::from_str(&response)
            .map_err(|_| AppError::BadRequest("LLM returned invalid JSON format".to_string()))?;

        Ok(PlanPackGeneration {
            proposed_tasks: parsed
                .proposed_tasks
                .into_iter()
                .map(|t| ProposedTaskGeneration {
                    title: t.title,
                    description: t.description,
                    acceptance_criteria_refs: t.acceptance_criteria_refs,
                    estimated_effort: t.estimated_effort,
                    technical_notes: t.technical_notes,
                })
                .collect(),
            architecture_impact: parsed.architecture_impact,
            risks: parsed.risks,
            unknowns: parsed.unknowns,
        })
    }

    async fn generate_task_pack(
        &self,
        task: &TaskInfo,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<TaskPackGeneration, AppError> {
        let prompt = self.create_task_pack_prompt(task, story, criteria);
        let response = self.generate_completion(prompt).await?;

        let parsed: TaskPackGeneration = serde_json::from_str(&response)
            .map_err(|_| AppError::BadRequest("LLM returned invalid JSON format".to_string()))?;

        Ok(parsed)
    }
}

// Mock implementation for development
pub struct MockLlmService;

#[async_trait]
impl LlmService for MockLlmService {
    async fn generate_plan_pack(
        &self,
        story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<PlanPackGeneration, AppError> {
        let ac_refs: Vec<String> = criteria.iter().map(|c| c.ac_id.clone()).collect();

        Ok(PlanPackGeneration {
            proposed_tasks: vec![
                ProposedTaskGeneration {
                    title: format!("Implement core functionality for {}", story.title),
                    description: "Implement the main business logic and domain models".to_string(),
                    acceptance_criteria_refs: ac_refs.clone(),
                    estimated_effort: Some("Medium".to_string()),
                    technical_notes: Some("Follow hexagonal architecture patterns".to_string()),
                },
                ProposedTaskGeneration {
                    title: format!("Add API endpoints for {}", story.title),
                    description: "Create HTTP handlers and routes".to_string(),
                    acceptance_criteria_refs: ac_refs,
                    estimated_effort: Some("Small".to_string()),
                    technical_notes: Some("Include OpenAPI documentation".to_string()),
                },
            ],
            architecture_impact: Some("Minimal impact to existing architecture".to_string()),
            risks: vec!["Low implementation risk".to_string()],
            unknowns: vec!["Integration complexity TBD".to_string()],
        })
    }

    async fn generate_task_pack(
        &self,
        task: &TaskInfo,
        _story: &StoryInfo,
        criteria: &[AcceptanceCriterion],
    ) -> Result<TaskPackGeneration, AppError> {
        let _ac_refs: Vec<String> = criteria.iter().map(|c| c.ac_id.clone()).collect();

        Ok(TaskPackGeneration {
            objectives: format!("Implement {}", task.title),
            non_goals: vec!["Don't implement related features not in scope".to_string()],
            file_paths: vec![
                "src/handlers.rs".to_string(),
                "src/domain/mod.rs".to_string(),
            ],
            ports_to_implement: vec!["Repository".to_string()],
            dtos_to_create: vec!["Request".to_string(), "Response".to_string()],
            architecture_notes: "Follow hexagonal architecture with proper dependency injection"
                .to_string(),
            unit_tests: vec![
                "Test domain logic".to_string(),
                "Test validation".to_string(),
            ],
            integration_tests: vec!["Test API endpoints".to_string()],
            contract_tests: vec!["Test OpenAPI compliance".to_string()],
            coverage_threshold: Some(85),
            forbidden_actions: vec![
                "Skip writing tests".to_string(),
                "Bypass validation".to_string(),
            ],
            no_shortcuts: vec!["Don't hardcode configuration".to_string()],
            required_practices: vec![
                "Write tests first".to_string(),
                "Follow TDD approach".to_string(),
            ],
            commit_message_template: format!("feat: implement {}", task.title.to_lowercase()),
            pre_commit_checks: vec![
                "cargo fmt".to_string(),
                "cargo clippy".to_string(),
                "cargo test".to_string(),
            ],
            run_instructions: vec![
                "Run cargo test --lib for unit tests".to_string(),
                "Run cargo test --test integration for integration tests".to_string(),
                "Verify coverage with cargo tarpaulin".to_string(),
            ],
        })
    }
}
