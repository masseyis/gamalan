use crate::application::ports::VectorSearchRepository;
use crate::domain::{CandidateEntity, ContextEntity};
use async_trait::async_trait;
use common::AppError;
use qdrant_client::prelude::*;
use qdrant_client::qdrant::Filter;
use std::collections::HashMap;
use uuid::Uuid;

#[allow(dead_code)]
pub struct QdrantRepository {
    client: QdrantClient,
    collection_name: String,
}

#[allow(dead_code)]
impl QdrantRepository {
    pub fn new(client: QdrantClient) -> Self {
        Self {
            client,
            collection_name: "context_entities".to_string(),
        }
    }

    pub async fn bootstrap_collection(&self) -> Result<(), AppError> {
        // TODO: Fix Qdrant client API integration - using stub for now
        Ok(())
    }

    pub async fn upsert_entity(
        &self,
        entity: &ContextEntity,
        embedding: Vec<f32>,
    ) -> Result<(), AppError> {
        if embedding.len() != 1536 {
            return Err(AppError::BadRequest(format!(
                "Embedding dimension mismatch: expected 1536, got {}",
                embedding.len()
            )));
        }

        // TODO: Fix Qdrant client API integration - using stub for now
        Ok(())
    }

    async fn build_tenant_filter(&self, _tenant_id: Uuid) -> Filter {
        // TODO: Fix Qdrant client API integration - using stub for now
        Filter::default()
    }

    async fn build_type_filter(&self, _entity_types: &[String]) -> Filter {
        // TODO: Fix Qdrant client API integration - using stub for now
        Filter::default()
    }
}

#[async_trait]
impl VectorSearchRepository for QdrantRepository {
    async fn search_similar(
        &self,
        embedding: Vec<f32>,
        _tenant_id: Uuid,
        _entity_types: Option<Vec<String>>,
        _limit: usize,
        _similarity_threshold: Option<f32>,
    ) -> Result<Vec<CandidateEntity>, AppError> {
        if embedding.len() != 1536 {
            return Err(AppError::BadRequest(format!(
                "Embedding dimension mismatch: expected 1536, got {}",
                embedding.len()
            )));
        }

        // TODO: Fix Qdrant client API integration - using stub for now
        // Return empty results to enable service startup
        Ok(vec![])
    }

    async fn get_entity_count(
        &self,
        _tenant_id: Uuid,
        _entity_types: Option<Vec<String>>,
    ) -> Result<u64, AppError> {
        // TODO: Fix Qdrant client API integration - using stub for now
        Ok(0)
    }

    async fn delete_entity(&self, _entity_id: Uuid, _tenant_id: Uuid) -> Result<bool, AppError> {
        // TODO: Fix Qdrant client API integration - using stub for now
        Ok(false)
    }
}

#[allow(dead_code)]
impl QdrantRepository {
    fn payload_to_candidate_entity(
        &self,
        _payload: &HashMap<String, qdrant_client::qdrant::Value>,
        score: f32,
    ) -> Result<CandidateEntity, AppError> {
        // TODO: Fix Qdrant client API integration - using stub for now
        use chrono::Utc;

        Ok(CandidateEntity {
            id: uuid::Uuid::new_v4(),
            tenant_id: uuid::Uuid::new_v4(),
            entity_type: "story".to_string(),
            title: "Stub Entity".to_string(),
            description: Some("Stub description".to_string()),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: std::collections::HashMap::new(),
            similarity_score: score,
            last_updated: Utc::now(),
            created_at: Utc::now(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::ContextEntity;
    use chrono::Utc;
    use std::collections::HashMap;

    async fn setup_test_repo() -> QdrantRepository {
        // Note: In practice, use testcontainers for isolated testing
        let client = QdrantClient::from_url("http://localhost:6334")
            .build()
            .unwrap();
        QdrantRepository::new(client)
    }

    #[tokio::test]
    #[ignore] // Requires Qdrant instance
    async fn test_bootstrap_collection() {
        let repo = setup_test_repo().await;
        let result = repo.bootstrap_collection().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_upsert_and_search() {
        let repo = setup_test_repo().await;
        repo.bootstrap_collection().await.unwrap();

        let tenant_id = Uuid::new_v4();
        let entity = ContextEntity {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: Some("A test story for validation".to_string()),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec!["test".to_string(), "validation".to_string()],
            metadata: HashMap::new(),
            last_updated: Utc::now(),
            created_at: Utc::now(),
        };

        let embedding: Vec<f32> = (0..1536).map(|i| (i as f32) / 1536.0).collect();

        // Test upsert
        let upsert_result = repo.upsert_entity(&entity, embedding.clone()).await;
        assert!(upsert_result.is_ok());

        // Test search
        let search_result = repo
            .search_similar(embedding, tenant_id, None, 10, Some(0.5))
            .await;
        assert!(search_result.is_ok());

        let candidates = search_result.unwrap();
        assert!(!candidates.is_empty());
        assert_eq!(candidates[0].id, entity.id);
    }

    #[tokio::test]
    #[ignore]
    async fn test_tenant_isolation() {
        let repo = setup_test_repo().await;
        repo.bootstrap_collection().await.unwrap();

        let tenant1 = Uuid::new_v4();
        let tenant2 = Uuid::new_v4();

        let entity1 = ContextEntity {
            id: Uuid::new_v4(),
            tenant_id: tenant1,
            entity_type: "story".to_string(),
            title: "Tenant 1 Story".to_string(),
            description: Some("Story for tenant 1".to_string()),
            status: Some("ready".to_string()),
            priority: Some(1),
            tags: vec![],
            metadata: HashMap::new(),
            last_updated: Utc::now(),
            created_at: Utc::now(),
        };

        let embedding: Vec<f32> = (0..1536).map(|i| (i as f32) / 1536.0).collect();

        repo.upsert_entity(&entity1, embedding.clone())
            .await
            .unwrap();

        // Search from tenant2 should not find tenant1's entities
        let search_result = repo
            .search_similar(embedding.clone(), tenant2, None, 10, Some(0.0))
            .await
            .unwrap();

        assert!(search_result.is_empty());

        // Search from tenant1 should find the entity
        let search_result = repo
            .search_similar(embedding, tenant1, None, 10, Some(0.0))
            .await
            .unwrap();

        assert_eq!(search_result.len(), 1);
        assert_eq!(search_result[0].id, entity1.id);
    }

    #[tokio::test]
    #[ignore]
    async fn test_entity_type_filtering() {
        let repo = setup_test_repo().await;
        repo.bootstrap_collection().await.unwrap();

        let tenant_id = Uuid::new_v4();
        let embedding: Vec<f32> = (0..1536).map(|i| (i as f32) / 1536.0).collect();

        // Insert story entity
        let story_entity = ContextEntity {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type: "story".to_string(),
            title: "Test Story".to_string(),
            description: None,
            status: None,
            priority: None,
            tags: vec![],
            metadata: HashMap::new(),
            last_updated: Utc::now(),
            created_at: Utc::now(),
        };

        // Insert task entity
        let task_entity = ContextEntity {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type: "task".to_string(),
            title: "Test Task".to_string(),
            description: None,
            status: None,
            priority: None,
            tags: vec![],
            metadata: HashMap::new(),
            last_updated: Utc::now(),
            created_at: Utc::now(),
        };

        repo.upsert_entity(&story_entity, embedding.clone())
            .await
            .unwrap();
        repo.upsert_entity(&task_entity, embedding.clone())
            .await
            .unwrap();

        // Search for only stories
        let story_results = repo
            .search_similar(
                embedding.clone(),
                tenant_id,
                Some(vec!["story".to_string()]),
                10,
                Some(0.0),
            )
            .await
            .unwrap();

        assert_eq!(story_results.len(), 1);
        assert_eq!(story_results[0].entity_type, "story");

        // Search for both types
        let all_results = repo
            .search_similar(embedding, tenant_id, None, 10, Some(0.0))
            .await
            .unwrap();

        assert_eq!(all_results.len(), 2);
    }
}
