use crate::adapters::http::handlers::{
    create_project, delete_project, get_project, get_project_settings, get_projects, ready,
    update_project, update_project_settings,
};
use crate::adapters::persistence::repo::{ProjectRepositoryImpl, ProjectSettingsRepositoryImpl};
use crate::application::usecases::ProjectUsecases;
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{delete, get, post, put};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_projects_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    // Create repositories
    let project_repo = Arc::new(ProjectRepositoryImpl::new(pool.clone()));
    let settings_repo = Arc::new(ProjectSettingsRepositoryImpl::new(pool));

    // Create use cases
    let project_usecases = Arc::new(ProjectUsecases::new(project_repo, settings_repo));

    shuttle_axum::axum::Router::new()
        // Health checks
        .route("/health", get(|| async { "OK" }))
        .route("/ready", get(ready))
        // Project management
        .route("/projects", get(get_projects).post(create_project))
        .route(
            "/projects/{project_id}",
            get(get_project).put(update_project).delete(delete_project),
        )
        // Project settings
        .route(
            "/projects/{project_id}/settings",
            get(get_project_settings).put(update_project_settings),
        )
        // Add extensions
        .layer(shuttle_axum::axum::Extension(project_usecases))
        .layer(shuttle_axum::axum::Extension(verifier))
}
