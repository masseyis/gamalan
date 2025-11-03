use crate::common::{build_backlog_router_for_tests, setup_test_db};
use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::Value;
use serial_test::serial;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

/// Helper to create a test sprint - returns (sprint_id, org_id)
async fn create_test_sprint(pool: &PgPool, _project_id: Uuid) -> (Uuid, Uuid) {
    let sprint_id = Uuid::new_v4();
    let team_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    // Create organization first
    let org_slug = format!("test-org-{}", &org_id.to_string().replace('-', "")[..8]);
    sqlx::query(
        r#"
        INSERT INTO organizations (id, external_id, name, slug, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        "#,
    )
    .bind(org_id)
    .bind(format!("org_{}", org_id))
    .bind("Test Organization")
    .bind(org_slug)
    .execute(pool)
    .await
    .expect("Failed to create test organization");

    // Create team
    sqlx::query(
        r#"
        INSERT INTO teams (id, name, organization_id, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        "#,
    )
    .bind(team_id)
    .bind("Test Team")
    .bind(org_id)
    .execute(pool)
    .await
    .expect("Failed to create test team");

    // Create sprint
    sqlx::query(
        r#"
        INSERT INTO sprints (
            id, team_id, name, goal, status,
            capacity_points, start_date, end_date,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '14 days', NOW(), NOW())
        "#,
    )
    .bind(sprint_id)
    .bind(team_id)
    .bind("Test Sprint")
    .bind("Test sprint goal")
    .bind("active")
    .bind(40_i32)
    .execute(pool)
    .await
    .expect("Failed to create test sprint");

    (sprint_id, org_id)
}

/// Helper to create a test story in a sprint
async fn create_test_story_in_sprint(
    pool: &PgPool,
    project_id: Uuid,
    sprint_id: Uuid,
    org_id: Uuid,
    title: &str,
) -> Uuid {
    let story_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO stories (
            id, project_id, organization_id, title, description,
            status, sprint_id, story_points,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        "#,
    )
    .bind(story_id)
    .bind(project_id)
    .bind(org_id)
    .bind(title)
    .bind("Test story description")
    .bind("inprogress")
    .bind(sprint_id)
    .bind(5_i32)
    .execute(pool)
    .await
    .expect("Failed to create test story");

    story_id
}

/// Helper to create a test task for a story
async fn create_test_task(
    pool: &PgPool,
    story_id: Uuid,
    org_id: Uuid,
    title: &str,
    status: &str,
    owner_user_id: Option<Uuid>,
) -> Uuid {
    let task_id = Uuid::new_v4();

    // Set owned_at and completed_at based on status and owner
    let owned_at = if owner_user_id.is_some() {
        Some(chrono::Utc::now())
    } else {
        None
    };

    let completed_at = if status == "completed" {
        Some(chrono::Utc::now())
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO tasks (
            id, story_id, organization_id, title, description,
            status, owner_user_id, acceptance_criteria_refs,
            owned_at, completed_at,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        "#,
    )
    .bind(task_id)
    .bind(story_id)
    .bind(org_id)
    .bind(title)
    .bind("Test task description")
    .bind(status)
    .bind(owner_user_id)
    .bind(vec!["AC1".to_string(), "AC2".to_string()])
    .bind(owned_at)
    .bind(completed_at)
    .execute(pool)
    .await
    .expect("Failed to create test task");

    task_id
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_returns_all_tasks_grouped_by_story() {
    // AC1: I should see all tasks from all stories in the current sprint
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;

    // Create multiple stories with tasks
    let story1_id =
        create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story 1").await;
    let story2_id =
        create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story 2").await;

    let task1_id = create_test_task(&pool, story1_id, org_id, "Task 1", "available", None).await;
    let task2_id = create_test_task(
        &pool,
        story1_id,
        org_id,
        "Task 2",
        "owned",
        Some(Uuid::new_v4()),
    )
    .await;
    let task3_id = create_test_task(
        &pool,
        story2_id,
        org_id,
        "Task 3",
        "inprogress",
        Some(Uuid::new_v4()),
    )
    .await;
    let task4_id = create_test_task(
        &pool,
        story2_id,
        org_id,
        "Task 4",
        "completed",
        Some(Uuid::new_v4()),
    )
    .await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    let request = Request::builder()
        .uri(format!("/api/v1/sprints/{}/tasks", sprint_id))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    // Verify sprint metadata is present
    assert_eq!(data["sprint"]["id"], sprint_id.to_string());
    assert_eq!(data["sprint"]["name"], "Test Sprint");
    assert_eq!(data["sprint"]["status"], "active");
    assert!(data["sprint"]["totalStories"].as_i64().unwrap() >= 2);
    assert_eq!(data["sprint"]["totalTasks"], 4);
    assert_eq!(data["sprint"]["completedTasks"], 1);

    // Verify all tasks are returned
    let tasks = data["tasks"].as_array().unwrap();
    assert_eq!(tasks.len(), 4);

    // Verify task details include story information
    let task_ids: Vec<String> = tasks
        .iter()
        .map(|t| t["id"].as_str().unwrap().to_string())
        .collect();
    assert!(task_ids.contains(&task1_id.to_string()));
    assert!(task_ids.contains(&task2_id.to_string()));
    assert!(task_ids.contains(&task3_id.to_string()));
    assert!(task_ids.contains(&task4_id.to_string()));

    // Verify tasks have parent story information
    for task in tasks {
        assert!(task["storyId"].is_string());
        assert!(task["storyTitle"].is_string());
        assert!(task["acceptanceCriteriaRefs"].is_array());
    }
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_filters_by_status() {
    // AC2: The task list should update to show only matching tasks when status filter is applied
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;
    let story_id = create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story").await;

    // Create tasks with different statuses
    create_test_task(&pool, story_id, org_id, "Available Task", "available", None).await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Owned Task",
        "owned",
        Some(Uuid::new_v4()),
    )
    .await;
    let in_progress_task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "In Progress Task",
        "inprogress",
        Some(Uuid::new_v4()),
    )
    .await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Completed Task",
        "completed",
        Some(Uuid::new_v4()),
    )
    .await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    // Test filtering by 'inprogress' status
    let request = Request::builder()
        .uri(format!(
            "/api/v1/sprints/{}/tasks?status=inprogress",
            sprint_id
        ))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    let tasks = data["tasks"].as_array().unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0]["id"], in_progress_task_id.to_string());
    assert_eq!(tasks[0]["status"], "inprogress");
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_groups_by_status() {
    // AC2: I should be able to group tasks by status
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;
    let story_id = create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story").await;

    // Create tasks with different statuses
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Available Task 1",
        "available",
        None,
    )
    .await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Available Task 2",
        "available",
        None,
    )
    .await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "In Progress Task",
        "inprogress",
        Some(Uuid::new_v4()),
    )
    .await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    let request = Request::builder()
        .uri(format!(
            "/api/v1/sprints/{}/tasks?groupBy=status",
            sprint_id
        ))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    // Verify grouping structure
    let groups = data["groups"].as_object().unwrap();
    assert!(groups.contains_key("available"));
    assert!(groups.contains_key("inprogress"));

    assert_eq!(groups["available"]["count"], 2);
    assert_eq!(groups["inprogress"]["count"], 1);
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_shows_task_ownership() {
    // AC3: Tasks should display owner information
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;
    let story_id = create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story").await;

    let owner_id = Uuid::new_v4();

    // Create available and owned tasks
    let available_task_id =
        create_test_task(&pool, story_id, org_id, "Available Task", "available", None).await;
    let owned_task_id = create_test_task(
        &pool,
        story_id,
        org_id,
        "Owned Task",
        "owned",
        Some(owner_id),
    )
    .await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    let request = Request::builder()
        .uri(format!("/api/v1/sprints/{}/tasks", sprint_id))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    let tasks = data["tasks"].as_array().unwrap();

    // Find the available task - should have null owner
    let available_task = tasks
        .iter()
        .find(|t| t["id"] == available_task_id.to_string())
        .unwrap();
    assert!(available_task["ownerUserId"].is_null());

    // Find the owned task - should have owner
    let owned_task = tasks
        .iter()
        .find(|t| t["id"] == owned_task_id.to_string())
        .unwrap();
    assert_eq!(owned_task["ownerUserId"], owner_id.to_string());
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_shows_sprint_progress() {
    // AC5: I should see sprint metadata and progress indicators
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;
    let story_id = create_test_story_in_sprint(&pool, project_id, sprint_id, org_id, "Story").await;

    // Create tasks with different statuses
    create_test_task(&pool, story_id, org_id, "Task 1", "available", None).await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 2",
        "inprogress",
        Some(Uuid::new_v4()),
    )
    .await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 3",
        "completed",
        Some(Uuid::new_v4()),
    )
    .await;
    create_test_task(
        &pool,
        story_id,
        org_id,
        "Task 4",
        "completed",
        Some(Uuid::new_v4()),
    )
    .await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    let request = Request::builder()
        .uri(format!("/api/v1/sprints/{}/tasks", sprint_id))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    // Verify sprint progress information
    assert_eq!(data["sprint"]["totalTasks"], 4);
    assert_eq!(data["sprint"]["completedTasks"], 2);
    assert_eq!(data["sprint"]["progressPercentage"], 50.0);
    assert!(data["sprint"]["daysRemaining"].is_number());
    assert!(data["sprint"]["startDate"].is_string());
    assert!(data["sprint"]["endDate"].is_string());
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_returns_404_for_nonexistent_sprint() {
    let pool = setup_test_db().await;
    let router = build_backlog_router_for_tests(pool.clone()).await;

    let nonexistent_sprint_id = Uuid::new_v4();
    let org_id = Uuid::new_v4();

    let request = Request::builder()
        .uri(format!("/api/v1/sprints/{}/tasks", nonexistent_sprint_id))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
#[serial]
async fn test_get_sprint_task_board_returns_empty_for_sprint_with_no_stories() {
    let pool = setup_test_db().await;
    let project_id = Uuid::new_v4();
    let (sprint_id, org_id) = create_test_sprint(&pool, project_id).await;

    let router = build_backlog_router_for_tests(pool.clone()).await;

    let request = Request::builder()
        .uri(format!("/api/v1/sprints/{}/tasks", sprint_id))
        .header(header::AUTHORIZATION, "Bearer valid-test-token")
        .header("x-organization-id", org_id.to_string())
        .body(Body::empty())
        .unwrap();

    let response = router.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let data: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(data["sprint"]["totalStories"], 0);
    assert_eq!(data["sprint"]["totalTasks"], 0);
    assert_eq!(data["sprint"]["completedTasks"], 0);
    assert_eq!(data["tasks"].as_array().unwrap().len(), 0);
}
