use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Extension,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::task::JoinSet;
use tower::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;
use backlog::adapters::http::routes::create_backlog_router;
use backlog::adapters::integrations::MockReadinessService;
use backlog::adapters::persistence::{SqlStoryRepository, SqlTaskRepository};
use backlog::application::BacklogUsecases;
use tokio::sync::Mutex;

async fn setup_test_app(pool: PgPool) -> axum::Router {
    let story_repo = Arc::new(SqlStoryRepository::new(pool.clone()));
    let task_repo = Arc::new(SqlTaskRepository::new(pool.clone()));
    let readiness_service = Arc::new(MockReadinessService::new());
    let usecases = Arc::new(BacklogUsecases::new(
        story_repo,
        task_repo,
        readiness_service,
    ));

    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        "https://example.clerk.com".to_string(),
    )));

    axum::Router::new().nest("/api", create_backlog_router(pool, verifier).await)
}

async fn create_test_task(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();

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

    // Insert test story
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

    // Insert test task
    let task_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO tasks (id, story_id, organization_id, title, description, acceptance_criteria_refs,
                          status, owner_user_id, estimated_hours, created_at, updated_at, owned_at, completed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10, $11)
        "#
    )
    .bind(task_id)
    .bind(story_id)
    .bind(org_id)
    .bind("Test Task")
    .bind(Some("Test Description"))
    .bind(vec!["AC1"])
    .bind("available")
    .bind(None::<Uuid>)
    .bind(None::<i32>)
    .bind(None::<chrono::DateTime<chrono::Utc>>)
    .bind(None::<chrono::DateTime<chrono::Utc>>)
    .execute(pool)
    .await
    .expect("Failed to create test task");

    (org_id, story_id, task_id)
}

#[sqlx::test]
async fn test_concurrent_task_ownership_race_condition(
    pool: PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let (org_id, _story_id, task_id) = create_test_task(&pool).await;

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
                .uri(format!("/api/tasks/{}/ownership", task_id_clone))
                .header("content-type", "application/json")
                .header("authorization", format!("Bearer mock-jwt-token-{}", i))
                .header("x-organization-id", org_id_clone.to_string())
                .header("x-user-id", user_id.to_string()) // Mock user ID in header for testing
                .body(Body::empty())
                .unwrap();

            let response = app_clone.clone().oneshot(request).await.unwrap();
            (i, response.status(), user_id)
        });
    }

    let mut successful_claims = 0;
    let mut failed_claims = 0;
    let mut winning_user_id = None;

    while let Some(result) = join_set.join_next().await {
        let (user_index, status, user_id) = result?;

        match status {
            StatusCode::OK => {
                successful_claims += 1;
                winning_user_id = Some(user_id);
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
        .uri(format!("/api/tasks/owned"))
        .header("authorization", "Bearer mock-jwt-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-user-id", winning_user_id.unwrap().to_string())
        .body(Body::empty())?;

    let response = app.oneshot(get_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let owned_tasks: Value = serde_json::from_slice(&body)?;

    assert_eq!(owned_tasks.as_array().unwrap().len(), 1);
    assert_eq!(owned_tasks[0]["id"], task_id.to_string());

    Ok(())
}

#[sqlx::test]
async fn test_concurrent_task_workflow_operations(
    pool: PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let (org_id, _story_id, task_id) = create_test_task(&pool).await;
    let user_id = Uuid::new_v4();

    // First, one user claims the task
    let claim_request = Request::builder()
        .method(Method::PUT)
        .uri(format!("/api/tasks/{}/ownership", task_id))
        .header("content-type", "application/json")
        .header("authorization", "Bearer mock-jwt-token")
        .header("x-organization-id", org_id.to_string())
        .header("x-user-id", user_id.to_string())
        .body(Body::empty())?;

    let response = app.clone().oneshot(claim_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    // Now test concurrent operations on the owned task
    let mut join_set = JoinSet::new();

    // User 1: Start work
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let user_id_clone = user_id;
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("/api/tasks/{}/work/start", task_id_clone))
            .header("authorization", "Bearer mock-jwt-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-user-id", user_id_clone.to_string())
            .body(Body::empty())
            .unwrap();

        let response = app_clone.oneshot(request).await.unwrap();
        ("start_work", response.status())
    });

    // User 2: Set estimate (same user)
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let user_id_clone = user_id;
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/api/tasks/{}/estimate", task_id_clone))
            .header("content-type", "application/json")
            .header("authorization", "Bearer mock-jwt-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-user-id", user_id_clone.to_string())
            .body(Body::from(
                json!({
                    "estimated_hours": 8
                })
                .to_string(),
            ))
            .unwrap();

        let response = app_clone.oneshot(request).await.unwrap();
        ("set_estimate", response.status())
    });

    // User 3: Try to start work (different user - should fail)
    let app_clone = app.clone();
    let task_id_clone = task_id;
    let org_id_clone = org_id;
    let other_user_id = Uuid::new_v4();
    join_set.spawn(async move {
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("/api/tasks/{}/work/start", task_id_clone))
            .header("authorization", "Bearer mock-jwt-token")
            .header("x-organization-id", org_id_clone.to_string())
            .header("x-user-id", other_user_id.to_string())
            .body(Body::empty())
            .unwrap();

        let response = app_clone.oneshot(request).await.unwrap();
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

#[sqlx::test]
async fn test_high_load_task_creation_and_ownership(
    pool: PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = Arc::new(setup_test_app(pool.clone()).await);
    let project_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();
    let story_id = Uuid::new_v4();

    // Setup test data
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
    .execute(&pool)
    .await?;

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
                .uri(format!("/api/stories/{}/tasks", story_id_clone))
                .header("content-type", "application/json")
                .header("authorization", "Bearer mock-jwt-token")
                .header("x-organization-id", org_id_clone.to_string())
                .body(Body::from(
                    json!({
                        "title": format!("Task {}", i),
                        "description": format!("Description for task {}", i),
                        "acceptance_criteria_refs": [format!("AC{}", i)]
                    })
                    .to_string(),
                ))
                .unwrap();

            let response = app_clone.oneshot(request).await.unwrap();
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
        .uri(format!("/api/stories/{}/tasks/available", story_id))
        .header("authorization", "Bearer mock-jwt-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())?;

    let response = app.oneshot(get_available_request).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await?;
    let available_tasks: Value = serde_json::from_slice(&body)?;

    assert_eq!(available_tasks.as_array().unwrap().len(), num_tasks);

    Ok(())
}
