use crate::application::ports::{LlmClient, LlmResponse};
use crate::domain::CandidateEntity;
use async_openai::{
    types::{
        ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
        ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
        CreateChatCompletionRequest,
    },
    Client as OpenAIClient,
};
use async_trait::async_trait;
use common::AppError;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

#[allow(dead_code)]
pub struct OpenAILlmClient {
    client: OpenAIClient<async_openai::config::OpenAIConfig>,
    embedding_model: String,
    chat_model: String,
}

#[allow(dead_code)]
impl OpenAILlmClient {
    pub fn new(api_key: String) -> Self {
        let client = OpenAIClient::with_config(
            async_openai::config::OpenAIConfig::new().with_api_key(api_key),
        );

        Self {
            client,
            embedding_model: "text-embedding-ada-002".to_string(),
            chat_model: "gpt-4".to_string(),
        }
    }

    pub fn with_models(api_key: String, embedding_model: String, chat_model: String) -> Self {
        let client = OpenAIClient::with_config(
            async_openai::config::OpenAIConfig::new().with_api_key(api_key),
        );

        Self {
            client,
            embedding_model,
            chat_model,
        }
    }

    fn parse_llm_json_response(&self, content: &str) -> Result<LlmResponse, AppError> {
        // Extract JSON from the response (handle cases where LLM adds extra text)
        let json_str = if let Some(start) = content.find('{') {
            if let Some(end) = content.rfind('}') {
                &content[start..=end]
            } else {
                content
            }
        } else {
            content
        };

        let parsed: Value = serde_json::from_str(json_str)
            .map_err(|e| AppError::BadRequest(format!("Invalid JSON from LLM: {}", e)))?;

        let intent_type = parsed
            .get("intent_type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::BadRequest("Missing intent_type in LLM response".to_string()))?
            .to_string();

        let entities = parsed
            .get("entities")
            .and_then(|v| v.as_array())
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|entity| {
                let entity_id = entity
                    .get("entity_id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok())?;

                let entity_type = entity
                    .get("entity_type")
                    .and_then(|v| v.as_str())?
                    .to_string();

                let role = entity
                    .get("role")
                    .and_then(|v| v.as_str())
                    .unwrap_or("target")
                    .to_string();

                Some(crate::application::ports::EntityReference {
                    entity_id,
                    entity_type,
                    role,
                })
            })
            .collect::<Vec<crate::application::ports::EntityReference>>();

        let parameters = parsed
            .get("parameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect::<HashMap<String, Value>>()
            })
            .unwrap_or_default();

        // Calculate confidence based on response quality
        let confidence = self.calculate_response_confidence(&parsed, &entities);

        Ok(LlmResponse {
            intent_type,
            entities,
            parameters,
            confidence,
        })
    }

    fn calculate_response_confidence(
        &self,
        parsed: &Value,
        entities: &[crate::application::ports::EntityReference],
    ) -> f32 {
        let mut confidence: f32 = 0.7; // Base confidence

        // Boost if intent_type is recognized
        if let Some(intent_type) = parsed.get("intent_type").and_then(|v| v.as_str()) {
            match intent_type {
                "update_status" | "assign_task" | "query_status" | "search_items" => {
                    confidence += 0.2
                }
                "unknown" => confidence -= 0.3,
                _ => confidence += 0.1,
            }
        }

        // Boost if entities are present and valid
        if !entities.is_empty() {
            confidence += 0.1;
        }

        // Boost if parameters are present
        if parsed
            .get("parameters")
            .map(|p| p.as_object().map(|o| !o.is_empty()).unwrap_or(false))
            .unwrap_or(false)
        {
            confidence += 0.1;
        }

        confidence.clamp(0.0, 1.0)
    }

    // Simplified version without complex trait bounds - can be enhanced later
    async fn simple_retry<T, F, Fut>(&self, operation: F, max_retries: u32) -> Result<T, AppError>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = Result<T, AppError>>,
    {
        let mut last_error = AppError::InternalServerError;

        for attempt in 0..=max_retries {
            match operation().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = e;
                    if attempt < max_retries {
                        let delay = std::time::Duration::from_millis(2_u64.pow(attempt) * 1000);
                        tokio::time::sleep(delay).await;
                    }
                }
            }
        }

        Err(last_error)
    }
}

#[async_trait]
impl LlmClient for OpenAILlmClient {
    async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, AppError> {
        if text.trim().is_empty() {
            return Err(AppError::BadRequest("Empty text for embedding".to_string()));
        }

        // Truncate if text is too long (OpenAI has token limits)
        let _truncated_text = if text.len() > 8000 {
            &text[..8000]
        } else {
            text
        };

        // TODO: Fix OpenAI Embedding API - using stub for now
        // Return a dummy 1536-dimensional vector
        Ok(vec![0.0; 1536])
    }

    async fn parse_intent(
        &self,
        utterance: &str,
        _context: &[CandidateEntity],
        system_prompt: &str,
    ) -> Result<LlmResponse, AppError> {
        // Direct implementation - can add retry logic back later
        let messages = vec![
            ChatCompletionRequestMessage::System(ChatCompletionRequestSystemMessage {
                content: ChatCompletionRequestSystemMessageContent::Text(system_prompt.to_string()),
                name: None,
            }),
            ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
                content: format!("Parse this utterance: {}", utterance).into(),
                name: None,
            }),
        ];

        #[allow(deprecated)]
        let _request = CreateChatCompletionRequest {
            model: self.chat_model.clone(),
            messages,
            temperature: Some(0.1), // Low temperature for consistent parsing
            max_tokens: Some(500),  // Keep deprecated field until OpenAI client updates
            max_completion_tokens: None,
            top_p: None,
            n: None,
            stop: None,
            presence_penalty: None,
            frequency_penalty: None,
            logit_bias: None,
            user: None,
            response_format: None,
            seed: None,
            tools: None,
            tool_choice: None,
            logprobs: None,
            top_logprobs: None,
            stream: None,
            parallel_tool_calls: None,
            audio: None,
            metadata: None,
            modalities: None,
            prediction: None,
            service_tier: None,
            stream_options: None,
            function_call: None, // Keep deprecated field for now
            functions: None,     // Keep deprecated field for now
            reasoning_effort: None,
            store: None,
            web_search_options: None,
        };

        // TODO: Fix OpenAI API integration - using fallback for now
        // Temporary stub to get service compiling
        Ok(LlmResponse {
            intent_type: "unknown".to_string(),
            entities: vec![],
            parameters: std::collections::HashMap::new(),
            confidence: 0.5,
        })
    }

    async fn health_check(&self) -> Result<(), AppError> {
        // TODO: Implement proper health check
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_llm_json_response() {
        let client = OpenAILlmClient::new("test_key".to_string());

        let json_response = r#"
        {
            "intent_type": "update_status",
            "entities": [
                {
                    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
                    "entity_type": "story",
                    "role": "target"
                }
            ],
            "parameters": {
                "status": "in_progress"
            }
        }
        "#;

        let result = client.parse_llm_json_response(json_response);
        assert!(result.is_ok());

        let response = result.unwrap();
        assert_eq!(response.intent_type, "update_status");
        assert_eq!(response.entities.len(), 1);
        assert_eq!(response.entities[0].entity_type, "story");
        assert_eq!(
            response.parameters.get("status").unwrap().as_str().unwrap(),
            "in_progress"
        );
    }

    #[test]
    fn test_parse_malformed_json() {
        let client = OpenAILlmClient::new("test_key".to_string());

        let malformed_json = "This is not JSON at all";
        let result = client.parse_llm_json_response(malformed_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_response_confidence() {
        let client = OpenAILlmClient::new("test_key".to_string());

        let parsed = serde_json::json!({
            "intent_type": "update_status",
            "entities": [],
            "parameters": {"status": "done"}
        });

        let entities = vec![];
        let confidence = client.calculate_response_confidence(&parsed, &entities);

        assert!(confidence > 0.7); // Should be higher than base confidence
        assert!(confidence <= 1.0);
    }

    #[test]
    fn test_confidence_with_entities() {
        let client = OpenAILlmClient::new("test_key".to_string());

        let parsed = serde_json::json!({
            "intent_type": "update_status",
            "entities": [{"entity_id": "123", "entity_type": "story", "role": "target"}],
            "parameters": {"status": "done"}
        });

        let entities = vec![crate::application::ports::EntityReference {
            entity_id: Uuid::new_v4(),
            entity_type: "story".to_string(),
            role: "target".to_string(),
        }];

        let confidence = client.calculate_response_confidence(&parsed, &entities);

        // Should have higher confidence with entities and parameters
        assert!(confidence > 0.8);
    }

    #[test]
    fn test_unknown_intent_lowers_confidence() {
        let client = OpenAILlmClient::new("test_key".to_string());

        let parsed = serde_json::json!({
            "intent_type": "unknown",
            "entities": [],
            "parameters": {}
        });

        let entities = vec![];
        let confidence = client.calculate_response_confidence(&parsed, &entities);

        // Unknown intent should lower confidence
        assert!(confidence < 0.7);
    }
}
