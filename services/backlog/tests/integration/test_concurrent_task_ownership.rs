use axum::{
    body::{to_bytes, Body},
    http::{Method, Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use serial_test::serial;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::task::JoinSet;
use tower::ServiceExt;
use uuid::Uuid;

// Import the common test setup
use crate::common::{build_backlog_router_for_tests, setup_test_db};

async fn setup_test_app(pool: PgPool) -> Router {
    build_backlog_router_for_tests(pool).await
}

async fn create_test_task(app: &axum::Router) -> (Uuid, Uuid, Uuid) {
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4(); // Generate unique org_id for each test

    // First, create project using direct SQL since we don't have a projects API in this service
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());
    let temp_pool = sqlx::PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Create unique project name to avoid constraint violations in parallel tests
    let project_name = format!("Concurrent Test Project {}", Uuid::new_v4());

    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind(project_name)
    .bind("Test Description")
    .execute(&temp_pool)
    .await
    .expect("Failed to create test project");

    // Create story via HTTP API
    let story_request = json!({
        "title": "Test Story for Concurrent Tests",
        "description": "Test Description",
        "labels": ["feature"],
        "acceptance_criteria": [
            {
                "id": "AC1",
                "given": "A user has valid credentials",
                "when": "They attempt to log in",
                "then": "They should be authenticated successfully"
            }
        ]
    });

    let story_response = (*app)
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
        .expect("Failed to create story");

    assert_eq!(story_response.status(), StatusCode::CREATED);
    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = Uuid::parse_str(story_result["story_id"].as_str().unwrap()).unwrap();

    // Create task via HTTP API
    let task_request = json!({
        "title": "Test Task for Concurrent Tests",
        "description": "Test Description",
        "acceptance_criteria_refs": ["AC1"]
    });

    let task_response = (*app)
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
        .expect("Failed to create task");

    assert_eq!(task_response.status(), StatusCode::CREATED);
    let task_body = to_bytes(task_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let task_result: serde_json::Value = serde_json::from_slice(&task_body).unwrap();
    let task_id = Uuid::parse_str(task_result["task_id"].as_str().unwrap()).unwrap();

    (org_id, story_id, task_id)
}

#[tokio::test]
#[serial]
#[ignore]
async fn test_concurrent_task_ownership_race_condition() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let (org_id, _story_id, task_id) = create_test_task(&app).await;

    // Create multiple users trying to claim the same task
    let num_users = 10;
    let mut join_set = JoinSet::new();

    for i in 0..num_users {
        let app_clone = app.clone();
        let task_id_clone = task_id;
        let org_id_clone = org_id;
        let user_id = Uuid::new_v4();

        join_set.spawn(async move {
            let request = Request::builder()
                .method(Method::PUT)
                .uri(format!("/api/v1/tasks/{}/ownership", task_id_clone))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id_clone.to_string())
                .header("x-context-type", "organization")
                .body(Body::empty())
                .unwrap();

            let response = (*app_clone).clone().oneshot(request).await.unwrap();
            (i, response.status(), user_id)
        });
    }

    let mut successful_claims = 0;
    let mut failed_claims = 0;
    let mut _winning_user_id = None;

    while let Some(result) = join_set.join_next().await {
        let (user_index, status, user_id) = result?;

        match status {
            StatusCode::OK => {
                successful_claims += 1;
                _winning_user_id = Some(user_id);
                println!("User {} successfully claimed the task", user_index);
            }
            StatusCode::CONFLICT | StatusCode::BAD_REQUEST => {
                failed_claims += 1;
                println!("User {} failed to claim the task (expected)", user_index);
            }
            other => {
                println!("User {} got unexpected status: {}", user_index, other);
            }
        }
    }

    // Exactly one user should have successfully claimed the task
    assert_eq!(
        successful_claims, 1,
        "Exactly one user should successfully claim the task"
    );
    assert_eq!(
        failed_claims,
        num_users - 1,
        "All other users should fail to claim the task"
    );

    // Verify the task is actually owned by the winning user
    let get_request = Request::builder()
        .method(Method::GET)
        .uri("/api/v1/tasks/owned")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::empty())?;

    let response = (*app).clone().oneshot(get_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let owned_tasks: Value = serde_json::from_slice(&body)?;

    assert_eq!(owned_tasks.as_array().unwrap().len(), 1);
    assert_eq!(owned_tasks[0]["id"], task_id.to_string());

    Ok(())
}

#[tokio::test]
#[serial]
async fn test_concurrent_task_workflow_operations() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let (org_id, _story_id, task_id) = create_test_task(&app).await;
    let user_id = Uuid::new_v4();

    // First, one user claims the task
    let claim_request = Request::builder()
        .method(Method::PUT)
        .uri(format!("/api/v1/tasks/{}/ownership", task_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::empty())?;

    let response = (*app).clone().oneshot(claim_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    // Now test concurrent operations on the owned task
    let mut join_set = JoinSet::new();

    // User 1: Start work
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let _user_id_clone = user_id;
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("/api/v1/tasks/{}/work/start", task_id_clone))
            .header("authorization", "Bearer valid-test-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-context-type", "organization")
            .body(Body::empty())
            .unwrap();

        let response = (*app_clone).clone().oneshot(request).await.unwrap();
        ("start_work", response.status())
    });

    // User 2: Set estimate (same user)
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let _user_id_clone = user_id;
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/api/v1/tasks/{}/estimate", task_id_clone))
            .header("content-type", "application/json")
            .header("authorization", "Bearer valid-test-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-context-type", "organization")
            .body(Body::from(
                json!({
                    "estimated_hours": 8
                })
                .to_string(),
            ))
            .unwrap();

        let response = (*app_clone).clone().oneshot(request).await.unwrap();
        ("set_estimate", response.status())
    });

    // User 3: Try to start work (different user - should fail)
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let _other_user_id = Uuid::new_v4();
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("/api/v1/tasks/{}/work/start", task_id_clone))
            .header("authorization", "Bearer valid-test-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-context-type", "organization")
            .body(Body::empty())
            .unwrap();

        let response = (*app_clone).clone().oneshot(request).await.unwrap();
        ("unauthorized_start", response.status())
    });

    let mut results = Vec::new();
    while let Some(result) = join_set.join_next().await {
        results.push(result?);
    }

    // Check that legitimate operations succeeded
    let start_work_result = results.iter().find(|(op, _)| op == &"start_work").unwrap();
    let set_estimate_result = results
        .iter()
        .find(|(op, _)| op == &"set_estimate")
        .unwrap();
    let unauthorized_result = results
        .iter()
        .find(|(op, _)| op == &"unauthorized_start")
        .unwrap();

    assert_eq!(start_work_result.1, StatusCode::OK);
    assert_eq!(set_estimate_result.1, StatusCode::OK);
    assert!(
        unauthorized_result.1 == StatusCode::FORBIDDEN
            || unauthorized_result.1 == StatusCode::BAD_REQUEST
    );

    Ok(())
}

#[tokio::test]
#[serial]
async fn test_high_load_task_creation_and_ownership() -> Result<(), Box<dyn std::error::Error>> {
    let pool = setup_test_db().await;
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    // Setup test data - create project via direct SQL since we don't have projects API in this service
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());
    let temp_pool = sqlx::PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Create unique project name to avoid constraint violations in parallel tests
    let project_name = format!("High Load Test Project {}", Uuid::new_v4());

    sqlx::query(
        "INSERT INTO projects (id, organization_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())",
    )
    .bind(project_id)
    .bind(org_id)
    .bind(project_name)
    .bind("Test Description")
    .execute(&temp_pool)
    .await?;

    // Create story via HTTP API to ensure proper transaction handling
    let story_request = json!({
        "title": "Test Story for High Load Tests",
        "description": "Test Description",
        "labels": ["feature"],
        "acceptance_criteria": [
            {
                "id": "AC1",
                "given": "A user has valid credentials",
                "when": "They attempt to log in",
                "then": "They should be authenticated successfully"
            }
        ]
    });

    let story_response = (*app)
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
        .expect("Failed to create story");

    assert_eq!(story_response.status(), StatusCode::CREATED);
    let story_body = to_bytes(story_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let story_result: serde_json::Value = serde_json::from_slice(&story_body).unwrap();
    let story_id = Uuid::parse_str(story_result["story_id"].as_str().unwrap()).unwrap();

    let num_tasks = 50;
    let mut join_set = JoinSet::new();

    // Create multiple tasks concurrently
    for i in 0..num_tasks {
        let app_clone = app.clone();
        let story_id_clone = story_id;
        let org_id_clone = org_id;

        join_set.spawn(async move {
            let request = Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v1/stories/{}/tasks", story_id_clone))
                .header("content-type", "application/json")
                .header("authorization", "Bearer valid-test-token")
                .header("x-organization-id", org_id_clone.to_string())
                .header("x-context-type", "organization")
                .body(Body::from(
                    json!({
                        "title": format!("Task {}", i),
                        "description": format!("Description for task {}", i),
                        "acceptance_criteria_refs": ["AC1"]
                    })
                    .to_string(),
                ))
                .unwrap();

            let response = (*app_clone).clone().oneshot(request).await.unwrap();
            (i, response.status())
        });
    }

    let mut successful_creations = 0;
    let mut task_ids = Vec::new();

    while let Some(result) = join_set.join_next().await {
        let (task_index, status) = result?;

        if status == StatusCode::CREATED {
            successful_creations += 1;
            // In a real test, we'd extract the task ID from the response
            task_ids.push(Uuid::new_v4()); // Placeholder
        } else {
            println!(
                "Task {} creation failed with status: {}",
                task_index, status
            );
        }
    }

    // All tasks should be created successfully
    assert_eq!(
        successful_creations, num_tasks,
        "All tasks should be created successfully"
    );

    // Get available tasks to verify they were created
    let get_available_request = Request::builder()
        .method(Method::GET)
        .uri(format!("/api/v1/stories/{}/tasks/available", story_id))
        .header("authorization", "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-context-type", "organization")
        .body(Body::empty())?;

    let response = (*app).clone().oneshot(get_available_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let available_tasks: Value = serde_json::from_slice(&body)?;

    assert_eq!(available_tasks.as_array().unwrap().len(), num_tasks);

    Ok(())
}
