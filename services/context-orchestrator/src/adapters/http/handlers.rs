use common::AppError;
use shuttle_axum::axum::extract::{Query, State};
use shuttle_axum::axum::response::Json;
use shuttle_axum::axum::{
    body::to_bytes,
    middleware::{self, Next},
    response::IntoResponse,
    routing::{get, post},
    Router,
};

// use crate::AppState; // Comment out since AppState is in main.rs
use auth_clerk::JwtVerifier;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct OrchestratorState {
    pub pool: PgPool,
}

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

#[derive(Debug, Deserialize)]
pub struct SuggestionsQuery {
    #[serde(alias = "projectId")]
    pub project_id: Option<String>,
    pub cursor: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SuggestionDto {
    pub id: String,
    #[serde(rename = "type")]
    pub suggestion_type: String,
    pub title: String,
    pub description: String,
    pub priority: String,
    pub confidence: f32,
    pub actionable: bool,
    #[serde(rename = "entityId", skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<String>,
    #[serde(rename = "entityType", skip_serializing_if = "Option::is_none")]
    pub entity_type: Option<String>,
    #[serde(rename = "suggestedAction", skip_serializing_if = "Option::is_none")]
    pub suggested_action: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "dismissedAt", skip_serializing_if = "Option::is_none")]
    pub dismissed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SuggestionsResponseDto {
    pub suggestions: Vec<SuggestionDto>,
    #[serde(rename = "hasMore")]
    pub has_more: bool,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

pub fn create_routes(state: OrchestratorState) -> Router<OrchestratorState> {
    Router::new()
        .route("/interpret", post(interpret_handler))
        .route("/act", post(act_handler))
        .route("/suggestions", get(suggestions_handler))
        .route("/ready", shuttle_axum::axum::routing::get(ready_handler))
        .with_state(state)
}

pub async fn create_context_orchestrator_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    // TODO: Initialize repositories and use cases when they're implemented
    // For now, use the basic route structure

    let state = OrchestratorState { pool };

    Router::new()
        .route("/interpret", post(interpret_handler))
        .route("/act", post(act_handler))
        .route("/suggestions", get(suggestions_handler))
        .layer(shuttle_axum::axum::Extension(verifier))
        .layer(middleware::from_fn(log_request_body))
        .with_state(state)
    // TODO: Add state with use cases when implemented
    // .with_state(usecases)
}

async fn log_request_body(
    request: axum::http::Request<axum::body::Body>,
    next: Next,
) -> impl IntoResponse {
    let (parts, body) = request.into_parts();
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    tracing::info!(body = ?String::from_utf8_lossy(&bytes));
    let request = axum::http::Request::from_parts(parts, axum::body::Body::from(bytes));
    next.run(request).await
}

#[derive(Debug, FromRow)]
struct StorySnapshot {
    id: Uuid,
    status: String,
    story_points: Option<i32>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow)]
struct TaskSnapshot {
    status: String,
    updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn suggestions_handler(
    State(state): State<OrchestratorState>,
    Query(query): Query<SuggestionsQuery>,
) -> Result<Json<SuggestionsResponseDto>, AppError> {
    let project_id = query
        .project_id
        .ok_or_else(|| AppError::BadRequest("Missing projectId query parameter".to_string()))?;

    let project_uuid = Uuid::parse_str(project_id.trim())
        .map_err(|_| AppError::BadRequest("projectId must be a valid UUID".to_string()))?;

    tracing::info!(%project_uuid, "Generating orchestrator suggestions");

    let stories: Vec<StorySnapshot> = sqlx::query_as::<_, StorySnapshot>(
        r#"
        SELECT id, status, story_points, updated_at
        FROM stories
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 100
        "#,
    )
    .bind(project_uuid)
    .fetch_all(&state.pool)
    .await
    .map_err(|error| {
        tracing::error!(%project_uuid, %error, "Failed to load stories for suggestions");
        AppError::InternalServerError
    })?;

    let story_count = stories.len();
    let now = Utc::now();

    if story_count == 0 {
        let suggestion = SuggestionDto {
            id: format!("{}-seed-backlog", project_uuid),
            suggestion_type: "backlog-refinement".to_string(),
            title: "Seed your backlog".to_string(),
            description: "This project does not contain any stories yet. Capture the first milestone so the team can start planning.".to_string(),
            priority: "medium".to_string(),
            confidence: 0.6,
            actionable: true,
            entity_id: Some(project_uuid.to_string()),
            entity_type: Some("project".to_string()),
            suggested_action: Some("Create an initial epic or milestone story to frame the project goals".to_string()),
            created_at: now.to_rfc3339(),
            dismissed_at: None,
        };

        return Ok(Json(SuggestionsResponseDto {
            suggestions: vec![suggestion],
            has_more: false,
            next_cursor: None,
        }));
    }

    let mut ready_stories = Vec::new();
    let mut draft_stories = Vec::new();
    let mut in_progress_stories = Vec::new();
    let mut done_stories = Vec::new();

    for story in &stories {
        match story.status.to_lowercase().as_str() {
            "ready" => ready_stories.push(story),
            "draft" | "needsrefinement" => draft_stories.push(story),
            "committed" | "inprogress" | "taskscomplete" | "deployed" => {
                in_progress_stories.push(story)
            }
            "awaitingacceptance" | "accepted" => done_stories.push(story),
            _ => {}
        }
    }

    let mut suggestions = Vec::new();

    let ready_ratio = ready_stories.len() as f32 / story_count as f32;
    if !ready_stories.is_empty() {
        let highest_points = ready_stories
            .iter()
            .filter_map(|story| story.story_points)
            .max()
            .unwrap_or(0);

        suggestions.push(SuggestionDto {
            id: format!("{}-plan-ready", project_uuid),
            suggestion_type: "sprint-planning".to_string(),
            title: "Plan the next sprint".to_string(),
            description: format!(
                "You have {} story{} in Ready. Prioritize pulling the top {} into the upcoming sprint.",
                ready_stories.len(),
                if ready_stories.len() == 1 { "" } else { "ies" },
                if highest_points > 0 {
                    format!("items (up to {} pts)", highest_points)
                } else {
                    "items".to_string()
                }
            ),
            priority: if ready_ratio >= 0.4 { "high" } else { "medium" }.to_string(),
            confidence: (0.6 + ready_ratio).min(0.95),
            actionable: true,
            entity_id: Some(project_uuid.to_string()),
            entity_type: Some("project".to_string()),
            suggested_action: Some("Review Ready stories with the team and commit the top candidates to the next sprint backlog".to_string()),
            created_at: now.to_rfc3339(),
            dismissed_at: None,
        });
    }

    let draft_ratio = draft_stories.len() as f32 / story_count as f32;
    if !draft_stories.is_empty() {
        let oldest_draft = draft_stories
            .iter()
            .min_by_key(|story| story.updated_at)
            .map(|story| story.updated_at);

        let staleness_days = oldest_draft
            .map(|ts| (now.signed_duration_since(ts).num_days()).max(0))
            .unwrap_or(0);

        suggestions.push(SuggestionDto {
            id: format!("{}-refine-backlog", project_uuid),
            suggestion_type: "backlog-refinement".to_string(),
            title: "Schedule backlog refinement".to_string(),
            description: format!(
                "{} story{} still need refinement. The oldest item has not been updated in {} day{}.",
                draft_stories.len(),
                if draft_stories.len() == 1 { "" } else { "ies" },
                staleness_days,
                if staleness_days == 1 { "" } else { "s" }
            ),
            priority: if draft_ratio >= 0.3 { "high" } else { "medium" }.to_string(),
            confidence: (0.55 + draft_ratio).min(0.9),
            actionable: true,
            entity_id: Some(project_uuid.to_string()),
            entity_type: Some("project".to_string()),
            suggested_action: Some("Work with the product owner to clarify acceptance criteria and sizing for draft stories".to_string()),
            created_at: now.to_rfc3339(),
            dismissed_at: None,
        });
    }

    let mut task_based_suggestion = false;
    if !in_progress_stories.is_empty() {
        let story_ids: Vec<Uuid> = in_progress_stories.iter().map(|story| story.id).collect();

        if !story_ids.is_empty() {
            let tasks: Vec<TaskSnapshot> = sqlx::query_as::<_, TaskSnapshot>(
                r#"
                SELECT status, updated_at
                FROM tasks
                WHERE story_id = ANY($1)
                "#,
            )
            .bind(&story_ids)
            .fetch_all(&state.pool)
            .await
            .map_err(|error| {
                tracing::error!(%project_uuid, %error, "Failed to load tasks for suggestions");
                AppError::InternalServerError
            })?;

            if !tasks.is_empty() {
                let unowned_tasks = tasks
                    .iter()
                    .filter(|task| task.status.eq_ignore_ascii_case("available"))
                    .count();

                if unowned_tasks > 0 {
                    suggestions.push(SuggestionDto {
                        id: format!("{}-assign-tasks", project_uuid),
                        suggestion_type: "task-completion".to_string(),
                        title: "Unowned tasks ready for contributors".to_string(),
                        description: format!(
                            "There are {} task{} available but not yet picked up in active stories. Surface them during standup.",
                            unowned_tasks,
                            if unowned_tasks == 1 { "" } else { "s" }
                        ),
                        priority: if unowned_tasks >= 5 { "high" } else { "medium" }.to_string(),
                        confidence: (0.5 + (unowned_tasks as f32 / tasks.len() as f32)).min(0.9),
                        actionable: true,
                        entity_id: Some(project_uuid.to_string()),
                        entity_type: Some("project".to_string()),
                        suggested_action: Some("Highlight the available tasks in standup and encourage contributors to take ownership".to_string()),
                        created_at: now.to_rfc3339(),
                        dismissed_at: None,
                    });
                    task_based_suggestion = true;
                }

                let stale_tasks = tasks
                    .iter()
                    .filter(|task| !task.status.eq_ignore_ascii_case("completed"))
                    .filter(|task| now.signed_duration_since(task.updated_at).num_days() >= 5)
                    .count();

                if stale_tasks > 0 {
                    suggestions.push(SuggestionDto {
                        id: format!("{}-revisit-stale", project_uuid),
                        suggestion_type: "task-completion".to_string(),
                        title: "Revisit stalled work".to_string(),
                        description: format!(
                            "{} task{} have not been updated in 5+ days. Check if contributors need support or if work should be replanned.",
                            stale_tasks,
                            if stale_tasks == 1 { "" } else { "s" }
                        ),
                        priority: "medium".to_string(),
                        confidence: 0.6,
                        actionable: true,
                        entity_id: Some(project_uuid.to_string()),
                        entity_type: Some("project".to_string()),
                        suggested_action: Some("Review stalled tasks during standup and unblock or reschedule them".to_string()),
                        created_at: now.to_rfc3339(),
                        dismissed_at: None,
                    });
                    task_based_suggestion = true;
                }
            }
        }
    }

    if !task_based_suggestion && done_stories.len() >= 2 {
        suggestions.push(SuggestionDto {
            id: format!("{}-demo-prep", project_uuid),
            suggestion_type: "demo-prep".to_string(),
            title: "Prepare demo updates".to_string(),
            description: format!(
                "{} item{} recently moved to Accepted. Capture screenshots or prepare a quick walkthrough before details fade.",
                done_stories.len(),
                if done_stories.len() == 1 { "" } else { "s" }
            ),
            priority: "medium".to_string(),
            confidence: 0.55,
            actionable: true,
            entity_id: Some(project_uuid.to_string()),
            entity_type: Some("project".to_string()),
            suggested_action: Some("Draft demo notes highlighting the value delivered and capture any screenshots or links".to_string()),
            created_at: now.to_rfc3339(),
            dismissed_at: None,
        });
    }

    Ok(Json(SuggestionsResponseDto {
        suggestions,
        has_more: false,
        next_cursor: None,
    }))
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
