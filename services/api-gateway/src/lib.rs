use axum::routing::{delete, get, patch, post, put};
use axum::{Extension, Router};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::trace::TraceLayer;

pub mod auth;

use async_trait::async_trait;
use auth_clerk::JwtVerifier;
use backlog::adapters::http::handlers as backlog_handlers;
use backlog::adapters::http::BacklogAppState;
use backlog::adapters::websocket::{websocket_handler, WebSocketManager};
use common::AppError;
use prompt_builder::adapters::http::handlers as prompt_handlers;
use prompt_builder::application::ports as prompt_ports;
use readiness::adapters::http::handlers as readiness_handlers;
use readiness::adapters::http::handlers::ReadinessAppState;
use sqlx::PgPool;
use uuid::Uuid;

pub type BacklogUsecases = backlog::application::BacklogUsecases;
pub type ReadinessUsecases = readiness::application::ReadinessUsecases;
pub type PromptBuilderUsecases = prompt_builder::application::PromptBuilderUsecases;

pub fn build_backlog_router(
    backlog_usecases: Arc<BacklogUsecases>,
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> Router {
    // Create WebSocket manager for real-time updates
    let ws_manager = Arc::new(WebSocketManager::new(100));

    // Create state with usecases, WebSocket manager, and database pool
    let state = Arc::new(BacklogAppState::new(
        backlog_usecases,
        ws_manager.clone(),
        pool,
    ));
    let trace_layer =
        TraceLayer::new_for_http().make_span_with(|request: &axum::http::Request<_>| {
            let org_id = request
                .headers()
                .get("x-organization-id")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("none")
                .to_string();
            let user_id = request
                .headers()
                .get("x-user-id")
                .and_then(|value| value.to_str().ok())
                .unwrap_or("anonymous")
                .to_string();

            tracing::info_span!(
                "backlog_http_request",
                method = %request.method(),
                uri = %request.uri(),
                org_id,
                user_id
            )
        });

    Router::new()
        .route(
            "/api/v1/projects/{project_id}/stories",
            post(backlog_handlers::create_story),
        )
        .route(
            "/api/v1/projects/{project_id}/stories",
            get(backlog_handlers::get_stories_by_project),
        )
        .route(
            "/api/v1/projects/{project_id}/sprints",
            post(backlog_handlers::create_sprint),
        )
        .route("/api/v1/stories/{id}", get(backlog_handlers::get_story))
        .route(
            "/api/v1/stories/{id}",
            patch(backlog_handlers::update_story),
        )
        .route(
            "/api/v1/stories/{id}",
            delete(backlog_handlers::delete_story),
        )
        .route(
            "/api/v1/stories/{id}/ready-override",
            put(backlog_handlers::override_story_ready),
        )
        .route(
            "/api/v1/stories/{id}/tasks",
            post(backlog_handlers::create_task),
        )
        .route(
            "/api/v1/stories/{id}/tasks",
            get(backlog_handlers::get_tasks_by_story),
        )
        .route(
            "/api/v1/stories/{id}/tasks/available",
            get(backlog_handlers::get_available_tasks),
        )
        .route(
            "/api/v1/stories/{id}/status",
            patch(backlog_handlers::update_story_status),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria",
            get(backlog_handlers::get_acceptance_criteria),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria",
            post(backlog_handlers::create_acceptance_criterion),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria/{criterion_id}",
            patch(backlog_handlers::update_acceptance_criterion),
        )
        .route(
            "/api/v1/stories/{id}/acceptance-criteria/{criterion_id}",
            delete(backlog_handlers::delete_acceptance_criterion),
        )
        .route(
            "/api/v1/tasks/owned",
            get(backlog_handlers::get_user_owned_tasks),
        )
        .route(
            "/api/v1/tasks/recommended",
            get(backlog_handlers::get_recommended_tasks),
        )
        .route(
            "/api/v1/tasks/{task_id}/ownership",
            put(backlog_handlers::take_task_ownership),
        )
        .route(
            "/api/v1/tasks/{task_id}/ownership",
            delete(backlog_handlers::release_task_ownership),
        )
        .route(
            "/api/v1/tasks/{task_id}/work/start",
            post(backlog_handlers::start_task_work),
        )
        .route(
            "/api/v1/tasks/{task_id}/work/complete",
            post(backlog_handlers::complete_task_work),
        )
        .route(
            "/api/v1/tasks/{task_id}/status",
            patch(backlog_handlers::update_task_status),
        )
        .route(
            "/api/v1/tasks/{task_id}/estimate",
            patch(backlog_handlers::set_task_estimate),
        )
        // WebSocket endpoint for real-time task updates
        .route("/api/v1/ws/tasks", get(websocket_handler))
        .with_state(state)
        .layer(Extension(verifier))
        .layer(trace_layer)
}

pub fn build_readiness_router(
    pool: PgPool,
    readiness_usecases: Arc<ReadinessUsecases>,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> Router {
    let state = ReadinessAppState {
        usecases: readiness_usecases,
        pool: Arc::new(pool),
    };

    Router::new()
        .route(
            "/api/v1/readiness/{story_id}/evaluate",
            post(readiness_handlers::evaluate_readiness),
        )
        .route(
            "/api/v1/readiness/criteria/{story_id}/generate",
            post(readiness_handlers::generate_criteria),
        )
        .route(
            "/api/v1/readiness/criteria/{story_id}",
            get(readiness_handlers::get_criteria),
        )
        .route(
            "/api/v1/readiness/criteria/{story_id}",
            post(readiness_handlers::add_criteria),
        )
        .route(
            "/api/v1/readiness/projections/hydrate",
            post(readiness_handlers::rehydrate_projections),
        )
        .route(
            "/api/v1/readiness/tasks/{task_id}/analyze",
            post(readiness_handlers::analyze_task),
        )
        .route(
            "/api/v1/readiness/tasks/{task_id}/analysis",
            get(readiness_handlers::get_task_analysis),
        )
        .route(
            "/api/v1/readiness/tasks/{task_id}/enrich",
            post(readiness_handlers::enrich_task),
        )
        // Story-level task readiness routes
        .route(
            "/api/v1/readiness/stories/{story_id}/suggest-tasks",
            post(readiness_handlers::suggest_tasks_for_story),
        )
        .route(
            "/api/v1/readiness/stories/{story_id}/analyze-tasks",
            post(readiness_handlers::analyze_story_tasks),
        )
        .route(
            "/api/v1/readiness/stories/{story_id}/analysis-summary",
            get(readiness_handlers::get_story_analysis_summary),
        )
        .route(
            "/api/v1/readiness/stories/{story_id}/suggestions",
            get(readiness_handlers::get_pending_suggestions),
        )
        .route(
            "/api/v1/readiness/suggestions/{suggestion_id}/approve",
            post(readiness_handlers::approve_suggestion),
        )
        .with_state(state)
        .layer(Extension(verifier))
        .layer(TraceLayer::new_for_http())
}

pub fn build_sprint_router(
    sprint_usecases: Arc<sprint::SprintsUsecases>,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> Router {
    Router::new()
        .route(
            "/api/v1/projects/{project_id}/sprints/active",
            get(sprint::adapters::http::handlers::get_active_sprint),
        )
        .with_state(sprint_usecases)
        .layer(Extension(verifier))
        .layer(TraceLayer::new_for_http())
}

pub fn build_prompt_builder_router(
    prompt_usecases: Arc<PromptBuilderUsecases>,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> Router {
    Router::new()
        .route(
            "/api/v1/prompt-builder/plans/from-story/{story_id}",
            post(prompt_handlers::generate_plan_pack_from_story),
        )
        .route(
            "/api/v1/prompt-builder/plans/story/{story_id}",
            get(prompt_handlers::get_plan_pack_by_story),
        )
        .route(
            "/api/v1/prompt-builder/plans/story/{story_id}/regenerate",
            put(prompt_handlers::regenerate_plan_pack),
        )
        .route(
            "/api/v1/prompt-builder/work-packets/from-task/{task_id}",
            post(prompt_handlers::generate_task_pack_from_task),
        )
        .route(
            "/api/v1/prompt-builder/work-packets/task/{task_id}",
            get(prompt_handlers::get_task_pack_by_task),
        )
        .route(
            "/api/v1/prompt-builder/work-packets/task/{task_id}/markdown",
            get(prompt_handlers::get_task_pack_markdown),
        )
        .route(
            "/api/v1/prompt-builder/work-packets/task/{task_id}/json",
            get(prompt_handlers::get_task_pack_json),
        )
        .route(
            "/api/v1/prompt-builder/work-packets/task/{task_id}/regenerate",
            put(prompt_handlers::regenerate_task_pack),
        )
        .with_state(prompt_usecases)
        .layer(Extension(verifier))
        .layer(TraceLayer::new_for_http())
}

#[derive(Clone)]
pub struct PromptBacklogServiceAdapter {
    pub backlog: Arc<BacklogUsecases>,
}

#[async_trait]
impl prompt_ports::BacklogService for PromptBacklogServiceAdapter {
    async fn get_story_info(
        &self,
        story_id: Uuid,
    ) -> Result<Option<prompt_ports::StoryInfo>, AppError> {
        let story = self.backlog.get_story(story_id, None).await?;
        Ok(story.map(|story| prompt_ports::StoryInfo {
            id: story.id,
            title: story.title,
            description: story.description,
            status: story.status.to_string(),
        }))
    }

    async fn get_task_info(
        &self,
        task_id: Uuid,
    ) -> Result<Option<prompt_ports::TaskInfo>, AppError> {
        let task = self.backlog.get_task(task_id, None).await?;
        Ok(task.map(|task| prompt_ports::TaskInfo {
            id: task.id,
            story_id: task.story_id,
            title: task.title,
            description: task.description,
            acceptance_criteria_refs: task.acceptance_criteria_refs,
        }))
    }
}

#[derive(Clone)]
pub struct PromptReadinessServiceAdapter {
    pub readiness: Arc<ReadinessUsecases>,
}

#[async_trait]
impl prompt_ports::ReadinessService for PromptReadinessServiceAdapter {
    async fn get_acceptance_criteria(
        &self,
        story_id: Uuid,
    ) -> Result<Vec<prompt_ports::AcceptanceCriterion>, AppError> {
        let criteria = self
            .readiness
            .get_criteria_for_story(story_id, None)
            .await?;

        Ok(criteria
            .into_iter()
            .map(|criterion| prompt_ports::AcceptanceCriterion {
                ac_id: criterion.ac_id,
                given: criterion.given,
                when: criterion.when,
                then: criterion.then,
            })
            .collect())
    }

    async fn evaluate_readiness(
        &self,
        story_id: Uuid,
    ) -> Result<prompt_ports::ReadinessEvaluation, AppError> {
        let evaluation = self
            .readiness
            .evaluate_story_readiness(story_id, None)
            .await?;

        Ok(prompt_ports::ReadinessEvaluation {
            score: evaluation.score,
            missing_items: evaluation.missing_items,
        })
    }
}
