use crate::application::ports::VectorSearchRepository;
use crate::domain::{CandidateEntity, ContextEntity};
use async_trait::async_trait;
use common::AppError;
use qdrant_client::Qdrant;
use std::collections::HashMap;
use uuid::Uuid;

const COLLECTION_NAME: &str = "context_entities";
const EMBEDDING_DIM: usize = 1536;

pub async fn bootstrap_collection(_client: &Qdrant) -> Result<(), AppError> {
    // TODO: Integrate with Qdrant once the collection schema is finalized
    Ok(())
}

pub async fn upsert_entity(
    client: &Qdrant,
    entity: &ContextEntity,
    embedding: Vec<f32>,
) -> Result<(), AppError> {
    validate_embedding(&embedding)?;

    // TODO: Wire Qdrant upsert once API contract is ready
    let _ = (client, entity, embedding);
    Ok(())
}

fn validate_embedding(embedding: &[f32]) -> Result<(), AppError> {
    if embedding.len() != EMBEDDING_DIM {
        return Err(AppError::BadRequest(format!(
            "Embedding dimension mismatch: expected {EMBEDDING_DIM}, got {}",
            embedding.len()
        )));
    }

    Ok(())
}

#[async_trait]
impl VectorSearchRepository for Qdrant {
    async fn search_similar(
        &self,
        embedding: Vec<f32>,
        tenant_id: Uuid,
        entity_types: Option<Vec<String>>,
        limit: usize,
        similarity_threshold: Option<f32>,
    ) -> Result<Vec<CandidateEntity>, AppError> {
        validate_embedding(&embedding)?;

        // Keep parameters in scope to avoid warnings until the real client is wired
        let _ = (
            tenant_id,
            entity_types,
            limit,
            similarity_threshold,
            COLLECTION_NAME,
        );

        // TODO: Hook into Qdrant search when backend is available
        Ok(vec![])
    }

    async fn get_entity_count(
        &self,
        tenant_id: Uuid,
        entity_types: Option<Vec<String>>,
    ) -> Result<u64, AppError> {
        let _ = (tenant_id, entity_types, COLLECTION_NAME);
        // TODO: Query Qdrant once schema is ready
        Ok(0)
    }

    async fn delete_entity(&self, entity_id: Uuid, tenant_id: Uuid) -> Result<bool, AppError> {
        let _ = (entity_id, tenant_id, COLLECTION_NAME);
        // TODO: Issue delete command once Qdrant integration is complete
        Ok(false)
    }
}

#[allow(dead_code)]
fn payload_to_candidate_entity(
    _payload: &HashMap<String, qdrant_client::qdrant::Value>,
    score: f32,
) -> Result<CandidateEntity, AppError> {
    // TODO: Fix Qdrant client API integration - using stub for now
    use chrono::Utc;

    Ok(CandidateEntity {
        id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        entity_type: "story".to_string(),
        title: "Stub Entity".to_string(),
        description: Some("Stub description".to_string()),
        status: Some("ready".to_string()),
        priority: Some(1),
        tags: vec![],
        metadata: HashMap::new(),
        similarity_score: score,
        last_updated: Utc::now(),
        created_at: Utc::now(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::ContextEntity;
    use chrono::Utc;

    async fn setup_test_client() -> Qdrant {
        // Note: In practice, use testcontainers for isolated testing
        Qdrant::from_url("http://localhost:6334").build().unwrap()
    }

    #[tokio::test]
    #[ignore] // Requires a running Qdrant instance
    async fn test_bootstrap_collection() {
        let client = setup_test_client().await;
        let result = bootstrap_collection(&client).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_upsert_and_search() {
        let client = setup_test_client().await;
        bootstrap_collection(&client).await.unwrap();

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

        let embedding: Vec<f32> = (0..EMBEDDING_DIM)
            .map(|i| (i as f32) / EMBEDDING_DIM as f32)
            .collect();

        upsert_entity(&client, &entity, embedding.clone())
            .await
            .unwrap();

        // Verify search works end-to-end when real integration is available
        let search_result = client
            .search_similar(embedding, tenant_id, None, 10, Some(0.5))
            .await;
        assert!(search_result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_tenant_isolation() {
        let client = setup_test_client().await;
        bootstrap_collection(&client).await.unwrap();

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

        let embedding: Vec<f32> = (0..EMBEDDING_DIM)
            .map(|i| (i as f32) / EMBEDDING_DIM as f32)
            .collect();

        upsert_entity(&client, &entity1, embedding.clone())
            .await
            .unwrap();

        // Search from tenant2 should not find tenant1's entities
        let search_result = client
            .search_similar(embedding.clone(), tenant2, None, 10, Some(0.0))
            .await
            .unwrap();

        assert!(search_result.is_empty());

        // Search from tenant1 should find the entity
        let search_result = client
            .search_similar(embedding, tenant1, None, 10, Some(0.0))
            .await
            .unwrap();

        assert_eq!(search_result.len(), 1);
        assert_eq!(search_result[0].id, entity1.id);
    }

    #[tokio::test]
    #[ignore]
    async fn test_entity_type_filtering() {
        let client = setup_test_client().await;
        bootstrap_collection(&client).await.unwrap();

        let tenant_id = Uuid::new_v4();
        let embedding: Vec<f32> = (0..EMBEDDING_DIM)
            .map(|i| (i as f32) / EMBEDDING_DIM as f32)
            .collect();

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

        upsert_entity(&client, &story_entity, embedding.clone())
            .await
            .unwrap();
        upsert_entity(&client, &task_entity, embedding.clone())
            .await
            .unwrap();

        // Search for only stories
        let story_results = client
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
        let all_results = client
            .search_similar(embedding, tenant_id, None, 10, Some(0.0))
            .await
            .unwrap();

        assert_eq!(all_results.len(), 2);
    }
}
