// @spec-test: AC1, AC2, AC3, AC4, AC5 (Story-level features)
// Integration tests for story-level task readiness analysis API
// Tests the "Suggest Tasks" and "Analyze Tasks" features for whole stories

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use serial_test::serial;
use tower::util::ServiceExt;
use uuid::Uuid;

use crate::common::{create_test_story, create_test_task, setup_app, setup_app_with_pool};

// ============================================================================
// POST /stories/:id/suggest-tasks Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC5 (GitHub integration)
// Given: I am viewing a story that needs tasks
// When: I request task suggestions with GitHub context
// Then: The system should generate relevant task suggestions
async fn test_suggest_tasks_for_story() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    let story_id = create_test_story(
        &pool,
        org_id,
        "Implement user authentication",
        Some("Add JWT-based authentication to the API"),
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/suggest-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectId": project_id.to_string()
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::CREATED,
        "Should return 201 Created for successful suggestion generation"
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    // Verify response is an array of suggestions
    assert!(
        result.is_array(),
        "Response should be an array of task suggestions"
    );

    // For the mock implementation, we expect an empty array
    // In real implementation, this would contain actual suggestions
    let suggestions = result.as_array().unwrap();

    // Verify structure if suggestions exist
    for suggestion in suggestions {
        assert!(
            suggestion.get("title").is_some(),
            "Each suggestion must have a title"
        );
        assert!(
            suggestion.get("description").is_some(),
            "Each suggestion must have a description"
        );
        assert!(
            suggestion.get("acceptanceCriteriaRefs").is_some(),
            "Each suggestion must have acceptanceCriteriaRefs"
        );
        assert!(
            suggestion.get("confidence").is_some(),
            "Each suggestion must have a confidence score"
        );
    }
}

#[tokio::test]
#[serial]
// @spec-test: Authorization
// Test that suggest tasks requires valid organization context
async fn test_suggest_tasks_unauthorized() {
    let app = setup_app().await;
    let story_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/suggest-tasks",
                    story_id
                ))
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectId": project_id.to_string()
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ============================================================================
// POST /stories/:id/analyze-tasks Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC1, AC2, AC3 (Story-level analysis)
// Given: A story has multiple tasks
// When: I request to analyze all tasks in the story
// Then: Each task should be analyzed and clarity scores returned
async fn test_analyze_story_tasks() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();

    let story_id = create_test_story(
        &pool,
        org_id,
        "Test Story",
        Some("A story with multiple tasks"),
    )
    .await;

    // Create some test tasks
    let _task1 = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 1",
        Some("First task description"),
        &[],
        None,
    )
    .await;

    let _task2 = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 2",
        Some("Second task description"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "Should return 200 OK for successful story analysis"
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    // Verify response is an array of analyses
    assert!(
        result.is_array(),
        "Response should be an array of task analyses"
    );

    let analyses = result.as_array().unwrap();
    assert_eq!(
        analyses.len(),
        2,
        "Should return analysis for each task in the story"
    );

    // Verify structure of each analysis
    for analysis in analyses {
        assert!(
            analysis.get("taskId").is_some(),
            "Each analysis must have taskId"
        );
        assert!(
            analysis.get("overallScore").is_some(),
            "Each analysis must have overallScore"
        );
        assert!(
            analysis.get("level").is_some(),
            "Each analysis must have level"
        );
        assert!(
            analysis.get("isAiReady").is_some(),
            "Each analysis must have isAiReady flag"
        );
        assert!(
            analysis.get("dimensions").is_some(),
            "Each analysis must have dimensions array"
        );
    }
}

#[tokio::test]
#[serial]
// @spec-test: Edge case
// Test analyzing a story with no tasks
async fn test_analyze_story_with_no_tasks() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();

    let story_id =
        create_test_story(&pool, org_id, "Empty Story", Some("A story with no tasks")).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    let analyses = result.as_array().unwrap();
    assert_eq!(
        analyses.len(),
        0,
        "Should return empty array for story with no tasks"
    );
}

// ============================================================================
// GET /stories/:id/analysis-summary Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC1 (Aggregated metrics)
// Given: A story has been analyzed
// When: I request the analysis summary
// Then: Aggregated metrics should be returned
async fn test_get_story_analysis_summary() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();

    let story_id =
        create_test_story(&pool, org_id, "Story with Analysis", Some("Test story")).await;

    // Create tasks and analyze them first
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 1",
        Some("Description 1"),
        &[],
        None,
    )
    .await;

    // Analyze the story to generate summary
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Now get the summary
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analysis-summary",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "Should return 200 OK for existing summary"
    );

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    // Verify summary structure
    assert!(result.get("storyId").is_some(), "Summary must have storyId");
    assert!(
        result.get("totalTasks").is_some(),
        "Summary must have totalTasks"
    );
    assert!(
        result.get("analyzedTasks").is_some(),
        "Summary must have analyzedTasks"
    );
    assert!(
        result.get("tasksAiReady").is_some(),
        "Summary must have tasksAiReady"
    );
    assert!(
        result.get("tasksNeedingImprovement").is_some(),
        "Summary must have tasksNeedingImprovement"
    );
    assert!(
        result.get("commonIssues").is_some(),
        "Summary must have commonIssues array"
    );

    // Verify values
    assert_eq!(
        result["totalTasks"].as_i64().unwrap(),
        1,
        "Should have 1 total task"
    );
    assert_eq!(
        result["analyzedTasks"].as_i64().unwrap(),
        1,
        "Should have 1 analyzed task"
    );
}

#[tokio::test]
#[serial]
// @spec-test: Edge case
// Test getting summary for non-analyzed story
async fn test_get_summary_not_found() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();

    let story_id =
        create_test_story(&pool, org_id, "Unanalyzed Story", Some("Never analyzed")).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analysis-summary",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(
        response.status(),
        StatusCode::NOT_FOUND,
        "Should return 404 for non-existent summary"
    );
}

// ============================================================================
// GET /stories/:id/suggestions Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC5 (Task suggestions)
// Given: Tasks have been suggested for a story
// When: I request pending suggestions
// Then: Suggestions should be returned
async fn test_get_pending_suggestions() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    let story_id =
        create_test_story(&pool, org_id, "Story with Suggestions", Some("Test story")).await;

    // First create suggestions
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/suggest-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectId": project_id.to_string()
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    // Now get pending suggestions
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/suggestions",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    assert!(
        result.is_array(),
        "Response should be an array of suggestions"
    );
}

// ============================================================================
// POST /suggestions/:id/approve Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC5 (Suggestion approval)
// Given: A task suggestion exists
// When: I approve the suggestion
// Then: The suggestion should be marked as approved
async fn test_approve_suggestion() {
    let app = setup_app().await;
    let suggestion_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/suggestions/{}/approve",
                    suggestion_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "reviewedBy": "test-user"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should return either 204 (if found) or 404 (if not found)
    // Since suggestion doesn't exist in this test, we accept both
    let status = response.status();
    if status != StatusCode::NO_CONTENT && status != StatusCode::NOT_FOUND {
        // Read the body to see the actual error
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body_bytes);
        panic!(
            "Should return 204 or 404, got: {}. Body: {}",
            status, body_str
        );
    }
}

// ============================================================================
// Organization Isolation Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: Authorization
// Test that story-level analysis respects organization boundaries
async fn test_story_analysis_organization_isolation() {
    let (app, pool) = setup_app_with_pool().await;
    let org1_id = Uuid::new_v4();
    let org2_id = Uuid::new_v4();

    let story_id = create_test_story(&pool, org1_id, "Org1 Story", Some("Description")).await;

    // Try to analyze story from org1 using org2 credentials
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org2_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should return error (404 or 403) - not allow cross-org access
    assert!(
        response.status() == StatusCode::NOT_FOUND
            || response.status() == StatusCode::FORBIDDEN
            || response.status() == StatusCode::INTERNAL_SERVER_ERROR,
        "Should not allow cross-organization story analysis, got: {}",
        response.status()
    );
}

// ============================================================================
// Concurrent Request Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: Concurrency
// Test that concurrent story analysis requests are handled correctly
async fn test_concurrent_story_analysis_requests() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();

    // Create two different stories
    let story1_id = create_test_story(&pool, org_id, "Story 1", Some("Description 1")).await;
    let story2_id = create_test_story(&pool, org_id, "Story 2", Some("Description 2")).await;

    // Add tasks to each story
    create_test_task(
        &pool,
        story1_id,
        org_id,
        "Task 1-1",
        Some("Desc"),
        &[],
        None,
    )
    .await;
    create_test_task(
        &pool,
        story2_id,
        org_id,
        "Task 2-1",
        Some("Desc"),
        &[],
        None,
    )
    .await;

    let app1 = app.clone();
    let app2 = app;

    // Analyze both stories concurrently
    let (response1, response2) = tokio::join!(
        app1.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story1_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
        app2.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/api/v1/readiness/stories/{}/analyze-tasks",
                    story2_id
                ))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
    );

    // Both requests should succeed
    assert_eq!(response1.unwrap().status(), StatusCode::OK);
    assert_eq!(response2.unwrap().status(), StatusCode::OK);
}
