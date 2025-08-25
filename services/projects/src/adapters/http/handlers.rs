use axum::{
    http::StatusCode,
    response::IntoResponse,
};
use auth_clerk::Authenticated;

pub async fn create_project(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::CREATED, "Project created")
}

pub async fn update_project_settings(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Project settings updated")
}

pub async fn get_project() -> impl IntoResponse {
    (StatusCode::OK, "Project details")
}