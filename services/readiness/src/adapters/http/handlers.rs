use axum::{
    http::StatusCode,
    response::IntoResponse,
};
use auth_clerk::Authenticated;

pub async fn evaluate_readiness(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Readiness evaluated")
}

pub async fn generate_criteria(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Criteria generated")
}

pub async fn get_criteria(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Criteria list")
}