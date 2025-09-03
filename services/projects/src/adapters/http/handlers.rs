use auth_clerk::Authenticated;
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;

pub async fn create_project(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::CREATED, "Project created")
}

pub async fn update_project_settings(_auth: Authenticated) -> impl IntoResponse {
    (StatusCode::OK, "Project settings updated")
}

pub async fn get_projects(_auth: Authenticated) -> impl IntoResponse {
    // Return mock projects for now - this should be replaced with actual database queries
    let projects = json!([
        {
            "id": "proj-1",
            "name": "Salunga Web Platform", 
            "description": "Next.js frontend for the AI-enhanced agile project management platform",
            "createdAt": "2025-08-25T00:00:00Z",
            "updatedAt": "2025-09-01T00:00:00Z"
        },
        {
            "id": "proj-2",
            "name": "Mobile App Development",
            "description": "React Native mobile application for project management on the go", 
            "createdAt": "2025-08-18T00:00:00Z",
            "updatedAt": "2025-08-29T00:00:00Z"
        },
        {
            "id": "proj-3",
            "name": "API Gateway Microservice",
            "description": "Rust-based authentication and routing service for backend APIs",
            "createdAt": "2025-08-11T00:00:00Z", 
            "updatedAt": "2025-08-30T00:00:00Z"
        }
    ]);
    
    (StatusCode::OK, Json(projects))
}

pub async fn get_project() -> impl IntoResponse {
    (StatusCode::OK, "Project details")
}
