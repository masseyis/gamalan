use common::AppError;
use shuttle_axum::axum::response::Json;
use shuttle_axum::axum::{routing::post, Router};
// use crate::AppState; // Comment out since AppState is in main.rs
use auth_clerk::JwtVerifier;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct InterpretRequest {
    pub utterance: String,
    pub context_limit: Option<usize>,
    pub entity_types: Option<Vec<String>>,
    pub require_confirmation: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct InterpretResponse {
    pub intent: ParsedIntentDto,
    pub confidence: ConfidenceDto,
    pub candidates: Vec<CandidateEntityDto>,
    pub requires_confirmation: bool,
    pub session_token: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct ActRequest {
    pub action: ActionCommandDto,
    pub session_token: Option<Uuid>,
    pub confirmed: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ActResponse {
    pub success: bool,
    pub results: Vec<ActionResultDto>,
    pub rollback_token: Option<Uuid>,
    pub partial_success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedIntentDto {
    pub intent_type: String,
    pub entities: Vec<EntityReferenceDto>,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityReferenceDto {
    pub entity_id: Uuid,
    pub entity_type: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct ConfidenceDto {
    pub llm_confidence: f32,
    pub service_confidence: f32,
    pub overall_confidence: f32,
}

#[derive(Debug, Serialize)]
pub struct CandidateEntityDto {
    pub id: Uuid,
    pub entity_type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub similarity_score: f32,
    pub boost_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionCommandDto {
    pub action_type: String,
    pub target_entities: Vec<Uuid>,
    pub parameters: HashMap<String, serde_json::Value>,
    pub require_confirmation: bool,
    pub risk_level: String,
}

#[derive(Debug, Serialize)]
pub struct ActionResultDto {
    pub service: String,
    pub success: bool,
    pub message: String,
    pub affected_entities: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct InterpretQueryParams {
    pub debug: Option<bool>,
    pub disable_llm: Option<bool>,
}

pub fn create_routes() -> Router {
    Router::new()
        .route("/interpret", post(interpret_handler))
        .route("/act", post(act_handler))
        .route("/health", shuttle_axum::axum::routing::get(health_handler))
        .route("/ready", shuttle_axum::axum::routing::get(ready_handler))
}

pub async fn create_context_orchestrator_router(
    _pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    // TODO: Initialize repositories and use cases when they're implemented
    // For now, use the basic route structure

    Router::new()
        .route("/interpret", post(interpret_handler))
        .route("/act", post(act_handler))
        .route("/ready", shuttle_axum::axum::routing::get(ready_handler))
        .layer(shuttle_axum::axum::Extension(verifier))
    // TODO: Add state with use cases when implemented
    // .with_state(usecases)
}

pub async fn interpret_handler(
    // State(state): State<AppState>,
    // claims: Authenticated,
    // Query(params): Query<InterpretQueryParams>,
    Json(request): Json<InterpretRequest>,
) -> Result<Json<InterpretResponse>, AppError> {
    // Validate input
    if request.utterance.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Utterance cannot be empty".to_string(),
        ));
    }

    if request.utterance.len() > 2000 {
        return Err(AppError::BadRequest(
            "Utterance too long (max 2000 characters)".to_string(),
        ));
    }

    // Stub response for testing
    let response = InterpretResponse {
        intent: ParsedIntentDto {
            intent_type: "update_status".to_string(),
            entities: vec![EntityReferenceDto {
                entity_id: Uuid::new_v4(),
                entity_type: "story".to_string(),
                role: "target".to_string(),
            }],
            parameters: std::collections::HashMap::new(),
        },
        confidence: ConfidenceDto {
            llm_confidence: 0.8,
            service_confidence: 0.7,
            overall_confidence: 0.75,
        },
        candidates: vec![],
        requires_confirmation: false,
        session_token: None,
    };

    Ok(Json(response))
}

pub async fn act_handler(
    // State(state): State<AppState>,
    // claims: Authenticated,
    Json(request): Json<ActRequest>,
) -> Result<Json<ActResponse>, AppError> {
    // Validate action type
    let _action_type = crate::domain::ActionType::from_string(&request.action.action_type)?;
    let _risk_level = crate::domain::RiskLevel::from_string(&request.action.risk_level)?;

    // Stub response for testing
    let response = ActResponse {
        success: true,
        results: vec![ActionResultDto {
            service: "backlog".to_string(),
            success: true,
            message: "Action completed successfully".to_string(),
            affected_entities: request.action.target_entities,
        }],
        rollback_token: Some(Uuid::new_v4()),
        partial_success: false,
    };

    Ok(Json(response))
}

pub async fn health_handler() -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "context-orchestrator",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn ready_handler() -> Result<Json<serde_json::Value>, AppError> {
    // Stub implementation for testing - would normally check actual dependencies
    let db_healthy = true;
    let qdrant_healthy = true;

    let overall_ready = db_healthy && qdrant_healthy;

    Ok(Json(serde_json::json!({
        "status": if overall_ready { "ready" } else { "not_ready" },
        "service": "context-orchestrator",
        "checks": {
            "database": if db_healthy { "healthy" } else { "unhealthy" },
            "qdrant": if qdrant_healthy { "healthy" } else { "unhealthy" }
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// Extension trait for converting domain enums to/from strings
impl crate::domain::ActionType {
    pub fn from_string(s: &str) -> Result<Self, AppError> {
        match s {
            "update_status" => Ok(Self::UpdateStatus),
            "assign_user" => Ok(Self::AssignUser),
            "update_priority" => Ok(Self::UpdatePriority),
            "add_comment" => Ok(Self::AddComment),
            "create_task" => Ok(Self::CreateTask),
            "create_story" => Ok(Self::CreateStory),
            "move_to_sprint" => Ok(Self::MoveToSprint),
            "archive" => Ok(Self::Archive),
            _ => Err(AppError::BadRequest(format!("Unknown action type: {}", s))),
        }
    }
}

impl crate::domain::RiskLevel {
    pub fn from_string(s: &str) -> Result<Self, AppError> {
        match s {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            _ => Err(AppError::BadRequest(format!("Unknown risk level: {}", s))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_action_type_conversion() {
        let action_type = crate::domain::ActionType::UpdateStatus;
        let string_rep = action_type.to_string();
        assert_eq!(string_rep, "update_status");

        let converted_back = crate::domain::ActionType::from_string(&string_rep).unwrap();
        assert!(matches!(
            converted_back,
            crate::domain::ActionType::UpdateStatus
        ));
    }

    #[test]
    fn test_risk_level_conversion() {
        let risk_level = crate::domain::RiskLevel::High;
        let string_rep = risk_level.to_string();
        assert_eq!(string_rep, "high");

        let converted_back = crate::domain::RiskLevel::from_string(&string_rep).unwrap();
        assert!(matches!(converted_back, crate::domain::RiskLevel::High));
    }

    #[test]
    fn test_invalid_action_type() {
        let result = crate::domain::ActionType::from_string("invalid_action");
        assert!(result.is_err());
        assert!(matches!(result, Err(AppError::BadRequest(_))));
    }

    #[test]
    fn test_dto_serialization() {
        let dto = ParsedIntentDto {
            intent_type: "update_status".to_string(),
            entities: vec![EntityReferenceDto {
                entity_id: Uuid::new_v4(),
                entity_type: "story".to_string(),
                role: "target".to_string(),
            }],
            parameters: {
                let mut map = HashMap::new();
                map.insert("status".to_string(), serde_json::json!("in_progress"));
                map
            },
        };

        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("update_status"));
        assert!(json.contains("story"));
        assert!(json.contains("in_progress"));
    }
}
