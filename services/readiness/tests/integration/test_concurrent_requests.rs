use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::json;
use serial_test::serial;
use std::sync::Arc;
use tokio::task::JoinSet;
use tower::util::ServiceExt;
use uuid::Uuid;

use crate::common::{create_test_story, setup_app_with_pool};

#[tokio::test]
#[serial]
async fn test_concurrent_criteria_additions() {
    let (app, pool) = setup_app_with_pool().await;
    let app = Arc::new(app);
    let org_id = Uuid::new_v4();

    let story_id = create_test_story(
        &pool,
        org_id,
        "Concurrent Test Story",
        Some("Testing concurrent operations"),
    )
    .await;

    let mut join_set = JoinSet::new();

    // Spawn 10 concurrent requests to add criteria
    for i in 0..10 {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let criteria_request = json!({
                "criteria": [
                    {
                        "ac_id": format!("AC{}", i),
                        "given": format!("Given condition {}", i),
                        "when": format!("When action {}", i),
                        "then": format!("Then result {}", i)
                    }
                ]
            });

            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/criteria/{}", story_id_clone))
                        .header("content-type", "application/json")
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::from(criteria_request.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();

            response.status()
        });
    }

    // Collect all results
    let mut success_count = 0;
    while let Some(result) = join_set.join_next().await {
        let status = result.unwrap();
        if status == StatusCode::CREATED {
            success_count += 1;
        }
    }

    // All concurrent requests should succeed
    assert_eq!(success_count, 10);

    // Verify all criteria were persisted
    let get_response = app
        .as_ref()
        .clone()
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

    let body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let criteria_array = result.as_array().unwrap();

    // Should have 10 criteria (one from each concurrent request)
    assert_eq!(criteria_array.len(), 10);
}

#[tokio::test]
#[serial]
async fn test_concurrent_readiness_evaluations() {
    let (app, pool) = setup_app_with_pool().await;
    let app = Arc::new(app);
    let org_id = Uuid::new_v4();

    // Create multiple stories
    let mut story_ids = Vec::new();
    for i in 0..5 {
        let story_id = create_test_story(
            &pool,
            org_id,
            &format!("Story {}", i),
            Some(&format!("Description for story {}", i)),
        )
        .await;
        story_ids.push(story_id);
    }

    let mut join_set = JoinSet::new();

    // Concurrently evaluate all stories
    for story_id in story_ids.clone() {
        let app_clone = app.clone();
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/readiness/{}/evaluate", story_id))
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            (story_id, response.status())
        });
    }

    // Collect results
    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        results.push(result.unwrap());
    }

    // All evaluations should succeed
    assert_eq!(results.len(), 5);
    for (story_id, status) in results {
        assert_eq!(
            status,
            StatusCode::OK,
            "Story {} evaluation failed",
            story_id
        );
    }
}

#[tokio::test]
#[serial]
async fn test_concurrent_criteria_generation() {
    let (app, pool) = setup_app_with_pool().await;
    let app = Arc::new(app);
    let org_id = Uuid::new_v4();

    // Create multiple stories
    let mut story_ids = Vec::new();
    for i in 0..3 {
        let story_id = create_test_story(
            &pool,
            org_id,
            &format!("Generate Criteria Story {}", i),
            Some(&format!("Generate acceptance criteria for story {}", i)),
        )
        .await;
        story_ids.push(story_id);
    }

    let mut join_set = JoinSet::new();

    // Concurrently generate criteria for all stories
    for story_id in story_ids.clone() {
        let app_clone = app.clone();
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/criteria/{}/generate", story_id))
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            (story_id, response.status())
        });
    }

    // Collect results
    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        results.push(result.unwrap());
    }

    // All generations should succeed
    assert_eq!(results.len(), 3);
    for (story_id, status) in results {
        assert_eq!(
            status,
            StatusCode::OK,
            "Story {} criteria generation failed",
            story_id
        );
    }
}

#[tokio::test]
#[serial]
async fn test_concurrent_mixed_operations() {
    let (app, pool) = setup_app_with_pool().await;
    let app = Arc::new(app);
    let org_id = Uuid::new_v4();

    let story_id = create_test_story(
        &pool,
        org_id,
        "Mixed Operations Story",
        Some("Testing concurrent mixed operations"),
    )
    .await;

    let mut join_set = JoinSet::new();

    // Spawn concurrent GET requests
    for _ in 0..5 {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("GET")
                        .uri(format!("/criteria/{}", story_id_clone))
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            ("GET", response.status())
        });
    }

    // Spawn concurrent POST requests (add criteria)
    for i in 0..5 {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let criteria_request = json!({
                "criteria": [
                    {
                        "ac_id": format!("MIXED_AC{}", i),
                        "given": format!("Mixed given {}", i),
                        "when": format!("Mixed when {}", i),
                        "then": format!("Mixed then {}", i)
                    }
                ]
            });

            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/criteria/{}", story_id_clone))
                        .header("content-type", "application/json")
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::from(criteria_request.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();

            ("POST", response.status())
        });
    }

    // Spawn concurrent evaluate requests
    for _ in 0..3 {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/readiness/{}/evaluate", story_id_clone))
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            ("EVALUATE", response.status())
        });
    }

    // Collect all results
    let mut get_success = 0;
    let mut post_success = 0;
    let mut evaluate_success = 0;

    while let Some(result) = join_set.join_next().await {
        let (operation, status) = result.unwrap();
        match operation {
            "GET" => {
                if status == StatusCode::OK {
                    get_success += 1;
                }
            }
            "POST" => {
                if status == StatusCode::CREATED {
                    post_success += 1;
                }
            }
            "EVALUATE" => {
                if status == StatusCode::OK {
                    evaluate_success += 1;
                }
            }
            _ => {}
        }
    }

    // All operations should succeed
    assert_eq!(get_success, 5, "GET requests should all succeed");
    assert_eq!(post_success, 5, "POST requests should all succeed");
    assert_eq!(evaluate_success, 3, "EVALUATE requests should all succeed");
}

#[tokio::test]
#[serial]
async fn test_race_condition_duplicate_criteria() {
    let (app, pool) = setup_app_with_pool().await;
    let app = Arc::new(app);
    let org_id = Uuid::new_v4();

    let story_id = create_test_story(
        &pool,
        org_id,
        "Race Condition Test",
        Some("Testing for race conditions"),
    )
    .await;

    let mut join_set = JoinSet::new();

    // Try to add the same criteria concurrently (with same ac_id)
    for _ in 0..5 {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let criteria_request = json!({
                "criteria": [
                    {
                        "ac_id": "DUPLICATE_AC",
                        "given": "Same criteria",
                        "when": "Added concurrently",
                        "then": "Should handle gracefully"
                    }
                ]
            });

            let response = (*app_clone)
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/criteria/{}", story_id_clone))
                        .header("content-type", "application/json")
                        .header("authorization", "Bearer valid-test-token")
                        .header("x-organization-id", org_id_clone.to_string())
                        .header("x-context-type", "organization")
                        .body(Body::from(criteria_request.to_string()))
                        .unwrap(),
                )
                .await
                .unwrap();

            response.status()
        });
    }

    // Collect results
    let mut success_count = 0;
    while let Some(result) = join_set.join_next().await {
        let status = result.unwrap();
        // All should succeed (database should handle duplicates)
        if status == StatusCode::CREATED {
            success_count += 1;
        }
    }

    // At least some requests should succeed
    assert!(success_count > 0, "At least one request should succeed");

    // Verify the final state - may have duplicates or may have unique constraint
    let get_response = app
        .as_ref()
        .clone()
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
}
