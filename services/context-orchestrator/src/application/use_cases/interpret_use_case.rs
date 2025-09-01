use crate::application::ports::{
    IntentHistoryRepository, LlmClient, RateLimitRepository, VectorSearchRepository,
};
use crate::domain::{
    candidate_selector, intent_parser, CandidateEntity, IntentRecord, IntentType, ParsedIntent,
};
use chrono::{Duration, Utc};
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct InterpretUseCase {
    postgres_repo: Arc<dyn IntentHistoryRepository>,
    rate_limit_repo: Arc<dyn RateLimitRepository>,
    qdrant_repo: Arc<dyn VectorSearchRepository>,
    llm_client: Arc<dyn LlmClient>,
}

#[derive(Debug)]
pub struct InterpretResult {
    pub intent: IntentRecord,
    pub candidates: Vec<CandidateEntity>,
    pub requires_confirmation: bool,
    pub session_token: Option<Uuid>,
}

impl InterpretUseCase {
    pub fn new(
        postgres_repo: Arc<dyn IntentHistoryRepository>,
        rate_limit_repo: Arc<dyn RateLimitRepository>,
        qdrant_repo: Arc<dyn VectorSearchRepository>,
        llm_client: Arc<dyn LlmClient>,
    ) -> Self {
        Self {
            postgres_repo,
            rate_limit_repo,
            qdrant_repo,
            llm_client,
        }
    }

    pub async fn execute(
        &self,
        user_id: Uuid,
        tenant_id: Uuid,
        utterance: &str,
        context_limit: usize,
        entity_types: Option<Vec<String>>,
        disable_llm: bool,
    ) -> Result<InterpretResult, AppError> {
        // 1. Rate limiting check
        self.check_rate_limit(user_id).await?;

        // 2. Generate embedding for the utterance
        let embedding = self.llm_client.generate_embedding(utterance).await?;

        // 3. Vector search for similar entities
        let candidates = self
            .qdrant_repo
            .search_similar(
                embedding,
                tenant_id,
                entity_types,
                context_limit,
                Some(0.3), // Minimum similarity threshold
            )
            .await?;

        // 4. Rank and filter candidates
        let filtered_candidates =
            candidate_selector::filter_by_tenant(candidates, tenant_id);
            
        let _ranked_candidates = candidate_selector::rank_candidates(
            filtered_candidates.clone(),
            utterance,
        );

        // 5. Parse intent using LLM or fallback heuristics
        let parsed_intent = if disable_llm {
            intent_parser::fallback_heuristic_parse(utterance, &filtered_candidates)?
        } else {
            match self.parse_with_llm(utterance, &filtered_candidates).await {
                Ok(intent) => intent,
                Err(_) => {
                    // Fallback to heuristics if LLM fails
                    intent_parser::fallback_heuristic_parse(utterance, &filtered_candidates)?
                }
            }
        };

        // 6. Create intent record
        let candidate_ids: Vec<Uuid> = filtered_candidates.iter().map(|c| c.id).collect();
        let intent_record = IntentRecord::new(
            tenant_id,
            user_id,
            utterance,
            parsed_intent.clone(),
            0.8, // Default LLM confidence if using fallback
            self.calculate_service_confidence(&parsed_intent, &filtered_candidates),
            candidate_ids,
        );

        // 7. Record intent in database
        self.postgres_repo.record_intent(&intent_record).await?;

        // 8. Update rate limit bucket
        self.update_rate_limit(user_id).await?;

        // 9. Determine if confirmation is required
        let requires_confirmation = self.requires_confirmation(&parsed_intent);
        let session_token = if requires_confirmation {
            Some(Uuid::new_v4())
        } else {
            None
        };

        Ok(InterpretResult {
            intent: intent_record,
            candidates: filtered_candidates,
            requires_confirmation,
            session_token,
        })
    }

    async fn check_rate_limit(&self, user_id: Uuid) -> Result<(), AppError> {
        const RATE_LIMIT: i32 = 100; // requests per hour
        const REFILL_DURATION: i64 = 3600; // 1 hour in seconds

        let now = Utc::now();
        let bucket = self
            .rate_limit_repo
            .get_rate_limit_bucket(user_id, "interpret")
            .await?;

        match bucket {
            Some(mut bucket) => {
                // Calculate tokens to add based on time elapsed
                let elapsed = now.signed_duration_since(bucket.last_refill);
                let tokens_to_add = (elapsed.num_seconds() * RATE_LIMIT as i64) / REFILL_DURATION;
                
                bucket.token_count = std::cmp::min(
                    RATE_LIMIT,
                    bucket.token_count + tokens_to_add as i32,
                );

                if bucket.token_count <= 0 {
                    return Err(AppError::RateLimitExceeded);
                }

                // Token will be decremented in update_rate_limit
            }
            None => {
                // Create new bucket with full tokens
                self.rate_limit_repo
                    .update_rate_limit_bucket(user_id, "interpret", RATE_LIMIT - 1, now)
                    .await?;
                return Ok(());
            }
        }

        Ok(())
    }

    async fn update_rate_limit(&self, user_id: Uuid) -> Result<(), AppError> {
        let now = Utc::now();
        let bucket = self
            .rate_limit_repo
            .get_rate_limit_bucket(user_id, "interpret")
            .await?;

        if let Some(bucket) = bucket {
            self.rate_limit_repo
                .update_rate_limit_bucket(
                    user_id,
                    "interpret",
                    bucket.token_count - 1,
                    bucket.last_refill,
                )
                .await?;
        }

        Ok(())
    }

    async fn parse_with_llm(
        &self,
        utterance: &str,
        candidates: &[CandidateEntity],
    ) -> Result<ParsedIntent, AppError> {
        let system_prompt = self.build_system_prompt(candidates);
        let candidate_ids: Vec<Uuid> = candidates.iter().map(|c| c.id).collect();

        let llm_response = self
            .llm_client
            .parse_intent(utterance, candidates, &system_prompt)
            .await?;

        // Convert LLM response to domain ParsedIntent
        let intent_type = match llm_response.intent_type.as_str() {
            "update_status" => IntentType::UpdateStatus,
            "assign_task" => IntentType::AssignTask,
            "create_item" => IntentType::CreateItem,
            "query_status" => IntentType::QueryStatus,
            "search_items" => IntentType::SearchItems,
            "update_priority" => IntentType::UpdatePriority,
            "add_comment" => IntentType::AddComment,
            "move_to_sprint" => IntentType::MoveToSprint,
            "generate_report" => IntentType::GenerateReport,
            "archive" => IntentType::Archive,
            _ => IntentType::Unknown,
        };

        let entities: Result<Vec<crate::domain::EntityReference>, AppError> = llm_response
            .entities
            .into_iter()
            .map(|e| {
                // Security: Validate that entity_id is in the candidate set
                if !candidate_ids.contains(&e.entity_id) {
                    return Err(AppError::BadRequest(
                        "Entity ID not in candidate set".to_string(),
                    ));
                }
                Ok(crate::domain::EntityReference {
                    entity_id: e.entity_id,
                    entity_type: e.entity_type,
                    role: e.role,
                })
            })
            .collect();

        Ok(ParsedIntent {
            intent_type,
            entities: entities?,
            parameters: llm_response.parameters,
        })
    }

    fn build_system_prompt(&self, candidates: &[CandidateEntity]) -> String {
        let mut prompt = String::from(
            "You are an AI assistant that interprets natural language commands for a project management system. \
            Parse the user's utterance into structured intent with the following JSON schema:\n\n\
            {\n  \
              \"intent_type\": \"update_status|assign_task|create_item|query_status|search_items|update_priority|add_comment|move_to_sprint|generate_report|archive|unknown\",\n  \
              \"entities\": [\n    \
                {\n      \
                  \"entity_id\": \"uuid\",\n      \
                  \"entity_type\": \"story|task|epic|bug\",\n      \
                  \"role\": \"target|reference|context\"\n    \
                }\n  \
              ],\n  \
              \"parameters\": {\n    \
                \"key\": \"value\"\n  \
              }\n\
            }\n\n",
        );

        if !candidates.is_empty() {
            prompt.push_str("Available entities (you MUST only reference entity_ids from this list):\n");
            for candidate in candidates.iter().take(20) {
                // Limit to top 20 for prompt length
                prompt.push_str(&format!(
                    "- {} ({}): {} - {}\n",
                    candidate.id,
                    candidate.entity_type,
                    candidate.title,
                    candidate.description.as_deref().unwrap_or("No description")
                ));
            }
        } else {
            prompt.push_str("No relevant entities found in the current context.\n");
        }

        prompt.push_str("\nRespond with valid JSON only. Do not include any other text.");
        prompt
    }

    fn calculate_service_confidence(
        &self,
        parsed_intent: &ParsedIntent,
        candidates: &[CandidateEntity],
    ) -> f32 {
        let mut confidence: f32 = 0.5; // Base confidence

        // Boost confidence based on number of matching entities
        if !parsed_intent.entities.is_empty() {
            confidence += 0.2;
        }

        // Boost confidence based on candidate quality
        if !candidates.is_empty() {
            let avg_similarity: f32 = candidates.iter().map(|c| c.similarity_score).sum::<f32>()
                / candidates.len() as f32;
            confidence += avg_similarity * 0.3;
        }

        // Boost confidence for well-known intent types
        match parsed_intent.intent_type {
            IntentType::UpdateStatus
            | IntentType::AssignTask
            | IntentType::QueryStatus
            | IntentType::SearchItems => confidence += 0.1,
            IntentType::Unknown => confidence -= 0.2,
            _ => {}
        }

        confidence.clamp(0.0, 1.0)
    }

    fn requires_confirmation(&self, parsed_intent: &ParsedIntent) -> bool {
        match parsed_intent.intent_type {
            IntentType::Archive
            | IntentType::CreateItem
            | IntentType::MoveToSprint => true, // High-impact actions
            IntentType::UpdateStatus | IntentType::AssignTask => {
                // Require confirmation for bulk operations
                parsed_intent.entities.len() > 3
            }
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{CandidateEntity, ContextEntity};
    use async_trait::async_trait;
    use chrono::Utc;
    use std::collections::HashMap;
    use std::sync::Arc;

    // Mock implementations would go here
    struct MockLlmClient;
    struct MockRepository;

    #[async_trait]
    impl crate::application::ports::LlmClient for MockLlmClient {
        async fn generate_embedding(&self, _text: &str) -> Result<Vec<f32>, AppError> {
            Ok(vec![0.1; 1536])
        }
        
        async fn parse_intent(
            &self,
            _utterance: &str,
            _context: &[CandidateEntity],
            _system_prompt: &str,
        ) -> Result<crate::application::ports::LlmResponse, AppError> {
            Ok(crate::application::ports::LlmResponse {
                intent_type: "update_status".to_string(),
                entities: vec![],
                parameters: HashMap::new(),
                confidence: 0.8,
            })
        }
        
        async fn health_check(&self) -> Result<(), AppError> {
            Ok(())
        }
    }

    #[async_trait]
    impl crate::application::ports::VectorSearchRepository for MockRepository {
        async fn search_similar(
            &self,
            _embedding: Vec<f32>,
            _tenant_id: uuid::Uuid,
            _entity_types: Option<Vec<String>>,
            _limit: usize,
            _similarity_threshold: Option<f32>,
        ) -> Result<Vec<CandidateEntity>, AppError> {
            Ok(vec![])
        }

        async fn get_entity_count(
            &self,
            _tenant_id: uuid::Uuid,
            _entity_types: Option<Vec<String>>,
        ) -> Result<u64, AppError> {
            Ok(0)
        }

        async fn delete_entity(&self, _entity_id: uuid::Uuid, _tenant_id: uuid::Uuid) -> Result<bool, AppError> {
            Ok(false)
        }
    }

    impl InterpretUseCase {
        fn new_for_testing() -> Self {
            Self {
                postgres_repo: Arc::new(MockPostgresRepository),
                rate_limit_repo: Arc::new(MockRateLimitRepository),
                qdrant_repo: Arc::new(MockRepository),
                llm_client: Arc::new(MockLlmClient),
            }
        }
    }

    // Additional mock implementations needed
    struct MockPostgresRepository;
    struct MockRateLimitRepository;

    #[async_trait]
    impl crate::application::ports::IntentHistoryRepository for MockPostgresRepository {
        async fn record_intent(&self, _intent: &IntentRecord) -> Result<(), AppError> {
            Ok(())
        }
        async fn get_recent_intents(&self, _user_id: Uuid, _limit: usize) -> Result<Vec<IntentRecord>, AppError> {
            Ok(vec![])
        }
        async fn get_intent_analytics(&self, _tenant_id: Uuid, _start_date: chrono::DateTime<Utc>, _end_date: chrono::DateTime<Utc>) -> Result<crate::application::ports::IntentAnalytics, AppError> {
            Ok(crate::application::ports::IntentAnalytics {
                total_intents: 0,
                avg_llm_confidence: 0.8,
                avg_service_confidence: 0.7,
                intent_type_distribution: HashMap::new(),
                date_range: (_start_date, _end_date),
            })
        }
    }

    #[async_trait]
    impl crate::application::ports::RateLimitRepository for MockRateLimitRepository {
        async fn get_rate_limit_bucket(&self, _user_id: Uuid, _resource_type: &str) -> Result<Option<crate::application::ports::RateLimitBucket>, AppError> {
            Ok(None)
        }
        async fn update_rate_limit_bucket(&self, _user_id: Uuid, _resource_type: &str, _token_count: i32, _last_refill: chrono::DateTime<Utc>) -> Result<(), AppError> {
            Ok(())
        }
    }

    #[test]
    fn test_calculate_service_confidence() {
        let use_case = InterpretUseCase::new_for_testing();
        
        let parsed_intent = ParsedIntent {
            intent_type: IntentType::UpdateStatus,
            entities: vec![crate::domain::EntityReference {
                entity_id: Uuid::new_v4(),
                entity_type: "story".to_string(),
                role: "target".to_string(),
            }],
            parameters: HashMap::new(),
        };

        let candidates = vec![CandidateEntity {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: None,
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.8,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        }];

        let confidence = use_case.calculate_service_confidence(&parsed_intent, &candidates);
        assert!(confidence > 0.5);
        assert!(confidence <= 1.0);
    }

    #[test]
    fn test_requires_confirmation() {
        let use_case = InterpretUseCase::new_for_testing();

        let archive_intent = ParsedIntent {
            intent_type: IntentType::Archive,
            entities: vec![],
            parameters: HashMap::new(),
        };
        assert!(use_case.requires_confirmation(&archive_intent));

        let query_intent = ParsedIntent {
            intent_type: IntentType::QueryStatus,
            entities: vec![],
            parameters: HashMap::new(),
        };
        assert!(!use_case.requires_confirmation(&query_intent));

        let bulk_update_intent = ParsedIntent {
            intent_type: IntentType::UpdateStatus,
            entities: vec![
                crate::domain::EntityReference {
                    entity_id: Uuid::new_v4(),
                    entity_type: "story".to_string(),
                    role: "target".to_string(),
                };
                5
            ], // 5 entities > threshold
            parameters: HashMap::new(),
        };
        assert!(use_case.requires_confirmation(&bulk_update_intent));
    }

    #[test]
    fn test_build_system_prompt() {
        let use_case = InterpretUseCase::new_for_testing();
        
        let candidates = vec![CandidateEntity {
            id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: Some("A test story".to_string()),
            status: None,
            priority: None,
            tags: vec![],
            metadata: HashMap::new(),
            similarity_score: 0.9,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        }];

        let prompt = use_case.build_system_prompt(&candidates);
        assert!(prompt.contains("Available entities"));
        assert!(prompt.contains("Test Story"));
        assert!(prompt.contains("A test story"));
        assert!(prompt.contains("valid JSON only"));
    }
}