use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use backlog::create_backlog_router;
use serde_json::json;
use sqlx::PgPool; // Intentional unused import to test clippy blocking
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::util::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;

// Import the common test setup
use crate::common::setup_test_db;

async fn setup_app() -> Router {
    let pool = setup_test_db().await;

    // Create a test JWT verifier that accepts "valid-test-token"
    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    create_backlog_router(pool, verifier).await
}

#[tokio::test]
async fn test_health_endpoint() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Health endpoint was removed, expect 404
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_create_story_unauthorized() {
    let app = setup_app().await;

    let new_story = json!({
        "title": "Test Story",
        "description": "Test description",
        "labels": ["test"]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/550e8400-e29b-41d4-a716-446655440000/stories")
                .header("content-type", "application/json")
                .body(Body::from(new_story.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_get_stories_by_project_unauthorized() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/projects/550e8400-e29b-41d4-a716-446655440000/stories")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_story_bad_request() {
    let app = setup_app().await;

    let invalid_story = json!({
        "title": "",  // Empty title should fail validation
        "description": "Test description"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/550e8400-e29b-41d4-a716-446655440000/stories")
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::from(invalid_story.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should be bad request for invalid data
    assert!(response.status().is_client_error());
}

#[tokio::test]
async fn test_get_story_not_found() {
    let app = setup_app().await;

    let non_existent_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/stories/{}", non_existent_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_update_story_not_found() {
    let app = setup_app().await;

    let non_existent_id = Uuid::new_v4();
    let update_data = json!({
        "title": "Updated Title"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/stories/{}", non_existent_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::from(update_data.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_story_not_found() {
    let app = setup_app().await;

    let non_existent_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(format!("/stories/{}", non_existent_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_create_task_unauthorized() {
    let app = setup_app().await;

    let story_id = Uuid::new_v4();
    let new_task = json!({
        "title": "Test Task",
        "description": "Test description",
        "acceptance_criteria_refs": ["AC1"]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/stories/{}/tasks", story_id))
                .header("content-type", "application/json")
                .body(Body::from(new_task.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_malformed_json_request() {
    let app = setup_app().await;

    let malformed_json = "{invalid json}";

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/projects/550e8400-e29b-41d4-a716-446655440000/stories")
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::from(malformed_json))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_invalid_uuid_in_path() {
    let app = setup_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/stories/invalid-uuid")
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .header("x-user-id", "test-user-123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

// Task ownership integration tests
#[tokio::test]
async fn test_task_ownership_workflow_integration() {
    let app = setup_app().await;
    let project_id = Uuid::new_v4();

    // Create a story first
    let story_request = json!({
        "title": "Test Story for Task Ownership",
        "description": "Integration test story",
        "labels": ["integration-test"]
    });

    let story_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(story_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(story_response.status(), StatusCode::CREATED);
    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = story_result["story_id"].as_str().unwrap();

    // Create a task
    let task_request = json!({
        "title": "Test Task for Ownership",
        "description": "Task to test ownership workflow",
        "acceptance_criteria_refs": ["AC1"]
    });

    let task_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(task_response.status(), StatusCode::CREATED);
    let task_body = to_bytes(task_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let task_result: serde_json::Value = serde_json::from_slice(&task_body).unwrap();
    let task_id = task_result["task_id"].as_str().unwrap();

    // Test 1: Get available tasks (should include our new task)
    let available_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/stories/{}/tasks/available", story_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(available_response.status(), StatusCode::OK);

    // Test 2: Take task ownership ("I'm on it")
    let ownership_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/tasks/{}/ownership", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(ownership_response.status(), StatusCode::OK);
    let ownership_body = to_bytes(ownership_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let ownership_result: serde_json::Value = serde_json::from_slice(&ownership_body).unwrap();
    assert_eq!(ownership_result["success"], true);

    // Test 3: Start work on the task
    let start_work_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/tasks/{}/work/start", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(start_work_response.status(), StatusCode::OK);

    // Test 4: Set task estimate (only owner can do this)
    let estimate_request = json!({
        "estimated_hours": 8
    });

    let estimate_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/tasks/{}/estimate", task_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(estimate_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(estimate_response.status(), StatusCode::OK);

    // Test 5: Complete work
    let complete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/tasks/{}/work/complete", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(complete_response.status(), StatusCode::OK);

    // Test 6: Get user's owned tasks
    let owned_tasks_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/tasks/owned")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(owned_tasks_response.status(), StatusCode::OK);
    let owned_body = to_bytes(owned_tasks_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let owned_result: serde_json::Value = serde_json::from_slice(&owned_body).unwrap();
    assert!(!owned_result.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn test_task_ownership_authorization() {
    let app = setup_app().await;
    let project_id = Uuid::new_v4();

    // Create story and task as before
    let story_request = json!({
        "title": "Authorization Test Story",
        "description": "Test authorization for task ownership",
        "labels": ["auth-test"]
    });

    let story_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(story_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = story_result["story_id"].as_str().unwrap();

    let task_request = json!({
        "title": "Authorization Test Task",
        "acceptance_criteria_refs": ["AC1"]
    });

    let task_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let task_body = to_bytes(task_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let task_result: serde_json::Value = serde_json::from_slice(&task_body).unwrap();
    let task_id = task_result["task_id"].as_str().unwrap();

    // Test: Try to set estimate without owning the task (should fail)
    let estimate_request = json!({
        "estimated_hours": 16
    });

    let estimate_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri(format!("/tasks/{}/estimate", task_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(estimate_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should fail with Forbidden since user doesn't own the task
    assert_eq!(estimate_response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_task_ownership_state_transitions() {
    let app = setup_app().await;
    let project_id = Uuid::new_v4();

    // Create story and task
    let story_request = json!({
        "title": "State Transition Test",
        "description": "Test task state transitions",
        "labels": ["state-test"]
    });

    let story_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(story_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = story_result["story_id"].as_str().unwrap();

    let task_request = json!({
        "title": "State Test Task",
        "acceptance_criteria_refs": ["AC1"]
    });

    let task_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let task_body = to_bytes(task_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let task_result: serde_json::Value = serde_json::from_slice(&task_body).unwrap();
    let task_id = task_result["task_id"].as_str().unwrap();

    // Test ownership workflow: Available → Owned → InProgress → Completed

    // 1. Take ownership
    let take_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/tasks/{}/ownership", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(take_response.status(), StatusCode::OK);

    // 2. Start work (Owned → InProgress)
    let start_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/tasks/{}/work/start", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(start_response.status(), StatusCode::OK);

    // 3. Complete work (InProgress → Completed)
    let complete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/tasks/{}/work/complete", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(complete_response.status(), StatusCode::OK);

    // 4. Test that task is no longer available
    let available_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/stories/{}/tasks/available", story_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", "test-org")
                .header("x-user-id", "test-user")
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(available_response.status(), StatusCode::OK);
    let available_body = to_bytes(available_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let available_result: serde_json::Value = serde_json::from_slice(&available_body).unwrap();

    // Completed task should not be in available tasks
    let task_found = available_result
        .as_array()
        .unwrap()
        .iter()
        .any(|task| task["id"].as_str() == Some(task_id));
    assert!(!task_found, "Completed task should not be available");
}

// Property-based test helper for generating valid story data
use proptest::prelude::*;

fn arb_story_title() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9 ]{1,200}".prop_filter("Non-empty title", |s| !s.trim().is_empty())
}

fn arb_story_description() -> impl Strategy<Value = Option<String>> {
    prop::option::of("[a-zA-Z0-9 .,!?]{0,1000}")
}

fn arb_labels() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec("[a-z]{1,20}", 0..5)
}

proptest! {
    #[test]
    fn test_story_request_validation(
        title in arb_story_title(),
        description in arb_story_description(),
        labels in arb_labels()
    ) {
        // This is a property test that validates story request structure
        let story_data = json!({
            "title": title,
            "description": description,
            "labels": labels
        });

        // Basic validation: title should not be empty after trimming
        if title.trim().is_empty() {
            // Should be invalid
            prop_assert!(false, "Empty title should be invalid");
        } else {
            // Should be valid structure
            prop_assert!(story_data.is_object());
            prop_assert!(story_data.get("title").is_some());
        }
    }
}
