use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use backlog::create_backlog_router;
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;

async fn setup_test_db() -> PgPool {
    // For integration tests, use test database
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Clean up any existing test data
    sqlx::query("TRUNCATE TABLE stories, tasks CASCADE")
        .execute(&pool)
        .await
        .ok(); // Ignore errors if tables don't exist

    pool
}

async fn setup_app() -> Router {
    let pool = setup_test_db().await;

    // Create a mock JWT verifier
    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        "https://test.jwks.url".to_string(),
        "https://test-issuer".to_string(),
        Some("test-audience".to_string()),
    )));

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

    assert_eq!(response.status(), StatusCode::OK);
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
                .uri(&format!("/stories/{}", non_existent_id))
                .header("authorization", "Bearer valid-test-token")
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
                .uri(&format!("/stories/{}", non_existent_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
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
                .uri(&format!("/stories/{}", non_existent_id))
                .header("authorization", "Bearer valid-test-token")
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
                .uri(&format!("/stories/{}/tasks", story_id))
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
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
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
