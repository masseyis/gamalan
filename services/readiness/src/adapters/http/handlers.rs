use crate::application::ports::{StoryAnalysisSummary, StoryInfo};
use crate::application::{ReadinessUsecases, TaskEnrichmentSuggestion};
use crate::domain::{
    AcceptanceCriterion, ClarityLevel, GapType, ReadinessEvaluation, Recommendation, TaskAnalysis,
    TaskClarityAnalysis, TaskSuggestion,
};
use crate::rebuild_projections;
use auth_clerk::organization::AuthenticatedWithOrg;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

#[derive(Clone)]
pub struct ReadinessAppState {
    pub usecases: Arc<ReadinessUsecases>,
    pub pool: Arc<PgPool>,
}

#[derive(Debug, Deserialize)]
pub struct AddCriteriaRequest {
    pub criteria: Vec<CriterionRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CriterionRequest {
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

#[derive(Debug, Serialize)]
pub struct AcceptanceCriterionResponse {
    pub id: Uuid,
    pub story_id: Uuid,
    pub ac_id: String,
    pub given: String,
    pub when: String,
    pub then: String,
}

impl From<AcceptanceCriterion> for AcceptanceCriterionResponse {
    fn from(criterion: AcceptanceCriterion) -> Self {
        Self {
            id: criterion.id,
            story_id: criterion.story_id,
            ac_id: criterion.ac_id,
            given: criterion.given,
            when: criterion.when,
            then: criterion.then,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StorySummaryResponse {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    #[serde(rename = "storyPoints")]
    pub story_points: Option<u32>,
}

impl From<StoryInfo> for StorySummaryResponse {
    fn from(info: StoryInfo) -> Self {
        Self {
            id: info.id,
            title: info.title,
            description: info.description,
            story_points: info.story_points,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskAnalysisResponse {
    task_id: String,
    clarity_score: ClarityScoreResponse,
    vague_terms: Vec<VagueTermResponse>,
    missing_elements: Vec<MissingElementResponse>,
    technical_detail_recommendations: Vec<TechnicalDetailRecommendationResponse>,
    ac_recommendations: Vec<AcceptanceCriteriaRecommendationResponse>,
    ai_compatibility_issues: Vec<String>,
    examples: Vec<TaskExampleResponse>,
    recommendations: Vec<RecommendationResponse>,
    analyzed_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClarityScoreResponse {
    score: i32,
    level: String,
    dimensions: Vec<ClarityDimensionResponse>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClarityDimensionResponse {
    dimension: String,
    score: i32,
    weight: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct VagueTermResponse {
    term: String,
    position: i32,
    suggestion: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MissingElementResponse {
    category: String,
    description: String,
    importance: String,
    recommendation: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TechnicalDetailRecommendationResponse {
    #[serde(rename = "type")]
    kind: String,
    description: String,
    example: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AcceptanceCriteriaRecommendationResponse {
    ac_id: String,
    description: String,
    relevance: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecommendationResponse {
    id: String,
    category: String,
    title: String,
    description: String,
    priority: String,
    actionable: bool,
    #[serde(rename = "autoApplyable")]
    auto_applyable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskExampleResponse {
    title: String,
    description: String,
    source: String,
    project_id: Option<String>,
    task_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEnrichmentRequest {
    pub task_id: Option<Uuid>,
    pub story_id: Uuid,
    pub include_story_context: bool,
    pub include_related_tasks: bool,
    pub include_codebase_context: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TaskEnrichmentResponse {
    task_id: Uuid,
    story_id: Uuid,
    suggested_title: Option<String>,
    suggested_description: String,
    suggested_ac_refs: Vec<String>,
    original_description: Option<String>,
    confidence: f32,
    reasoning: String,
    generated_at: String,
}

// Story-level task readiness DTOs

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestTasksRequest {
    pub project_id: Uuid,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSuggestionResponse {
    pub title: String,
    pub description: String,
    pub acceptance_criteria_refs: Vec<String>,
    pub estimated_hours: Option<u32>,
    pub relevant_files: Vec<String>,
    pub confidence: f32,
}

impl From<TaskSuggestion> for TaskSuggestionResponse {
    fn from(suggestion: TaskSuggestion) -> Self {
        Self {
            title: suggestion.title,
            description: suggestion.description,
            acceptance_criteria_refs: suggestion.acceptance_criteria_refs,
            estimated_hours: suggestion.estimated_hours,
            relevant_files: suggestion.relevant_files,
            confidence: suggestion.confidence,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskClarityAnalysisResponse {
    pub task_id: Uuid,
    pub overall_score: u8,
    pub level: String,
    pub is_ai_ready: bool,
    pub dimensions: Vec<ClarityDimensionScore>,
    pub recommendations: Vec<String>,
    pub flagged_terms: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClarityDimensionScore {
    pub name: String,
    pub score: u8,
}

impl From<TaskClarityAnalysis> for TaskClarityAnalysisResponse {
    fn from(analysis: TaskClarityAnalysis) -> Self {
        let level_str = match analysis.level {
            ClarityLevel::Poor => "poor",
            ClarityLevel::Fair => "fair",
            ClarityLevel::Good => "good",
            ClarityLevel::Excellent => "excellent",
        };

        Self {
            task_id: analysis.task_id,
            overall_score: analysis.overall_score,
            level: level_str.to_string(),
            is_ai_ready: analysis.is_ai_ready(),
            dimensions: analysis
                .dimensions
                .into_iter()
                .map(|dim| ClarityDimensionScore {
                    name: dim.dimension,
                    score: dim.score,
                })
                .collect(),
            recommendations: analysis.recommendations,
            flagged_terms: analysis.flagged_terms,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoryAnalysisSummaryResponse {
    pub story_id: Uuid,
    pub total_tasks: i32,
    pub analyzed_tasks: i32,
    pub avg_clarity_score: Option<i32>,
    pub tasks_ai_ready: i32,
    pub tasks_needing_improvement: i32,
    pub common_issues: Vec<String>,
}

impl From<StoryAnalysisSummary> for StoryAnalysisSummaryResponse {
    fn from(summary: StoryAnalysisSummary) -> Self {
        Self {
            story_id: summary.story_id,
            total_tasks: summary.total_tasks,
            analyzed_tasks: summary.analyzed_tasks,
            avg_clarity_score: summary.avg_clarity_score,
            tasks_ai_ready: summary.tasks_ai_ready,
            tasks_needing_improvement: summary.tasks_needing_improvement,
            common_issues: summary.common_issues,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveSuggestionRequest {
    pub reviewed_by: String,
}

impl TaskAnalysisResponse {
    fn from_analysis(analysis: &TaskAnalysis, analyzed_at: DateTime<Utc>) -> Self {
        let clarity_score = analysis.clarity_score.clamp(0, 100);
        Self {
            task_id: analysis.task_id.to_string(),
            clarity_score: ClarityScoreResponse {
                score: clarity_score,
                level: clarity_level(clarity_score).to_string(),
                dimensions: build_clarity_dimensions(clarity_score),
            },
            vague_terms: extract_vague_terms(&analysis.recommendations),
            missing_elements: map_missing_elements(&analysis.missing_elements),
            technical_detail_recommendations: build_technical_detail_recommendations(
                &analysis.recommendations,
            ),
            ac_recommendations: build_ac_recommendations(&analysis.recommendations),
            ai_compatibility_issues: build_ai_compatibility_issues(&analysis.recommendations),
            examples: default_examples(),
            recommendations: build_recommendations(&analysis.recommendations),
            analyzed_at: analyzed_at.to_rfc3339(),
        }
    }
}

impl From<TaskEnrichmentSuggestion> for TaskEnrichmentResponse {
    fn from(value: TaskEnrichmentSuggestion) -> Self {
        Self {
            task_id: value.task_id,
            story_id: value.story_id,
            suggested_title: value.suggested_title,
            suggested_description: value.suggested_description,
            suggested_ac_refs: value.suggested_ac_refs,
            original_description: value.original_description,
            confidence: value.confidence,
            reasoning: value.reasoning,
            generated_at: value.generated_at.to_rfc3339(),
        }
    }
}

fn clarity_level(score: i32) -> &'static str {
    match score {
        0..=49 => "poor",
        50..=69 => "fair",
        70..=84 => "good",
        _ => "excellent",
    }
}

fn build_clarity_dimensions(score: i32) -> Vec<ClarityDimensionResponse> {
    let capped = score.clamp(0, 100);
    vec![
        ClarityDimensionResponse {
            dimension: "technical-details".to_string(),
            score: (capped as f32 * 0.75).round() as i32,
            weight: 0.4,
        },
        ClarityDimensionResponse {
            dimension: "acceptance-criteria".to_string(),
            score: (capped as f32 * 0.65).round() as i32,
            weight: 0.25,
        },
        ClarityDimensionResponse {
            dimension: "ai-compatibility".to_string(),
            score: (capped as f32 * 0.6).round() as i32,
            weight: 0.2,
        },
        ClarityDimensionResponse {
            dimension: "delivery-readiness".to_string(),
            score: capped,
            weight: 0.15,
        },
    ]
}

fn extract_vague_terms(recommendations: &[Recommendation]) -> Vec<VagueTermResponse> {
    let mut terms = Vec::new();
    for rec in recommendations {
        if !matches!(rec.gap_type, GapType::VagueLanguage) {
            continue;
        }
        for suggestion in &rec.specific_suggestions {
            if let Some(term) = suggestion.split('\'').nth(1) {
                terms.push(VagueTermResponse {
                    term: term.to_string(),
                    position: 0,
                    suggestion: suggestion.clone(),
                });
            }
        }
    }

    if terms.is_empty() {
        for term in &["implement", "create", "build", "add", "fix"] {
            terms.push(VagueTermResponse {
                term: term.to_string(),
                position: 0,
                suggestion: format!(
                    "Replace vague term '{}' with concrete, measurable action",
                    term
                ),
            });
        }
    }

    terms
}

fn map_missing_elements(elements: &[String]) -> Vec<MissingElementResponse> {
    if elements.is_empty() {
        return vec![MissingElementResponse {
            category: "technical-details".to_string(),
            description: "Task definition review pending".to_string(),
            importance: "medium".to_string(),
            recommendation: "Run readiness analysis after populating the task description"
                .to_string(),
        }];
    }

    elements
        .iter()
        .map(|element| map_missing_element(element.as_str()))
        .collect()
}

fn map_missing_element(element: &str) -> MissingElementResponse {
    let lower = element.to_lowercase();
    if lower.contains("acceptance criteria") {
        MissingElementResponse {
            category: "acceptance-criteria".to_string(),
            description: element.to_string(),
            importance: "critical".to_string(),
            recommendation: "Link the task to relevant AC IDs such as AC-READY-1".to_string(),
        }
    } else if lower.contains("estimate") {
        MissingElementResponse {
            category: "definition-of-done".to_string(),
            description: element.to_string(),
            importance: "medium".to_string(),
            recommendation: "Provide an estimated effort window (e.g., 3-4 hours)".to_string(),
        }
    } else if lower.contains("description") {
        MissingElementResponse {
            category: "technical-details".to_string(),
            description: element.to_string(),
            importance: "high".to_string(),
            recommendation:
                "Expand the task description with architecture decisions, file paths, and owners"
                    .to_string(),
        }
    } else {
        MissingElementResponse {
            category: "technical-details".to_string(),
            description: element.to_string(),
            importance: "medium".to_string(),
            recommendation: "Document criteria for completion".to_string(),
        }
    }
}

fn build_technical_detail_recommendations(
    recommendations: &[Recommendation],
) -> Vec<TechnicalDetailRecommendationResponse> {
    let mut descriptions: HashMap<&'static str, Option<String>> = HashMap::new();
    if let Some(rec) = recommendations
        .iter()
        .find(|rec| matches!(rec.gap_type, GapType::MissingTechnicalDetails))
    {
        for suggestion in &rec.specific_suggestions {
            let lower = suggestion.to_lowercase();
            if lower.contains("services/") || lower.contains(".rs") || lower.contains("apps/") {
                descriptions
                    .entry("file-path")
                    .or_insert_with(|| Some(suggestion.clone()));
            }
            if lower.contains("function") || lower.contains("method") {
                descriptions
                    .entry("function")
                    .or_insert_with(|| Some(suggestion.clone()));
            }
            if lower.contains("component") || lower.contains("hook") {
                descriptions
                    .entry("component")
                    .or_insert_with(|| Some(suggestion.clone()));
            }
            if lower.contains("input") || lower.contains("output") {
                descriptions
                    .entry("input-output")
                    .or_insert_with(|| Some(suggestion.clone()));
            }
            if lower.contains("architecture") || lower.contains("pattern") {
                descriptions
                    .entry("architecture")
                    .or_insert_with(|| Some(suggestion.clone()));
            }
        }
    }

    let mut entries = Vec::new();
    let defaults = vec![
        (
            "file-path",
            "Specify file paths impacted by this change",
            Some("Example: services/readiness/src/domain/task_analyzer.rs"),
        ),
        (
            "function",
            "List functions or handlers that require updates",
            Some("Example: TaskAnalyzer::analyze"),
        ),
        (
            "component",
            "Identify UI components adjusted by this task",
            Some("Example: apps/web/components/tasks/RecommendationsPanel.tsx"),
        ),
        (
            "input-output",
            "Clarify expected inputs and outputs for the new behaviour",
            Some("Define request/response payloads for the analysis endpoint"),
        ),
        (
            "architecture",
            "Document architecture or integration considerations",
            Some("Describe how the readiness service interacts with the gateway"),
        ),
    ];

    let mut seen = HashSet::new();
    for (kind, description, example) in defaults {
        let entry = descriptions
            .remove(kind)
            .flatten()
            .unwrap_or_else(|| description.to_string());
        if seen.insert(kind) {
            entries.push(TechnicalDetailRecommendationResponse {
                kind: kind.to_string(),
                description: entry,
                example: example.map(|s| s.to_string()),
            });
        }
    }

    entries
}

fn build_ac_recommendations(
    recommendations: &[Recommendation],
) -> Vec<AcceptanceCriteriaRecommendationResponse> {
    let mut results = Vec::new();
    for rec in recommendations {
        if !matches!(rec.gap_type, GapType::MissingAcceptanceCriteria) {
            continue;
        }

        for ac in &rec.ac_references {
            results.push(AcceptanceCriteriaRecommendationResponse {
                ac_id: ac.clone(),
                description: rec
                    .specific_suggestions
                    .first()
                    .cloned()
                    .unwrap_or_else(|| {
                        "Link this task to acceptance criteria for traceability".to_string()
                    }),
                relevance: "high".to_string(),
            });
        }
    }

    if results.is_empty() {
        results.push(AcceptanceCriteriaRecommendationResponse {
            ac_id: "AC-READY-1".to_string(),
            description: "Link the task to story acceptance criteria to enable readiness tracking"
                .to_string(),
            relevance: "high".to_string(),
        });
    }

    results
}

fn build_ai_compatibility_issues(recommendations: &[Recommendation]) -> Vec<String> {
    if let Some(rec) = recommendations
        .iter()
        .find(|rec| matches!(rec.gap_type, GapType::MissingAiAgentCompatibility))
    {
        let mut issues: Vec<String> = rec.specific_suggestions.clone();
        issues.retain(|issue| !issue.is_empty());
        if !issues.is_empty() {
            return issues;
        }
    }

    vec![
        "Define success criteria for the AI task hand-off".to_string(),
        "List dependencies and environment setup instructions".to_string(),
        "Clarify testing expectations and definition of done".to_string(),
    ]
}

fn build_recommendations(recommendations: &[Recommendation]) -> Vec<RecommendationResponse> {
    if recommendations.is_empty() {
        return vec![RecommendationResponse {
            id: "rec-1".to_string(),
            category: "technical-details".to_string(),
            title: "Clarify the task description".to_string(),
            description: "Add concrete file paths, functions, and acceptance criteria links"
                .to_string(),
            priority: "high".to_string(),
            actionable: true,
            auto_applyable: true,
        }];
    }

    recommendations
        .iter()
        .enumerate()
        .map(|(idx, rec)| RecommendationResponse {
            id: format!("rec-{}", idx + 1),
            category: match rec.gap_type {
                GapType::MissingTechnicalDetails => "technical-details".to_string(),
                GapType::VagueLanguage => "vague-terms".to_string(),
                GapType::MissingAcceptanceCriteria => "acceptance-criteria".to_string(),
                GapType::MissingAiAgentCompatibility => "ai-compatibility".to_string(),
                _ => "examples".to_string(),
            },
            title: rec.message.clone(),
            description: if rec.specific_suggestions.is_empty() {
                rec.message.clone()
            } else {
                rec.specific_suggestions.join("; ")
            },
            priority: match rec.gap_type {
                GapType::MissingTechnicalDetails | GapType::MissingAcceptanceCriteria => {
                    "high".to_string()
                }
                GapType::MissingAiAgentCompatibility => "medium".to_string(),
                GapType::VagueLanguage => "medium".to_string(),
                _ => "low".to_string(),
            },
            actionable: true,
            auto_applyable: idx == 0,
        })
        .collect()
}

fn default_examples() -> Vec<TaskExampleResponse> {
    vec![
        TaskExampleResponse {
            title: "Domain-driven recommendation generator".to_string(),
            description:
                "See services/readiness/src/domain/recommendation_generator.rs for a complete implementation"
                    .to_string(),
            source: "project".to_string(),
            project_id: None,
            task_id: None,
        },
        TaskExampleResponse {
            title: "API contract enforcement".to_string(),
            description:
                "Refer to services/api-gateway/tests/contract/test_task_analysis_contract.rs for specification coverage"
                    .to_string(),
            source: "domain".to_string(),
            project_id: None,
            task_id: None,
        },
    ]
}

#[derive(Debug, Serialize)]
pub struct ReadinessEvaluationResponse {
    pub score: i32,
    #[serde(rename = "missingItems")]
    pub missing_items: Vec<String>,
    pub recommendations: Vec<String>,
    pub summary: String,
    #[serde(rename = "isReady")]
    pub is_ready: bool,
}

impl From<ReadinessEvaluation> for ReadinessEvaluationResponse {
    fn from(eval: ReadinessEvaluation) -> Self {
        let is_ready = eval.is_ready();
        let ReadinessEvaluation {
            score,
            missing_items,
            recommendations,
            summary,
            ..
        } = eval;

        Self {
            score,
            missing_items,
            recommendations,
            summary,
            is_ready,
        }
    }
}

pub async fn evaluate_readiness(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Evaluating story readiness"
    );

    let evaluation = match usecases
        .evaluate_story_readiness(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            warn!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Story readiness evaluation failed"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        score = evaluation.score,
        missing_items = evaluation.missing_items.len(),
        "Story readiness evaluation completed"
    );

    Ok(Json(ReadinessEvaluationResponse::from(evaluation)))
}

pub async fn generate_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Generating acceptance criteria"
    );

    let criteria = match usecases
        .generate_acceptance_criteria(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Acceptance criteria generation failed"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        org_id = ?organization_id,
        generated = criteria.len(),
        "Generated acceptance criteria"
    );

    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn get_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?organization_id,
        user = %auth.auth.sub,
        "Fetching acceptance criteria"
    );

    let criteria = match usecases
        .get_criteria_for_story(story_id, organization_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?organization_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to fetch acceptance criteria"
            );
            return Err(err);
        }
    };

    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();
    Ok(Json(responses))
}

pub async fn add_criteria(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    Json(payload): Json<AddCriteriaRequest>,
) -> Result<impl IntoResponse, AppError> {
    let usecases = state.usecases.clone();
    let organization_id = auth.org_context.effective_organization_uuid();
    let criteria_tuples: Vec<(String, String, String, String)> = payload
        .criteria
        .into_iter()
        .map(|c| (c.ac_id, c.given, c.when, c.then))
        .collect();

    let criteria = usecases
        .add_acceptance_criteria(story_id, organization_id, criteria_tuples)
        .await?;
    let responses: Vec<AcceptanceCriterionResponse> = criteria
        .into_iter()
        .map(AcceptanceCriterionResponse::from)
        .collect();

    Ok((StatusCode::CREATED, Json(responses)))
}

pub async fn rehydrate_projections(
    AuthenticatedWithOrg { .. }: AuthenticatedWithOrg,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    rebuild_projections(state.pool.clone()).await;
    Ok(StatusCode::ACCEPTED)
}

pub async fn analyze_task(
    auth: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    payload: Option<Json<Value>>,
) -> Result<impl IntoResponse, AppError> {
    if let Some(Json(value)) = payload {
        let _ = value; // reserve for future analysis options
    }

    let org_id = auth.org_context.effective_organization_uuid();
    let analysis = state.usecases.analyze_task(task_id, org_id).await?;

    let response = TaskAnalysisResponse::from_analysis(&analysis, Utc::now());
    Ok(Json(response))
}

pub async fn get_task_analysis(
    auth: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    let analysis = state
        .usecases
        .get_task_analysis(task_id, org_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task analysis not found".to_string()))?;

    let response = TaskAnalysisResponse::from_analysis(&analysis, Utc::now());
    Ok(Json(response))
}

pub async fn enrich_task(
    auth: AuthenticatedWithOrg,
    Path(task_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    Json(payload): Json<TaskEnrichmentRequest>,
) -> Result<impl IntoResponse, AppError> {
    if let Some(body_task_id) = payload.task_id {
        if body_task_id != task_id {
            return Err(AppError::BadRequest(
                "Task ID in path and payload must match".to_string(),
            ));
        }
    }

    let org_id = auth.org_context.effective_organization_uuid();
    let suggestion = state
        .usecases
        .enrich_task(
            task_id,
            payload.story_id,
            org_id,
            payload.include_story_context,
            payload.include_related_tasks,
            payload.include_codebase_context,
        )
        .await?;

    Ok(Json(TaskEnrichmentResponse::from(suggestion)))
}

// Story-level task readiness handlers
// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
// AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)

/// Generate task suggestions for a story using GitHub context
///
/// POST /stories/{story_id}/suggest-tasks
pub async fn suggest_tasks_for_story(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    Json(payload): Json<SuggestTasksRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        project_id = %payload.project_id,
        org_id = ?org_id,
        user = %auth.auth.sub,
        "Generating task suggestions for story"
    );

    let suggestions = match state
        .usecases
        .suggest_tasks_for_story(story_id, org_id, payload.project_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                project_id = %payload.project_id,
                org_id = ?org_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to generate task suggestions"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        suggestions_count = suggestions.len(),
        org_id = ?org_id,
        "Generated task suggestions for story"
    );

    let responses: Vec<TaskSuggestionResponse> = suggestions
        .into_iter()
        .map(TaskSuggestionResponse::from)
        .collect();

    Ok((StatusCode::CREATED, Json(responses)))
}

/// Analyze all tasks in a story for clarity and AI readiness
///
/// POST /stories/{story_id}/analyze-tasks
pub async fn analyze_story_tasks(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?org_id,
        user = %auth.auth.sub,
        "Analyzing all tasks in story"
    );

    let analyses = match state.usecases.analyze_story_tasks(story_id, org_id).await {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?org_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to analyze story tasks"
            );
            return Err(err);
        }
    };

    info!(
        %story_id,
        tasks_analyzed = analyses.len(),
        org_id = ?org_id,
        "Completed story task analysis"
    );

    let responses: Vec<TaskClarityAnalysisResponse> = analyses
        .into_iter()
        .map(TaskClarityAnalysisResponse::from)
        .collect();

    Ok(Json(responses))
}

/// Get story-level analysis summary with aggregated metrics
///
/// GET /stories/{story_id}/analysis-summary
pub async fn get_story_analysis_summary(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?org_id,
        user = %auth.auth.sub,
        "Fetching story analysis summary"
    );

    let summary = match state
        .usecases
        .get_story_analysis_summary(story_id, org_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?org_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to fetch story analysis summary"
            );
            return Err(err);
        }
    };

    let summary = summary.ok_or_else(|| {
        AppError::NotFound(format!("No analysis summary found for story {}", story_id))
    })?;

    Ok(Json(StoryAnalysisSummaryResponse::from(summary)))
}

/// Get pending task suggestions for a story
///
/// GET /stories/{story_id}/suggestions
pub async fn get_pending_suggestions(
    auth: AuthenticatedWithOrg,
    Path(story_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    info!(
        %story_id,
        org_id = ?org_id,
        user = %auth.auth.sub,
        "Fetching pending task suggestions"
    );

    let suggestions = match state
        .usecases
        .get_pending_suggestions(story_id, org_id)
        .await
    {
        Ok(value) => value,
        Err(err) => {
            error!(
                %story_id,
                org_id = ?org_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to fetch pending suggestions"
            );
            return Err(err);
        }
    };

    let responses: Vec<TaskSuggestionResponse> = suggestions
        .into_iter()
        .map(TaskSuggestionResponse::from)
        .collect();

    Ok(Json(responses))
}

/// Approve a task suggestion
///
/// POST /suggestions/{suggestion_id}/approve
pub async fn approve_suggestion(
    auth: AuthenticatedWithOrg,
    Path(suggestion_id): Path<Uuid>,
    State(state): State<ReadinessAppState>,
    Json(payload): Json<ApproveSuggestionRequest>,
) -> Result<impl IntoResponse, AppError> {
    let org_id = auth.org_context.effective_organization_uuid();
    info!(
        %suggestion_id,
        org_id = ?org_id,
        user = %auth.auth.sub,
        reviewed_by = %payload.reviewed_by,
        "Approving task suggestion"
    );

    match state
        .usecases
        .approve_suggestion(suggestion_id, &payload.reviewed_by)
        .await
    {
        Ok(_) => {
            info!(
                %suggestion_id,
                org_id = ?org_id,
                "Task suggestion approved"
            );
            Ok(StatusCode::NO_CONTENT)
        }
        Err(err) => {
            error!(
                %suggestion_id,
                org_id = ?org_id,
                user = %auth.auth.sub,
                error = %err,
                "Failed to approve suggestion"
            );
            Err(err)
        }
    }
}
