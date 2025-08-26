use auth_clerk::Authenticated;
use axum::{http::StatusCode, response::IntoResponse};

pub async fn evaluate_readiness(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Readiness evaluated")
}

pub async fn generate_criteria(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Criteria generated")
}

pub async fn get_criteria(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Criteria list")
}
