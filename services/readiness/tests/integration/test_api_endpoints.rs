use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use serial_test::serial;
use tower::util::ServiceExt;
use uuid::Uuid;

// Import the common test setup
use crate::common::{create_test_criteria, create_test_story, setup_app, setup_app_with_pool};

#[tokio::test]
#[serial]
async fn test_evaluate_readiness_unauthorized() {
    let app = setup_app().await;
    let story_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/readiness/{}/evaluate", story_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[serial]
async fn test_generate_criteria_unauthorized() {
    let app = setup_app().await;
    let story_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}/generate", story_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[serial]
async fn test_add_criteria_unauthorized() {
    let app = setup_app().await;
    let story_id = Uuid::new_v4();

    let criteria_request = json!({
        "criteria": [
            {
                "ac_id": "AC1",
                "given": "I am a user",
                "when": "I do something",
                "then": "something should happen"
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}", story_id))
                .header("content-type", "application/json")
                .body(Body::from(criteria_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[serial]
async fn test_get_criteria_success() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;

    // Create test criteria
    create_test_criteria(
        &pool,
        story_id,
        org_id,
        "AC1",
        "I am viewing a task",
        "The analysis runs",
        "I should see results",
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(result.is_array());
    let criteria_array = result.as_array().unwrap();
    assert_eq!(criteria_array.len(), 1);
    assert_eq!(criteria_array[0]["ac_id"], "AC1");
}

#[tokio::test]
#[serial]
async fn test_add_criteria_success() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;

    let criteria_request = json!({
        "criteria": [
            {
                "ac_id": "AC1",
                "given": "I am a user",
                "when": "I perform an action",
                "then": "the result should be visible"
            },
            {
                "ac_id": "AC2",
                "given": "the system is running",
                "when": "I make a request",
                "then": "I should receive a response"
            }
        ]
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}", story_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(criteria_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(result.is_array());
    let criteria_array = result.as_array().unwrap();
    assert_eq!(criteria_array.len(), 2);

    // Verify criteria were persisted
    let get_response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(get_response.status(), StatusCode::OK);

    let get_body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let get_result: serde_json::Value = serde_json::from_slice(&get_body).unwrap();
    assert_eq!(get_result.as_array().unwrap().len(), 2);
}

#[tokio::test]
#[serial]
async fn test_generate_criteria_success() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Implement user authentication",
        Some("Users should be able to log in securely"),
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}/generate", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(result.is_array());
    let criteria_array = result.as_array().unwrap();
    assert!(!criteria_array.is_empty());

    // Verify structure of generated criteria
    for criterion in criteria_array {
        assert!(criterion.get("id").is_some());
        assert!(criterion.get("story_id").is_some());
        assert!(criterion.get("ac_id").is_some());
        assert!(criterion.get("given").is_some());
        assert!(criterion.get("when").is_some());
        assert!(criterion.get("then").is_some());
    }
}

#[tokio::test]
#[serial]
async fn test_evaluate_readiness_success() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Test Story for Evaluation",
        Some("A detailed story description"),
    )
    .await;

    // Add some acceptance criteria first
    create_test_criteria(
        &pool,
        story_id,
        org_id,
        "AC1",
        "I am a user",
        "I perform action X",
        "Result Y should occur",
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/readiness/{}/evaluate", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify response structure
    assert!(result.get("score").is_some());
    assert!(result.get("missingItems").is_some());
    assert!(result.get("recommendations").is_some());
    assert!(result.get("summary").is_some());
    assert!(result.get("isReady").is_some());

    // Verify score is within valid range
    let score = result["score"].as_i64().unwrap();
    assert!((0..=100).contains(&score));

    // Verify arrays
    assert!(result["missingItems"].is_array());
    assert!(result["recommendations"].is_array());

    // Verify boolean
    assert!(result["isReady"].is_boolean());
}

#[tokio::test]
#[serial]
async fn test_evaluate_readiness_story_not_found() {
    let app = setup_app().await;
    let org_id = Uuid::new_v4();
    let non_existent_story_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/readiness/{}/evaluate", non_existent_story_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // The service gracefully handles missing stories by returning a low readiness score
    // with a helpful message rather than an error
    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should have a low score and missing items indicating the story wasn't found
    assert!(result.get("score").is_some());
    let score = result["score"].as_i64().unwrap();
    assert!(score < 100, "Score should be reduced for missing story");

    let missing_items = result["missingItems"].as_array().unwrap();
    assert!(
        !missing_items.is_empty(),
        "Should have missing items for non-existent story"
    );
}

#[tokio::test]
#[serial]
async fn test_add_criteria_invalid_payload() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;

    // Missing required fields
    let invalid_request = json!({
        "criteria": [
            {
                "ac_id": "AC1",
                "given": "I am a user"
                // Missing "when" and "then"
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}", story_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(invalid_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert!(response.status().is_client_error());
}

#[tokio::test]
#[serial]
async fn test_malformed_json_request() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(&pool, org_id, "Test Story", Some("Test description")).await;

    let malformed_json = "{invalid json}";

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}", story_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(malformed_json))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial]
async fn test_invalid_uuid_in_path() {
    let app = setup_app().await;
    let org_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/criteria/invalid-uuid")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[serial]
async fn test_organization_isolation() {
    let (app, pool) = setup_app_with_pool().await;
    let org1_id = Uuid::new_v4();
    let org2_id = Uuid::new_v4();

    // Create story for org1
    let story_id = create_test_story(
        &pool,
        org1_id,
        "Org1 Story",
        Some("Story for organization 1"),
    )
    .await;

    // Add criteria for org1
    create_test_criteria(
        &pool,
        story_id,
        org1_id,
        "AC1",
        "I am in org1",
        "I do something",
        "Something happens",
    )
    .await;

    // Try to access with org2 credentials - should not see org1's criteria
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org2_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should either return empty array or error
    if response.status() == StatusCode::OK {
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
        // Should be empty because org2 shouldn't see org1's data
        assert_eq!(result.as_array().unwrap().len(), 0);
    } else {
        // Or could return an error
        assert!(response.status().is_client_error());
    }
}

#[tokio::test]
#[serial]
async fn test_missing_organization_header() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Test Story",
        Some("Story for testing missing header"),
    )
    .await;

    // Missing x-organization-id header - should succeed but return empty results
    // because the auth context defaults to personal/no-org
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-context-type", "personal")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Request succeeds but returns empty because story belongs to different org
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(result.is_array());
    assert_eq!(result.as_array().unwrap().len(), 0);
}

#[tokio::test]
#[serial]
async fn test_missing_context_type_header() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Test Story",
        Some("Story for testing missing context type"),
    )
    .await;

    // Missing x-context-type header - defaults to unknown context
    // Should succeed but return empty results
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Request succeeds - the missing context-type is handled gracefully
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[serial]
async fn test_evaluate_readiness_response_schema() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Schema Test Story",
        Some("Testing response schema"),
    )
    .await;

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

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/readiness/{}/evaluate", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify OpenAPI schema compliance
    assert!(result.is_object(), "Response should be an object");
    assert!(
        result.get("score").is_some(),
        "Response must have 'score' field"
    );
    assert!(result["score"].is_i64(), "'score' must be an integer");
    assert!(
        result.get("missingItems").is_some(),
        "Response must have 'missingItems' field"
    );
    assert!(
        result["missingItems"].is_array(),
        "'missingItems' must be an array"
    );
    assert!(
        result.get("recommendations").is_some(),
        "Response must have 'recommendations' field"
    );
    assert!(
        result["recommendations"].is_array(),
        "'recommendations' must be an array"
    );
    assert!(
        result.get("summary").is_some(),
        "Response must have 'summary' field"
    );
    assert!(result["summary"].is_string(), "'summary' must be a string");
    assert!(
        result.get("isReady").is_some(),
        "Response must have 'isReady' field"
    );
    assert!(
        result["isReady"].is_boolean(),
        "'isReady' must be a boolean"
    );

    // Verify score range
    let score = result["score"].as_i64().unwrap();
    assert!(
        (0..=100).contains(&score),
        "Score must be between 0 and 100"
    );
}

#[tokio::test]
#[serial]
async fn test_get_criteria_response_schema() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Criteria Schema Test",
        Some("Testing criteria schema"),
    )
    .await;

    create_test_criteria(
        &pool,
        story_id,
        org_id,
        "AC1",
        "Given context",
        "When action",
        "Then outcome",
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify OpenAPI schema compliance
    assert!(result.is_array(), "Response should be an array");
    let criteria_array = result.as_array().unwrap();
    assert_eq!(criteria_array.len(), 1);

    let criterion = &criteria_array[0];
    assert!(criterion.is_object(), "Each criterion should be an object");
    assert!(
        criterion.get("id").is_some(),
        "Criterion must have 'id' field"
    );
    assert!(
        criterion.get("story_id").is_some(),
        "Criterion must have 'story_id' field"
    );
    assert!(
        criterion.get("ac_id").is_some(),
        "Criterion must have 'ac_id' field"
    );
    assert!(criterion["ac_id"].is_string(), "'ac_id' must be a string");
    assert!(
        criterion.get("given").is_some(),
        "Criterion must have 'given' field"
    );
    assert!(criterion["given"].is_string(), "'given' must be a string");
    assert!(
        criterion.get("when").is_some(),
        "Criterion must have 'when' field"
    );
    assert!(criterion["when"].is_string(), "'when' must be a string");
    assert!(
        criterion.get("then").is_some(),
        "Criterion must have 'then' field"
    );
    assert!(criterion["then"].is_string(), "'then' must be a string");
}

#[tokio::test]
#[serial]
async fn test_add_criteria_response_schema() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Add Criteria Schema Test",
        Some("Testing add criteria schema"),
    )
    .await;

    let criteria_request = json!({
        "criteria": [
            {
                "ac_id": "AC1",
                "given": "I am a user",
                "when": "I perform action",
                "then": "Result occurs"
            }
        ]
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}", story_id))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(criteria_request.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify OpenAPI schema compliance
    assert!(result.is_array(), "Response should be an array");
    let criteria_array = result.as_array().unwrap();
    assert_eq!(criteria_array.len(), 1);

    let criterion = &criteria_array[0];
    assert!(criterion.is_object(), "Each criterion should be an object");
    assert!(
        criterion.get("id").is_some(),
        "Criterion must have 'id' field"
    );
    assert!(
        criterion.get("story_id").is_some(),
        "Criterion must have 'story_id' field"
    );
    assert!(
        criterion["story_id"].as_str().unwrap() == story_id.to_string(),
        "'story_id' must match the request"
    );
    assert_eq!(criterion["ac_id"], "AC1", "'ac_id' must match the request");
    assert_eq!(
        criterion["given"], "I am a user",
        "'given' must match the request"
    );
    assert_eq!(
        criterion["when"], "I perform action",
        "'when' must match the request"
    );
    assert_eq!(
        criterion["then"], "Result occurs",
        "'then' must match the request"
    );
}

#[tokio::test]
#[serial]
async fn test_generate_criteria_response_schema() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Generate Criteria Schema Test",
        Some("Testing generate criteria schema"),
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/criteria/{}/generate", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Verify OpenAPI schema compliance
    assert!(result.is_array(), "Response should be an array");
    let criteria_array = result.as_array().unwrap();
    assert!(
        !criteria_array.is_empty(),
        "Should generate at least one criterion"
    );

    for criterion in criteria_array {
        assert!(criterion.is_object(), "Each criterion should be an object");
        assert!(
            criterion.get("id").is_some(),
            "Criterion must have 'id' field"
        );
        assert!(
            criterion.get("story_id").is_some(),
            "Criterion must have 'story_id' field"
        );
        assert!(
            criterion["story_id"].as_str().unwrap() == story_id.to_string(),
            "'story_id' must match the request"
        );
        assert!(
            criterion.get("ac_id").is_some(),
            "Criterion must have 'ac_id' field"
        );
        assert!(criterion["ac_id"].is_string(), "'ac_id' must be a string");
        assert!(
            criterion.get("given").is_some(),
            "Criterion must have 'given' field"
        );
        assert!(criterion["given"].is_string(), "'given' must be a string");
        assert!(
            criterion.get("when").is_some(),
            "Criterion must have 'when' field"
        );
        assert!(criterion["when"].is_string(), "'when' must be a string");
        assert!(
            criterion.get("then").is_some(),
            "Criterion must have 'then' field"
        );
        assert!(criterion["then"].is_string(), "'then' must be a string");
    }
}

#[tokio::test]
#[serial]
async fn test_empty_criteria_list() {
    let (app, pool) = setup_app_with_pool().await;
    let org_id = Uuid::new_v4();
    let story_id = create_test_story(
        &pool,
        org_id,
        "Empty Criteria Test",
        Some("Story with no criteria"),
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!("/criteria/{}", story_id))
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
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(result.is_array());
    assert_eq!(result.as_array().unwrap().len(), 0);
}
