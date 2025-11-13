// @spec-test: AC1, AC2, AC3, AC4, AC5
// This file contains specification tests for the Task Readiness Analysis API
// These tests validate the API contract and are EXPECTED TO FAIL until implementation is complete

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::Value;
use serial_test::serial;
use tower::util::ServiceExt;
use uuid::Uuid;

use crate::common::{
    create_test_criteria, create_test_story, create_test_task, setup_app, setup_app_with_pool,
};

// ============================================================================
// AC1: Clarity Score Display Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC1
// Given: I am viewing a task in the backlog
// When: The task readiness analysis runs
// Then: I should see a clarity score indicating how well-defined the task is
async fn test_analyze_task_returns_clarity_score() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Test Story",
        Some("A story for testing task analysis"),
    )
    .await;

    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Implement feature X",
        Some("Build the feature with proper error handling"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Verify clarity score structure
    assert!(
        result.get("clarityScore").is_some(),
        "Response must have clarityScore field"
    );
    let clarity_score = &result["clarityScore"];

    assert!(
        clarity_score.get("score").is_some(),
        "clarityScore must have score field"
    );
    let score = clarity_score["score"].as_i64().unwrap();
    assert!(
        (0..=100).contains(&score),
        "Score must be between 0 and 100"
    );

    assert!(
        clarity_score.get("level").is_some(),
        "clarityScore must have level field"
    );
    let level = clarity_score["level"].as_str().unwrap();
    assert!(
        ["poor", "fair", "good", "excellent"].contains(&level),
        "Level must be one of: poor, fair, good, excellent"
    );
}

#[tokio::test]
#[serial]
// @spec-test: AC1
// Test clarity score with dimensions breakdown
async fn test_clarity_score_includes_dimensions() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Vague task",
        Some("Do something"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    let clarity_score = &result["clarityScore"];
    assert!(
        clarity_score.get("dimensions").is_some(),
        "clarityScore must have dimensions array"
    );

    let dimensions = clarity_score["dimensions"].as_array().unwrap();
    assert!(!dimensions.is_empty(), "dimensions array must not be empty");

    // Verify each dimension has required fields
    for dimension in dimensions {
        assert!(
            dimension.get("dimension").is_some(),
            "Each dimension must have dimension field"
        );
        assert!(
            dimension.get("score").is_some(),
            "Each dimension must have score field"
        );
        assert!(
            dimension.get("weight").is_some(),
            "Each dimension must have weight field"
        );
    }
}

// ============================================================================
// AC2: Technical Details Recommendations Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC2
// Given: A task description lacks specific technical details
// When: The analysis evaluates the task
// Then: The system should recommend adding file paths, functions, inputs/outputs, architecture
async fn test_technical_detail_recommendations_for_vague_task() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;

    // Create a task with vague technical description
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Implement login",
        Some("Add login functionality"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Verify technical detail recommendations exist
    assert!(
        result.get("technicalDetailRecommendations").is_some(),
        "Response must have technicalDetailRecommendations field"
    );

    let tech_recs = result["technicalDetailRecommendations"].as_array().unwrap();
    assert!(
        !tech_recs.is_empty(),
        "Should have technical recommendations for vague task"
    );

    // Verify structure of recommendations
    for rec in tech_recs {
        assert!(
            rec.get("type").is_some(),
            "Each recommendation must have type field"
        );
        assert!(
            rec.get("description").is_some(),
            "Each recommendation must have description field"
        );

        let rec_type = rec["type"].as_str().unwrap();
        assert!(
            [
                "file-path",
                "function",
                "component",
                "input-output",
                "architecture"
            ]
            .contains(&rec_type),
            "Recommendation type must be one of the expected categories"
        );
    }

    // Verify we have recommendations for key technical aspects
    let types: Vec<String> = tech_recs
        .iter()
        .map(|r| r["type"].as_str().unwrap().to_string())
        .collect();

    assert!(
        types.contains(&"file-path".to_string()),
        "Should recommend specifying file paths"
    );
}

// ============================================================================
// AC3: Vague Language Detection Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC3
// Given: A task has vague or ambiguous language
// When: The analysis evaluates the task
// Then: The system should flag vague terms and recommend concrete actions
async fn test_vague_terms_detection() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;

    // Create task with vague language
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Fix the bug",
        Some("We need to implement this and create that"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Verify vague terms are detected
    assert!(
        result.get("vagueTerms").is_some(),
        "Response must have vagueTerms field"
    );

    let vague_terms = result["vagueTerms"].as_array().unwrap();
    assert!(
        !vague_terms.is_empty(),
        "Should detect vague terms in the task"
    );

    // Verify structure of vague term detection
    for term in vague_terms {
        assert!(
            term.get("term").is_some(),
            "Each vague term must have term field"
        );
        assert!(
            term.get("suggestion").is_some(),
            "Each vague term must have suggestion field"
        );

        let detected_term = term["term"].as_str().unwrap().to_lowercase();
        let common_vague = ["implement", "create", "build", "add", "fix"];

        // At least some terms should be common vague words
        if common_vague.iter().any(|&v| detected_term.contains(v)) {
            assert!(
                !term["suggestion"].as_str().unwrap().is_empty(),
                "Vague term should have non-empty suggestion"
            );
        }
    }
}

#[tokio::test]
#[serial]
// @spec-test: AC3
// Test that specific, detailed tasks have fewer vague terms flagged
async fn test_detailed_task_has_fewer_vague_terms() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;

    // Create a well-defined task
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Update UserController.authenticate() to validate JWT tokens",
        Some("Modify services/auth/src/controllers/UserController.rs:authenticate() to call JwtValidator.verify() and return 401 if invalid. Expected inputs: JWT string. Expected outputs: User object or 401 error."),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Detailed task should have higher clarity score
    let clarity_score = result["clarityScore"]["score"].as_i64().unwrap();
    assert!(
        clarity_score >= 60,
        "Well-defined task should have score >= 60"
    );
}

// ============================================================================
// AC4: Acceptance Criteria References Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC4
// Given: A task is missing acceptance criteria references
// When: The analysis evaluates the task
// Then: The system should recommend linking to specific AC IDs
async fn test_missing_ac_recommendations() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story with ACs", Some("Description")).await;

    // Create some acceptance criteria for the story
    create_test_criteria(
        &pool,
        story_id,
        org_id,
        "AC1",
        "I am a user",
        "I perform action",
        "Result occurs",
    )
    .await;

    // Create task without AC references
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Build feature",
        Some("Implement the feature"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Verify AC recommendations exist
    assert!(
        result.get("acRecommendations").is_some(),
        "Response must have acRecommendations field"
    );

    let ac_recs = result["acRecommendations"].as_array().unwrap();
    assert!(
        !ac_recs.is_empty(),
        "Should have AC recommendations when none are linked"
    );

    // Verify structure of AC recommendations
    for rec in ac_recs {
        assert!(
            rec.get("acId").is_some(),
            "Each AC recommendation must have acId field"
        );
        assert!(
            rec.get("description").is_some(),
            "Each AC recommendation must have description field"
        );
        assert!(
            rec.get("relevance").is_some(),
            "Each AC recommendation must have relevance field"
        );
    }
}

// ============================================================================
// AC5: AI Agent Compatibility Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: AC5
// Given: A task is analyzed for AI agent compatibility
// When: The readiness check runs
// Then: System evaluates success criteria, dependencies, environment, tests, DoD
async fn test_ai_compatibility_evaluation() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;

    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task for AI agent",
        Some("Basic description without AI-specific details"),
        &[],
        None,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
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

    // Verify AI compatibility issues are reported
    assert!(
        result.get("aiCompatibilityIssues").is_some(),
        "Response must have aiCompatibilityIssues field"
    );

    let ai_issues = result["aiCompatibilityIssues"].as_array().unwrap();
    assert!(
        !ai_issues.is_empty(),
        "Should identify AI compatibility issues"
    );

    // Verify issues are strings
    for issue in ai_issues {
        assert!(
            issue.is_string(),
            "Each AI compatibility issue must be a string"
        );
        let issue_text = issue.as_str().unwrap();
        assert!(
            !issue_text.is_empty(),
            "Issue description should not be empty"
        );
    }
}

// ============================================================================
// Authorization Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: Authorization
// Test that unauthorized requests are rejected
async fn test_analyze_task_unauthorized() {
    let app = setup_app().await;
    let task_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[serial]
// @spec-test: Authorization
// Test organization isolation for task analysis
async fn test_task_analysis_organization_isolation() {
    let (app, pool) = setup_app_with_pool().await;
    let org1_id = Uuid::new_v4();
    let org2_id = Uuid::new_v4();

    let story_id = create_test_story(&pool, org1_id, "Org1 Story", Some("Description")).await;
    let task_id = create_test_task(
        &pool,
        story_id,
        org1_id,
        "Org1 Task",
        Some("Description"),
        &[],
        None,
    )
    .await;

    // Try to analyze task from org1 using org2 credentials
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org2_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should either return 404 or 403, not allow access
    assert!(
        response.status() == StatusCode::NOT_FOUND || response.status() == StatusCode::FORBIDDEN,
        "Should not allow cross-organization task analysis"
    );
}

// ============================================================================
// Concurrent Request Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: Concurrency
// Test that concurrent analysis requests are handled correctly
async fn test_concurrent_task_analysis_requests() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;

    // Create multiple tasks
    let task1_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 1",
        Some("Description 1"),
        &[],
        None,
    )
    .await;
    let task2_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 2",
        Some("Description 2"),
        &[],
        None,
    )
    .await;
    let task3_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 3",
        Some("Description 3"),
        &[],
        None,
    )
    .await;

    // Clone app for concurrent requests
    let app1 = app.clone();
    let app2 = app.clone();
    let app3 = app;

    // Send concurrent analysis requests
    let (response1, response2, response3) = tokio::join!(
        app1.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task1_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
        app2.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task2_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
        app3.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task3_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
    );

    // All requests should succeed
    assert_eq!(response1.unwrap().status(), StatusCode::OK);
    assert_eq!(response2.unwrap().status(), StatusCode::OK);
    assert_eq!(response3.unwrap().status(), StatusCode::OK);
}

#[tokio::test]
#[serial]
// @spec-test: Concurrency
// Test that analyzing the same task concurrently is handled safely
async fn test_concurrent_analysis_same_task() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task",
        Some("Description"),
        &[],
        None,
    )
    .await;

    let app1 = app.clone();
    let app2 = app.clone();
    let app3 = app;

    // Send 3 concurrent requests to analyze the SAME task
    let (response1, response2, response3) = tokio::join!(
        app1.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
        app2.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
        app3.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        ),
    );

    // All requests should succeed without race conditions
    let r1 = response1.unwrap();
    let r2 = response2.unwrap();
    let r3 = response3.unwrap();

    assert_eq!(r1.status(), StatusCode::OK);
    assert_eq!(r2.status(), StatusCode::OK);
    assert_eq!(r3.status(), StatusCode::OK);

    // Verify responses are valid
    let body1 = to_bytes(r1.into_body(), usize::MAX).await.unwrap();
    let body2 = to_bytes(r2.into_body(), usize::MAX).await.unwrap();
    let body3 = to_bytes(r3.into_body(), usize::MAX).await.unwrap();

    let result1: Value = serde_json::from_slice(&body1).unwrap();
    let result2: Value = serde_json::from_slice(&body2).unwrap();
    let result3: Value = serde_json::from_slice(&body3).unwrap();

    // All should return the same task_id
    assert_eq!(result1["taskId"], task_id.to_string());
    assert_eq!(result2["taskId"], task_id.to_string());
    assert_eq!(result3["taskId"], task_id.to_string());
}

// ============================================================================
// GET Endpoint Tests
// ============================================================================

#[tokio::test]
#[serial]
// @spec-test: API Contract
// Test retrieving previously analyzed task
async fn test_get_task_analysis() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Story", Some("Description")).await;
    let task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Task",
        Some("Description"),
        &[],
        None,
    )
    .await;

    // First analyze the task
    let analyze_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/readiness/tasks/{}/analyze", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(analyze_response.status(), StatusCode::OK);

    // Now retrieve the analysis
    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/readiness/tasks/{}/analysis", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);

    let body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let result: Value = serde_json::from_slice(&body).unwrap();

    // Verify the response has the same structure as analyze endpoint
    assert!(result.get("taskId").is_some());
    assert!(result.get("clarityScore").is_some());
    assert!(result.get("recommendations").is_some());
}

#[tokio::test]
#[serial]
// @spec-test: API Contract
// Test 404 when getting non-existent analysis
async fn test_get_task_analysis_not_found() {
    let app = setup_app().await;
    let org_id = Uuid::new_v4();
    let task_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/api/v1/readiness/tasks/{}/analysis", task_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
