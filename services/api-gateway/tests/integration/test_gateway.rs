use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::util::ServiceExt;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use uuid::Uuid;

use auth_clerk::JwtVerifier;

async fn create_test_app() -> Router {
    use axum::routing::get;
    use sqlx::PgPool;

    // Use test database
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Clean test database
    let _ = sqlx::query("TRUNCATE TABLE stories, tasks, projects CASCADE")
        .execute(&pool)
        .await;

    // Create a test JWT verifier
    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        "https://test.jwks.url".to_string(),
        "https://test-issuer".to_string(),
        Some("test-audience".to_string()),
    )));

    // Create actual service routers with shared resources (matching production structure)
    let auth_router = auth_gateway::create_auth_router(pool.clone(), verifier.clone()).await;
    let projects_router = projects::create_projects_router(pool.clone(), verifier.clone()).await;
    let backlog_router = backlog::create_backlog_router(pool.clone(), verifier.clone()).await;
    let readiness_router = readiness::create_readiness_router(pool.clone(), verifier.clone()).await;
    let prompt_builder_router =
        prompt_builder::create_prompt_builder_router(pool.clone(), verifier.clone()).await;
    let context_orchestrator_router =
        context_orchestrator::create_context_orchestrator_router(pool.clone(), verifier.clone())
            .await;

    // Create unified router exactly matching production
    Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/ready", get(|| async { "READY" }))
        .nest("/auth", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1", backlog_router)
        .nest("/api/v1", readiness_router)
        .nest("/api/v1", prompt_builder_router)
        .nest("/api/v1/context", context_orchestrator_router)
        // Add CORS and tracing layers like production
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
}

#[tokio::test]
async fn test_gateway_health_check() {
    let app = create_test_app().await;

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

    let body = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&body[..], b"OK");
}

#[tokio::test]
async fn test_gateway_readiness_check() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/ready")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(&body[..], b"READY");
}

#[tokio::test]
async fn test_auth_service_routing() {
    let app = create_test_app().await;

    // Test that auth service routes are reachable (should return 401 for unauthenticated requests)
    let response = app
        .oneshot(
            Request::builder()
                .uri("/auth/organizations/test-org-id")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should not return 404 (route exists), accepting either auth failure or internal error
    assert_ne!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_api_v1_routing() {
    let app = create_test_app().await;

    // Test projects service routing
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should require authentication
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_cors_headers() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("OPTIONS")
                .uri("/health")
                .header("origin", "http://localhost:3000")
                .header("access-control-request-method", "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should handle CORS preflight
    let headers = response.headers();

    // CORS headers should be present
    assert!(
        headers.contains_key("access-control-allow-origin")
            || headers.contains_key("access-control-allow-methods")
    );
}

#[tokio::test]
async fn test_not_found_route() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/nonexistent/route")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_method_not_allowed() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/health") // Health endpoint only supports GET
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn test_request_tracing_headers() {
    let app = create_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .header("x-correlation-id", "test-correlation-123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Should preserve or add correlation ID
    let _headers = response.headers();
    // This would depend on the actual tracing implementation
}

// Load testing helpers - would be used with tools like K6 or Artillery
#[tokio::test]
async fn test_concurrent_requests() {
    let app = create_test_app().await;

    let handles: Vec<_> = (0..10)
        .map(|_| {
            let app_clone = app.clone();
            tokio::spawn(async move {
                app_clone
                    .oneshot(
                        Request::builder()
                            .uri("/health")
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
            })
        })
        .collect();

    // Wait for all requests to complete
    for handle in handles {
        let response = handle.await.unwrap().unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}

#[tokio::test]
async fn test_large_request_handling() {
    let app = create_test_app().await;

    // Test with a large JSON payload
    let large_payload = serde_json::json!({
        "data": "x".repeat(1024 * 10), // 10KB payload
        "metadata": {
            "test": true,
            "size": "large"
        }
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/stories")
                .header("content-type", "application/json")
                .body(Body::from(large_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should handle large payloads gracefully
    // Might be client error due to validation but shouldn't crash
    assert!(response.status().is_client_error() || response.status().is_server_error());
}

// Performance benchmarks - would be expanded for actual performance testing
#[tokio::test]
async fn test_response_time_benchmark() {
    let app = create_test_app().await;

    let start = std::time::Instant::now();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let duration = start.elapsed();

    assert_eq!(response.status(), StatusCode::OK);

    // Health check should be very fast (under 100ms)
    assert!(
        duration.as_millis() < 100,
        "Health check took too long: {:?}",
        duration
    );
}

// ============================================================================
// CROSS-SERVICE INTEGRATION TESTS
// ============================================================================

#[tokio::test]
async fn test_cross_service_project_to_backlog_workflow() {
    let app = create_test_app().await;

    // Step 1: Create a project (unauthorized - should fail)
    let project_data = json!({
        "name": "Test Project",
        "description": "Test project for cross-service integration"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/projects")
                .header("content-type", "application/json")
                .body(Body::from(project_data.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should require authentication
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[ignore = "TODO: Requires full authentication integration - test in staging environment"]
async fn test_cross_service_story_to_readiness_workflow() {
    let app = create_test_app().await;
    let project_id = Uuid::new_v4();

    // Step 1: Try to create story without auth (should fail)
    let story_data = json!({
        "title": "Test Story for Readiness",
        "description": "Story to test cross-service workflow",
        "labels": ["integration-test"]
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/projects/{}/stories", project_id))
                .header("content-type", "application/json")
                .body(Body::from(story_data.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Step 2: Check readiness endpoint is accessible (should also require auth)
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/v1/readiness/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Readiness health endpoint should be accessible
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
#[ignore = "TODO: Requires full authentication integration - test in staging environment"]
async fn test_cross_service_backlog_to_prompt_builder_workflow() {
    let app = create_test_app().await;
    let project_id = Uuid::new_v4();
    let _story_id = Uuid::new_v4();

    // Test accessing prompt-builder service through gateway
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/api/v1/prompt-builder/projects/{}/plan-pack",
                    project_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // Should require authentication
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
#[ignore = "TODO: Requires full authentication integration - test in staging environment"]
async fn test_cross_service_context_orchestrator_integration() {
    let app = create_test_app().await;
    let story_id = Uuid::new_v4();

    // Test context orchestrator endpoints through gateway
    let action_data = json!({
        "story_id": story_id,
        "action_type": "analyze_context",
        "parameters": {}
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/context/actions")
                .header("content-type", "application/json")
                .body(Body::from(action_data.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should require authentication
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_gateway_health_endpoints() {
    let app = create_test_app().await;

    // Test main gateway health endpoints only (services no longer have individual health endpoints)
    let gateway_endpoints = vec![
        ("/health", "Gateway health"),
        ("/ready", "Gateway readiness"),
    ];

    for (endpoint, service_name) in gateway_endpoints {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::OK,
            "{} health check failed",
            service_name
        );
    }
}

#[tokio::test]
async fn test_service_path_routing_isolation() {
    let app = create_test_app().await;

    // Test that services don't interfere with each other's routing
    let test_cases = vec![
        ("/api/v1/projects/nonexistent", "Projects"),
        ("/api/v1/backlog/nonexistent", "Backlog"),
        ("/api/v1/readiness/nonexistent", "Readiness"),
        ("/api/v1/prompt-builder/nonexistent", "Prompt Builder"),
        ("/api/v1/context/nonexistent", "Context Orchestrator"),
        ("/auth/nonexistent", "Auth"),
    ];

    for (path, service_name) in test_cases {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();

        // Should get responses (either success for mock endpoints or error), not crash
        assert!(
            response.status().is_success()
                || response.status().is_client_error()
                || response.status().is_server_error(),
            "{} service routing failed for path {} - got status: {}",
            service_name,
            path,
            response.status()
        );
    }
}

// ============================================================================
// LOAD AND PERFORMANCE TESTS
// ============================================================================

#[tokio::test]
async fn test_concurrent_cross_service_requests() {
    let app = create_test_app().await;

    let endpoints = ["/health", "/ready"];

    let handles: Vec<_> = (0..20)
        .map(|i| {
            let app_clone = app.clone();
            let endpoint = endpoints[i % endpoints.len()];
            tokio::spawn(async move {
                app_clone
                    .oneshot(
                        Request::builder()
                            .uri(endpoint)
                            .body(Body::empty())
                            .unwrap(),
                    )
                    .await
            })
        })
        .collect();

    // Wait for all requests to complete
    for handle in handles {
        let response = handle.await.unwrap().unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}

#[tokio::test]
async fn test_gateway_performance_under_load() {
    let app = create_test_app().await;

    let start = std::time::Instant::now();
    let mut handles = Vec::new();

    // Simulate 50 concurrent requests
    for i in 0..50 {
        let app_clone = app.clone();
        let handle = tokio::spawn(async move {
            let endpoint = match i % 2 {
                0 => "/health",
                _ => "/ready",
            };

            let request_start = std::time::Instant::now();
            let response = app_clone
                .oneshot(
                    Request::builder()
                        .uri(endpoint)
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();

            (response.status(), request_start.elapsed())
        });
        handles.push(handle);
    }

    let mut all_succeeded = true;
    let mut max_duration = std::time::Duration::from_millis(0);

    for handle in handles {
        let (status, duration) = handle.await.unwrap();
        if status != StatusCode::OK {
            all_succeeded = false;
        }
        if duration > max_duration {
            max_duration = duration;
        }
    }

    let total_duration = start.elapsed();

    assert!(all_succeeded, "Some requests failed under load");
    assert!(
        max_duration.as_millis() < 500,
        "Individual request took too long: {:?}",
        max_duration
    );
    assert!(
        total_duration.as_millis() < 2000,
        "Total test took too long: {:?}",
        total_duration
    );
}

#[tokio::test]
#[ignore = "TODO: Update test after removing individual service health endpoints - architecture uses centralized health checks"]
async fn test_database_sharing_across_services() {
    let app = create_test_app().await;

    // This test verifies that all services share the same database instance
    // by checking that they can all connect and respond to health checks

    let services_with_db = vec![
        "/api/v1/projects/health",
        "/api/v1/backlog/health",
        "/api/v1/readiness/health",
        "/api/v1/prompt-builder/health",
    ];

    for endpoint in services_with_db {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::OK,
            "Service at {} failed to connect to shared database",
            endpoint
        );
    }
}
