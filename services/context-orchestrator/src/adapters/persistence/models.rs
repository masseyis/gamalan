use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct IntentHistoryRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub utterance_hash: String,
    pub parsed_intent: serde_json::Value,
    pub llm_confidence: f32,
    pub service_confidence: f32,
    pub candidates_considered: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct ActionAuditLogRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub action_type: String,
    pub target_entities: Vec<Uuid>,
    pub parameters: Option<serde_json::Value>,
    pub success: bool,
    pub error_message: Option<String>,
    pub rollback_token: Option<Uuid>,
    pub execution_duration_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct RateLimitBucketRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub resource_type: String,
    pub token_count: i32,
    pub last_refill: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct ContextSnapshotRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub entities: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

impl From<IntentHistoryRow> for crate::domain::IntentRecord {
    fn from(row: IntentHistoryRow) -> Self {
        let parsed_intent: crate::domain::ParsedIntent = serde_json::from_value(row.parsed_intent)
            .unwrap_or_else(|_| crate::domain::ParsedIntent {
                intent_type: crate::domain::IntentType::Unknown,
                entities: vec![],
                parameters: std::collections::HashMap::new(),
            });

        Self {
            id: row.id,
            tenant_id: row.tenant_id,
            user_id: row.user_id,
            utterance_hash: row.utterance_hash,
            parsed_intent,
            llm_confidence: row.llm_confidence,
            service_confidence: row.service_confidence,
            candidates_considered: row.candidates_considered,
            created_at: row.created_at,
        }
    }
}

impl From<&crate::domain::IntentRecord> for IntentHistoryRow {
    fn from(intent: &crate::domain::IntentRecord) -> Self {
        let parsed_intent = serde_json::to_value(&intent.parsed_intent)
            .unwrap_or_else(|_| serde_json::Value::Null);

        Self {
            id: intent.id,
            tenant_id: intent.tenant_id,
            user_id: intent.user_id,
            utterance_hash: intent.utterance_hash.clone(),
            parsed_intent,
            llm_confidence: intent.llm_confidence,
            service_confidence: intent.service_confidence,
            candidates_considered: intent.candidates_considered.clone(),
            created_at: intent.created_at,
        }
    }
}

impl From<ContextSnapshotRow> for crate::domain::ContextSnapshot {
    fn from(row: ContextSnapshotRow) -> Self {
        let entities: Vec<crate::domain::ContextEntity> = serde_json::from_value(row.entities)
            .unwrap_or_default();

        let metadata: std::collections::HashMap<String, serde_json::Value> = 
            row.metadata
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();

        Self {
            id: row.id,
            tenant_id: row.tenant_id,
            user_id: row.user_id,
            timestamp: row.created_at,
            entities,
            metadata,
        }
    }
}

impl From<&crate::domain::ContextSnapshot> for ContextSnapshotRow {
    fn from(snapshot: &crate::domain::ContextSnapshot) -> Self {
        let entities = serde_json::to_value(&snapshot.entities)
            .unwrap_or_else(|_| serde_json::Value::Array(vec![]));

        let metadata = if snapshot.metadata.is_empty() {
            None
        } else {
            Some(serde_json::to_value(&snapshot.metadata)
                .unwrap_or_else(|_| serde_json::Value::Object(serde_json::Map::new())))
        };

        Self {
            id: snapshot.id,
            tenant_id: snapshot.tenant_id,
            user_id: snapshot.user_id,
            entities,
            metadata,
            created_at: snapshot.timestamp,
        }
    }
}


impl From<ActionAuditLogRow> for crate::application::ports::ActionLogEntry {
    fn from(row: ActionAuditLogRow) -> Self {
        Self {
            action_type: row.action_type,
            target_entities: row.target_entities,
            parameters: row.parameters,
            success: row.success,
            error_message: row.error_message,
            execution_duration_ms: row.execution_duration_ms,
            rollback_token: row.rollback_token,
        }
    }
}

impl From<RateLimitBucketRow> for crate::application::ports::RateLimitBucket {
    fn from(row: RateLimitBucketRow) -> Self {
        Self {
            user_id: row.user_id,
            resource_type: row.resource_type,
            token_count: row.token_count,
            last_refill: row.last_refill,
        }
    }
}