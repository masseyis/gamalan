use auth_clerk::Authenticated;
use axum::{http::StatusCode, response::IntoResponse};

pub async fn create_story(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::CREATED, "Story created")
}

pub async fn get_story() -> impl IntoResponse {
    (StatusCode::OK, "Story details")
}

pub async fn update_story(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Story updated")
}

pub async fn create_task(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::CREATED, "Task created")
}

pub async fn update_story_status(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Story status updated")
}

pub async fn delete_story(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Story deleted")
}
