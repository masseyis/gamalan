use crate::adapters::http::handlers::{
    add_member_to_organization,
    add_team_member,
    clerk_webhooks,
    commit_story_points,
    complete_sprint,
    complete_story_points,
    create_organization,
    // Sprint handlers
    create_sprint,
    // Team handlers
    create_team,
    get_active_sprint_by_team,
    get_organization_by_external_id,
    get_sprint,
    get_sprints_by_team,
    get_team,
    get_team_members,
    get_teams_by_organization,
    get_user_organizations,
    get_user_teams,
    move_sprint_to_review,
    start_sprint,
};
use crate::adapters::persistence::repo::{
    OrganizationRepositoryImpl, SprintRepositoryImpl, TeamRepositoryImpl, UserRepositoryImpl,
};
use crate::application::usecases::{
    OrganizationUsecases, SprintUsecases, TeamUsecases, UserUsecases,
};
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{get, patch, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_auth_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    let user_repo = Arc::new(UserRepositoryImpl::new(pool.clone()));
    let org_repo = Arc::new(OrganizationRepositoryImpl::new(pool.clone()));
    let team_repo = Arc::new(TeamRepositoryImpl::new(pool.clone()));
    let sprint_repo = Arc::new(SprintRepositoryImpl::new(pool.clone()));

    let user_usecases = Arc::new(UserUsecases::new(user_repo.clone()));
    let org_usecases = Arc::new(OrganizationUsecases::new(org_repo, user_repo));
    let team_usecases = Arc::new(TeamUsecases::new(
        team_repo,
        user_repo.clone(),
        org_repo.clone(),
    ));
    let sprint_usecases = Arc::new(SprintUsecases::new(sprint_repo, team_repo.clone()));

    shuttle_axum::axum::Router::new()
        // Webhooks
        .route("/clerk/webhooks", post(clerk_webhooks))
        // Organization API
        .route("/organizations", post(create_organization))
        .route(
            "/organizations/{external_id}",
            get(get_organization_by_external_id),
        )
        .route(
            "/users/{user_id}/organizations",
            get(get_user_organizations),
        )
        .route(
            "/organizations/{org_id}/members",
            post(add_member_to_organization),
        )
        // Team API
        .route("/organizations/{org_id}/teams", post(create_team))
        .route(
            "/organizations/{org_id}/teams",
            get(get_teams_by_organization),
        )
        .route("/teams/{team_id}", get(get_team))
        .route("/teams/{team_id}/members", post(add_team_member))
        .route("/teams/{team_id}/members", get(get_team_members))
        .route("/users/{user_id}/teams", get(get_user_teams))
        // Sprint API
        .route("/teams/{team_id}/sprints", post(create_sprint))
        .route("/teams/{team_id}/sprints", get(get_sprints_by_team))
        .route(
            "/teams/{team_id}/sprints/active",
            get(get_active_sprint_by_team),
        )
        .route("/sprints/{sprint_id}", get(get_sprint))
        .route("/sprints/{sprint_id}/start", post(start_sprint))
        .route("/sprints/{sprint_id}/review", patch(move_sprint_to_review))
        .route("/sprints/{sprint_id}/complete", post(complete_sprint))
        .route(
            "/sprints/{sprint_id}/commit-points",
            patch(commit_story_points),
        )
        .route(
            "/sprints/{sprint_id}/complete-points",
            patch(complete_story_points),
        )
        .layer(shuttle_axum::axum::Extension(user_usecases))
        .layer(shuttle_axum::axum::Extension(org_usecases))
        .layer(shuttle_axum::axum::Extension(team_usecases))
        .layer(shuttle_axum::axum::Extension(sprint_usecases))
        .layer(shuttle_axum::axum::Extension(verifier))
}
