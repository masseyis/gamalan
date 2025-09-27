use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use serde_json::{json, Value};
use serial_test::serial;
use sqlx::PgPool;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;
use backlog::adapters::http::routes::create_backlog_router_with_readiness;
use backlog::adapters::integrations::MockReadinessService;
use tokio::sync::Mutex;

// Import the common test setup
use crate::common::setup_test_db;

async fn setup_test_app(pool: PgPool) -> axum::Router {
    // Create a mock JWT verifier for testing
    let verifier = Arc::new(Mutex::new(JwtVerifier::new_test_verifier()));

    // Use MockReadinessService for tests
    let readiness_service = Arc::new(MockReadinessService::new());

    axum::Router::new().nest(
        "/api/v1",
        create_backlog_router_with_readiness(pool, verifier, Some(readiness_service)).await,
    )
}

async fn create_test_project_and_story(pool: &PgPool) -> (Uuid, Uuid) {
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    // Insert test project
    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind("Test Project")
    .bind("Test Description")
    .execute(pool)
    .await
    .expect("Failed to create test project");

    // Create a story
    let story_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO stories (id, project_id, organization_id, title, description, status, labels, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        "#
    )
    .bind(story_id)
    .bind(project_id)
    .bind(org_id)
    .bind("Test Story")
    .bind(Some("Test Description"))
    .bind("draft")
    .bind(vec!["feature"])
    .execute(pool)
    .await
    .expect("Failed to create test story");

    (project_id, story_id)
}

#[tokio::test]
#[serial]
async fn test_story_lifecycle_integration() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = setup_test_app(pool.clone()).await;
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    // Insert test project first
    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind("Test Project")
    .bind("Test Description")
    .execute(&pool)
    .await?;

    // 1. Create a story
    let create_request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/v1/projects/{}/stories", project_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "title": "New Feature Story",
                "description": "Implement user authentication"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(create_request).await?;

    // Debug: Print response details if not 201
    let status = response.status();
    if status != StatusCode::CREATED {
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
        let body_str = String::from_utf8_lossy(&body);
        println!("Response status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected 201 CREATED, got {}", status);
    }

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let create_response: Value = serde_json::from_slice(&body)?;
    let story_id = create_response["story_id"].as_str().unwrap();
    let _story_uuid = Uuid::parse_str(story_id)?;

    // 2. Get the story and verify it was created correctly
    let get_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(get_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let story: Value = serde_json::from_slice(&body)?;

    assert_eq!(story["title"], "New Feature Story");
    assert_eq!(story["description"], "Implement user authentication");
    assert_eq!(story["status"], "draft");

    // 3. Update story status to NeedsRefinement
    let update_status_request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/v1/stories/{}/status", story_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "status": "needs_refinement"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(update_status_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    // 4. Update the story content
    let update_request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "title": "Enhanced Authentication Feature",
                "description": "Implement OAuth2 user authentication with JWT tokens",
                "labels": ["feature", "authentication", "security"]
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(update_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    // 5. Verify the story was updated
    let get_updated_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(get_updated_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let updated_story: Value = serde_json::from_slice(&body)?;

    assert_eq!(updated_story["title"], "Enhanced Authentication Feature");
    assert_eq!(
        updated_story["description"],
        "Implement OAuth2 user authentication with JWT tokens"
    );
    assert_eq!(updated_story["status"], "needsrefinement");
    assert_eq!(
        updated_story["labels"],
        json!(["feature", "authentication", "security"])
    );

    // 6. Get stories by project
    let get_project_stories_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/projects/{}/stories", project_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(get_project_stories_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let stories: Value = serde_json::from_slice(&body)?;

    assert_eq!(stories.as_array().unwrap().len(), 1);
    assert_eq!(stories[0]["id"], story_id);

    // 7. Delete the story
    let delete_request = Request::builder()
        .method(Method::DELETE)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(delete_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    // 8. Verify story is deleted
    let get_deleted_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(get_deleted_request).await?;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    Ok(())
}

#[tokio::test]
#[serial]
async fn test_story_validation_rules() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = setup_test_app(pool.clone()).await;
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    // Insert test project
    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind("Test Project")
    .bind("Test Description")
    .execute(&pool)
    .await?;

    // Test 1: Empty title should fail
    let empty_title_request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/v1/projects/{}/stories", project_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "title": "",
                "description": "Some description"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(empty_title_request).await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Test 2: Title too long should fail
    let long_title = "a".repeat(256);
    let long_title_request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/v1/projects/{}/stories", project_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "title": long_title,
                "description": "Some description"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(long_title_request).await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Test 3: Invalid status update should fail
    let (_, story_id) = create_test_project_and_story(&pool).await;

    let invalid_status_request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/v1/stories/{}/status", story_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::from(
            json!({
                "status": "invalid_status"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(invalid_status_request).await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    Ok(())
}

#[tokio::test]
#[serial]
async fn test_story_authorization() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = setup_test_app(pool.clone()).await;
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let other_org_id = Uuid::new_v4();

    // Insert test project in one org
    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind("Test Project")
    .bind("Test Description")
    .execute(&pool)
    .await?;

    // Create a story
    let create_request = Request::builder()
        .method(Method::POST)
        .uri(format!("/api/v1/projects/{}/stories", project_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::from(
            json!({
                "title": "Test Story",
                "description": "Test Description"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(create_request).await?;
    assert_eq!(response.status(), StatusCode::CREATED);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let create_response: Value = serde_json::from_slice(&body)?;
    let story_id = create_response["story_id"].as_str().unwrap();

    // Try to access the story from a different organization - should fail
    let unauthorized_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", other_org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::empty())?;

    let response = app.clone().oneshot(unauthorized_request).await?;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // Try to update the story from a different organization - should fail
    let unauthorized_update_request = Request::builder()
        .method(Method::PATCH)
        .uri(format!("/api/v1/stories/{}", story_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", other_org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::from(
            json!({
                "title": "Hacked Story"
            })
            .to_string(),
        ))?;

    let response = app.clone().oneshot(unauthorized_update_request).await?;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    Ok(())
}
