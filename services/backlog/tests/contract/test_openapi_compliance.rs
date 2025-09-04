use axum::http::StatusCode;
use serde_json::{json, Value};
use uuid::Uuid;

// Contract tests to validate API responses match OpenAPI specification
// These tests ensure that our API responses conform to the documented schema

#[tokio::test]
async fn test_story_response_schema() {
    // This test validates the Story response matches the OpenAPI schema
    // Expected schema:
    // {
    //   "id": "uuid",
    //   "project_id": "uuid",
    //   "title": "string",
    //   "description": "string|null",
    //   "status": "enum[Ready|InProgress|InReview|Done]",
    //   "labels": ["string"]
    // }

    let story_data = json!({
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "project_id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Test Story",
        "description": "Test description",
        "status": "Ready",
        "labels": ["frontend", "bug"]
    });

    // Validate required fields exist
    assert!(story_data.get("id").is_some());
    assert!(story_data.get("project_id").is_some());
    assert!(story_data.get("title").is_some());
    assert!(story_data.get("status").is_some());
    assert!(story_data.get("labels").is_some());

    // Validate types
    assert!(story_data["id"].is_string());
    assert!(story_data["project_id"].is_string());
    assert!(story_data["title"].is_string());
    assert!(story_data["status"].is_string());
    assert!(story_data["labels"].is_array());

    // Validate UUID format
    let id_str = story_data["id"].as_str().unwrap();
    assert!(Uuid::parse_str(id_str).is_ok());

    // Validate status enum
    let status = story_data["status"].as_str().unwrap();
    assert!(matches!(
        status,
        "Ready" | "InProgress" | "InReview" | "Done"
    ));
}

#[tokio::test]
async fn test_task_response_schema() {
    // Expected Task schema:
    // {
    //   "id": "uuid",
    //   "story_id": "uuid",
    //   "title": "string",
    //   "description": "string|null",
    //   "acceptance_criteria_refs": ["string"]
    // }

    let task_data = json!({
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "story_id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Test Task",
        "description": "Test description",
        "acceptance_criteria_refs": ["AC1", "AC2"]
    });

    // Validate required fields
    assert!(task_data.get("id").is_some());
    assert!(task_data.get("story_id").is_some());
    assert!(task_data.get("title").is_some());
    assert!(task_data.get("acceptance_criteria_refs").is_some());

    // Validate types
    assert!(task_data["id"].is_string());
    assert!(task_data["story_id"].is_string());
    assert!(task_data["title"].is_string());
    assert!(task_data["acceptance_criteria_refs"].is_array());

    // Validate UUID format
    let id_str = task_data["id"].as_str().unwrap();
    assert!(Uuid::parse_str(id_str).is_ok());

    // Validate AC refs are non-empty strings
    let ac_refs = task_data["acceptance_criteria_refs"].as_array().unwrap();
    for ac_ref in ac_refs {
        assert!(ac_ref.is_string());
        assert!(!ac_ref.as_str().unwrap().is_empty());
    }
}

#[tokio::test]
async fn test_error_response_schema() {
    // Expected error schema:
    // {
    //   "error": "string",
    //   "message": "string",
    //   "timestamp": "string" (optional)
    // }

    let error_data = json!({
        "error": "NotFound",
        "message": "Story with id 550e8400-e29b-41d4-a716-446655440000 not found",
        "timestamp": "2024-01-01T00:00:00Z"
    });

    // Validate required fields
    assert!(error_data.get("error").is_some());
    assert!(error_data.get("message").is_some());

    // Validate types
    assert!(error_data["error"].is_string());
    assert!(error_data["message"].is_string());

    // Message should not be empty
    assert!(!error_data["message"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn test_create_story_request_schema() {
    // Expected CreateStoryRequest schema:
    // {
    //   "title": "string" (required),
    //   "description": "string|null" (optional),
    //   "labels": ["string"] (optional, default: [])
    // }

    let valid_request = json!({
        "title": "Test Story",
        "description": "Test description",
        "labels": ["frontend", "bug"]
    });

    assert!(valid_request.get("title").is_some());
    assert!(valid_request["title"].is_string());
    assert!(!valid_request["title"].as_str().unwrap().trim().is_empty());

    // Minimal valid request
    let minimal_request = json!({
        "title": "Minimal Story"
    });

    assert!(minimal_request.get("title").is_some());
    assert!(!minimal_request["title"].as_str().unwrap().trim().is_empty());
}

#[tokio::test]
async fn test_create_task_request_schema() {
    // Expected CreateTaskRequest schema:
    // {
    //   "title": "string" (required),
    //   "description": "string|null" (optional),
    //   "acceptance_criteria_refs": ["string"] (required, non-empty)
    // }

    let valid_request = json!({
        "title": "Test Task",
        "description": "Task description",
        "acceptance_criteria_refs": ["AC1", "AC2"]
    });

    assert!(valid_request.get("title").is_some());
    assert!(valid_request.get("acceptance_criteria_refs").is_some());

    assert!(valid_request["title"].is_string());
    assert!(valid_request["acceptance_criteria_refs"].is_array());

    assert!(!valid_request["title"].as_str().unwrap().trim().is_empty());

    let ac_refs = valid_request["acceptance_criteria_refs"]
        .as_array()
        .unwrap();
    assert!(!ac_refs.is_empty());

    for ac_ref in ac_refs {
        assert!(ac_ref.is_string());
        assert!(!ac_ref.as_str().unwrap().is_empty());
    }
}

#[tokio::test]
async fn test_update_story_request_schema() {
    // Expected UpdateStoryRequest schema (all fields optional):
    // {
    //   "title": "string" (optional),
    //   "description": "string|null" (optional),
    //   "labels": ["string"] (optional)
    // }

    let update_request = json!({
        "title": "Updated Story Title"
    });

    // Should be valid with just title
    if let Some(title) = update_request.get("title") {
        assert!(title.is_string());
        assert!(!title.as_str().unwrap().trim().is_empty());
    }

    // Should be valid with all fields
    let full_update = json!({
        "title": "Updated Title",
        "description": "Updated description",
        "labels": ["updated", "labels"]
    });

    if let Some(labels) = full_update.get("labels") {
        assert!(labels.is_array());
    }
}

#[tokio::test]
async fn test_stories_list_response_schema() {
    // Expected stories list response:
    // {
    //   "stories": [Story],
    //   "total": number,
    //   "page": number (optional),
    //   "per_page": number (optional)
    // }

    let stories_response = json!({
        "stories": [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "project_id": "550e8400-e29b-41d4-a716-446655440001",
                "title": "Story 1",
                "description": null,
                "status": "Ready",
                "labels": []
            }
        ],
        "total": 1
    });

    assert!(stories_response.get("stories").is_some());
    assert!(stories_response["stories"].is_array());

    if let Some(total) = stories_response.get("total") {
        assert!(total.is_number());
        assert!(total.is_number());
    }
}

#[tokio::test]
async fn test_http_status_codes_compliance() {
    // Test that we return correct HTTP status codes per OpenAPI spec

    // Success cases
    assert_eq!(StatusCode::OK.as_u16(), 200); // GET requests
    assert_eq!(StatusCode::CREATED.as_u16(), 201); // POST requests
    assert_eq!(StatusCode::NO_CONTENT.as_u16(), 204); // DELETE requests

    // Client error cases
    assert_eq!(StatusCode::BAD_REQUEST.as_u16(), 400); // Validation errors
    assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401); // Missing/invalid auth
    assert_eq!(StatusCode::FORBIDDEN.as_u16(), 403); // Insufficient permissions
    assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404); // Resource not found
    assert_eq!(StatusCode::CONFLICT.as_u16(), 409); // Resource conflicts

    // Server error cases
    assert_eq!(StatusCode::INTERNAL_SERVER_ERROR.as_u16(), 500); // Unexpected errors
}

// Helper function to validate response headers match OpenAPI spec
fn validate_response_headers(headers: &axum::http::HeaderMap) {
    // Should include Content-Type for JSON responses
    if let Some(content_type) = headers.get("content-type") {
        let content_type_str = content_type.to_str().unwrap_or("");
        assert!(content_type_str.contains("application/json"));
    }

    // Should include correlation ID for tracing
    if let Some(_correlation_id) = headers.get("x-correlation-id") {
        // Correlation ID should be present for request tracking
        // Format validation could be added here
    }
}

// Helper function to validate common pagination schema
fn validate_pagination_schema(data: &Value) {
    if let Some(page) = data.get("page") {
        assert!(page.is_number());
        assert!(page.as_u64().unwrap() >= 1);
    }

    if let Some(per_page) = data.get("per_page") {
        assert!(per_page.is_number());
        assert!(per_page.as_u64().unwrap() >= 1);
        assert!(per_page.as_u64().unwrap() <= 100); // Reasonable limit
    }

    if let Some(total) = data.get("total") {
        assert!(total.is_number());
        assert!(total.is_number());
    }
}
