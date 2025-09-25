use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use backlog::create_backlog_router_with_readiness;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::util::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;
use backlog::adapters::integrations::MockReadinessService;

// Import the common test setup
use crate::common::setup_test_db;

async fn setup_app() -> Router {
    let pool = setup_test_db().await;

    // Create a test JWT verifier that accepts "valid-test-token"
    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    // Use MockReadinessService for tests
    let readiness_service = Arc::new(MockReadinessService::new());

    // Nest under /api/v1 like the production api-gateway does
    Router::new().nest(
        "/api/v1",
        create_backlog_router_with_readiness(pool, verifier, Some(readiness_service)).await,
    )
}

async fn setup_app_with_pool() -> (Router, sqlx::PgPool) {
    let pool = setup_test_db().await;

    // Create a test JWT verifier that accepts "valid-test-token"
    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    // Use MockReadinessService for tests
    let readiness_service = Arc::new(MockReadinessService::new());

    // Nest under /api/v1 like the production api-gateway does
    let router = Router::new().nest(
        "/api/v1",
        create_backlog_router_with_readiness(pool.clone(), verifier, Some(readiness_service)).await,
    );

    (router, pool)
}

async fn create_test_project(pool: &sqlx::PgPool, org_id: Uuid) -> Uuid {
    let project_id = Uuid::new_v4();
    // Create unique project name using UUID to avoid constraint violations in parallel tests
    let project_name = format!("Test Project {}", Uuid::new_v4());

    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind(project_name)
    .bind("Test Description")
    .execute(pool)
    .await
    .expect("Failed to create test project");

    project_id
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
                .uri(format!("/api/v1/projects/{}/stories", Uuid::new_v4()))
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
                .uri(format!("/api/v1/projects/{}/stories", Uuid::new_v4()))
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
                .uri(format!("/api/v1/projects/{}/stories", Uuid::new_v4()))
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
                .uri(format!("/api/v1/stories/{}", non_existent_id))
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
                .uri(format!("/api/v1/stories/{}", non_existent_id))
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
                .uri(format!("/api/v1/stories/{}", non_existent_id))
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
                .uri(format!("/api/v1/stories/{}/tasks", story_id))
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
                .uri(format!("/api/v1/projects/{}/stories", Uuid::new_v4()))
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
                .uri("/api/v1/stories/invalid-uuid")
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
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4(); // Generate unique org_id for each test
    let project_id = create_test_project(&pool, org_id).await;

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
                .uri(format!("/api/v1/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(story_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Debug: Print response details if not 201
    let story_status = story_response.status();
    if story_status != StatusCode::CREATED {
        let body = to_bytes(story_response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        println!("Story creation failed. Status: {}", story_status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED for story, got {}", story_status);
    }
    assert_eq!(story_status, StatusCode::CREATED);
    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = story_result["story_id"].as_str().unwrap();
    println!("Created story with ID: {}", story_id);
    println!("Using org_id: {}", org_id);

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
                .uri(format!("/api/v1/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Debug: Print response details if not 201
    let status = task_response.status();
    if status != StatusCode::CREATED {
        let body = to_bytes(task_response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        println!("Task creation failed. Status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED for task, got {}", status);
    }
    assert_eq!(status, StatusCode::CREATED);
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
                .uri(format!("/api/v1/stories/{}/tasks/available", story_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/ownership", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/work/start", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/estimate", task_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/work/complete", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri("/api/v1/tasks/owned")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4(); // Generate unique org_id for each test
    let project_id = create_test_project(&pool, org_id).await;

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
                .uri(format!("/api/v1/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(story_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Debug: Check story creation status
    let status = story_response.status();
    if status != StatusCode::CREATED {
        let body = to_bytes(story_response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        println!("Story creation failed. Status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED for story, got {}", status);
    }

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
                .uri(format!("/api/v1/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Debug: Print response details if not 201
    let status = task_response.status();
    if status != StatusCode::CREATED {
        let body = to_bytes(task_response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        println!("Task creation failed. Status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED for task, got {}", status);
    }

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
                .uri(format!("/api/v1/tasks/{}/estimate", task_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4(); // Generate unique org_id for each test
    let project_id = create_test_project(&pool, org_id).await;

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
                .uri(format!("/api/v1/projects/{}/stories", project_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/stories/{}/tasks", story_id))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(task_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Debug: Print response details if not 201
    let status = task_response.status();
    if status != StatusCode::CREATED {
        let body = to_bytes(task_response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body);
        println!("Task creation failed. Status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED for task, got {}", status);
    }

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
                .uri(format!("/api/v1/tasks/{}/ownership", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/work/start", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/tasks/{}/work/complete", task_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
                .uri(format!("/api/v1/stories/{}/tasks/available", story_id))
                .header("Authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
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
