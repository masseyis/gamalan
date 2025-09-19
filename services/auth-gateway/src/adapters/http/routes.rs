use crate::adapters::http::handlers::{
    add_member_to_organization, clerk_webhooks, create_organization,
    get_organization_by_external_id, get_user_organizations,
};
use crate::adapters::persistence::repo::{OrganizationRepositoryImpl, UserRepositoryImpl};
use crate::application::usecases::{OrganizationUsecases, UserUsecases};
use auth_clerk::JwtVerifier;
use shuttle_axum::axum::routing::{get, post};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn create_auth_router(
    pool: PgPool,
    verifier: Arc<Mutex<JwtVerifier>>,
) -> shuttle_axum::axum::Router {
    let user_repo = Arc::new(UserRepositoryImpl::new(pool.clone()));
    let org_repo = Arc::new(OrganizationRepositoryImpl::new(pool.clone()));

    let user_usecases = Arc::new(UserUsecases::new(user_repo.clone()));
    let org_usecases = Arc::new(OrganizationUsecases::new(org_repo, user_repo));

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
        .layer(shuttle_axum::axum::Extension(user_usecases))
        .layer(shuttle_axum::axum::Extension(org_usecases))
        .layer(shuttle_axum::axum::Extension(verifier))
}
