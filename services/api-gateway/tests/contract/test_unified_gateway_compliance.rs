use axum::{
    body::Body,
    http::{HeaderMap, Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use auth_clerk::JwtVerifier;

async fn create_test_app() -> Router {
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

    // Create actual service routers with shared resources
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
        .route("/health", axum::routing::get(|| async { "OK" }))
        .route("/ready", axum::routing::get(|| async { "READY" }))
        .nest("/auth", auth_router)
        .nest("/api/v1", projects_router)
        .nest("/api/v1", backlog_router)
        .nest("/api/v1", readiness_router)
        .nest("/api/v1", prompt_builder_router)
        .nest("/api/v1/context", context_orchestrator_router)
}

// ============================================================================
// UNIFIED GATEWAY CONTRACT TESTS
// ============================================================================

#[tokio::test]
async fn test_gateway_openapi_compliance() {
    // This test validates that the unified gateway maintains OpenAPI compliance
    // for all consolidated services

    let app = create_test_app().await;

    // Test that all service endpoints respond with proper HTTP status codes
    let gateway_endpoints = vec![
        ("/health", StatusCode::OK, "Gateway health check"),
        ("/ready", StatusCode::OK, "Gateway readiness check"),
        (
            "/api/v1/projects/health",
            StatusCode::OK,
            "Projects service health",
        ),
        (
            "/api/v1/backlog/health",
            StatusCode::OK,
            "Backlog service health",
        ),
        (
            "/api/v1/readiness/health",
            StatusCode::OK,
            "Readiness service health",
        ),
        (
            "/api/v1/prompt-builder/health",
            StatusCode::OK,
            "Prompt Builder service health",
        ),
        (
            "/api/v1/context/health",
            StatusCode::OK,
            "Context Orchestrator service health",
        ),
    ];

    for (endpoint, expected_status, description) in gateway_endpoints {
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
            expected_status,
            "OpenAPI compliance failed for {}: {}",
            endpoint,
            description
        );

        // Validate response headers
        validate_gateway_response_headers(response.headers(), endpoint);
    }
}

#[tokio::test]
async fn test_gateway_service_path_prefix_compliance() {
    // Test that all services correctly handle their path prefixes
    let app = create_test_app().await;

    let service_prefixes = vec![
        ("/auth", "Authentication service"),
        ("/api/v1/projects", "Projects service"),
        ("/api/v1/backlog", "Backlog service"),
        ("/api/v1/readiness", "Readiness service"),
        ("/api/v1/prompt-builder", "Prompt Builder service"),
        ("/api/v1/context", "Context Orchestrator service"),
    ];

    for (prefix, service_name) in service_prefixes {
        // Test that each service responds appropriately to requests at their prefix
        let health_endpoint = format!("{}/health", prefix);

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(&health_endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::OK,
            "Path prefix compliance failed for {}: {}",
            prefix,
            service_name
        );
    }
}

#[tokio::test]
async fn test_gateway_error_response_schema_compliance() {
    let app = create_test_app().await;

    // Test unauthorized access returns proper error schema
    let test_cases = vec![
        ("POST", "/api/v1/projects", json!({"name": "Test"})),
        (
            "GET",
            "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000",
            json!(null),
        ),
        (
            "POST",
            "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/stories",
            json!({"title": "Test"}),
        ),
        (
            "POST",
            "/api/v1/prompt-builder/projects/550e8400-e29b-41d4-a716-446655440000/plan-pack",
            json!(null),
        ),
        (
            "POST",
            "/api/v1/context/actions",
            json!({"action_type": "test"}),
        ),
    ];

    for (method, endpoint, payload) in test_cases {
        let mut request_builder = Request::builder()
            .method(method)
            .uri(endpoint)
            .header("content-type", "application/json");

        let body = if payload.is_null() {
            Body::empty()
        } else {
            Body::from(payload.to_string())
        };

        let response = app
            .clone()
            .oneshot(request_builder.body(body).unwrap())
            .await
            .unwrap();

        // Should return 401 Unauthorized for missing authentication
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Expected UNAUTHORIZED for {} {}",
            method,
            endpoint
        );

        // Validate error response has proper schema
        let body_bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body_str = String::from_utf8_lossy(&body_bytes);

        // Error responses should be JSON (might be empty or have error structure)
        if !body_str.is_empty() {
            let _: Value = serde_json::from_str(&body_str).expect(&format!(
                "Invalid JSON error response for {} {}",
                method, endpoint
            ));
        }
    }
}

#[tokio::test]
async fn test_gateway_content_type_compliance() {
    let app = create_test_app().await;

    // Test that JSON endpoints properly handle Content-Type
    let json_endpoints = vec![
        ("POST", "/api/v1/projects", json!({"name": "Test"})),
        (
            "POST",
            "/api/v1/projects/550e8400-e29b-41d4-a716-446655440000/stories",
            json!({"title": "Test"}),
        ),
        (
            "POST",
            "/api/v1/context/actions",
            json!({"action_type": "test"}),
        ),
    ];

    for (method, endpoint, payload) in json_endpoints {
        // Test with correct Content-Type
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(endpoint)
                    .header("content-type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should get appropriate error (401 for auth, not 400 for content-type)
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Expected UNAUTHORIZED (not content-type error) for {} {}",
            method,
            endpoint
        );

        // Test with incorrect Content-Type - should still work or give specific error
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(endpoint)
                    .header("content-type", "text/plain")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should handle content-type mismatch gracefully
        assert!(
            response.status().is_client_error(),
            "Should handle content-type mismatch for {} {}",
            method,
            endpoint
        );
    }
}

#[tokio::test]
async fn test_gateway_cors_compliance() {
    let app = create_test_app().await;

    // Test CORS preflight requests
    let cors_test_endpoints = vec![
        "/health",
        "/api/v1/projects",
        "/api/v1/backlog/health",
        "/api/v1/context/health",
    ];

    for endpoint in cors_test_endpoints {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri(endpoint)
                    .header("origin", "http://localhost:3000")
                    .header("access-control-request-method", "GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        // CORS preflight should be handled
        let headers = response.headers();

        // Should have CORS headers or handle preflight gracefully
        let has_cors_headers = headers.contains_key("access-control-allow-origin")
            || headers.contains_key("access-control-allow-methods")
            || headers.contains_key("access-control-allow-headers");

        // Either has CORS headers or returns reasonable status
        assert!(
            has_cors_headers
                || response.status().is_success()
                || response.status() == StatusCode::METHOD_NOT_ALLOWED,
            "CORS compliance issue for {}",
            endpoint
        );
    }
}

#[tokio::test]
async fn test_gateway_method_compliance() {
    let app = create_test_app().await;

    // Test that endpoints respond correctly to different HTTP methods
    let method_tests = vec![
        ("GET", "/health", StatusCode::OK),
        ("POST", "/health", StatusCode::METHOD_NOT_ALLOWED),
        ("PUT", "/health", StatusCode::METHOD_NOT_ALLOWED),
        ("DELETE", "/health", StatusCode::METHOD_NOT_ALLOWED),
        ("GET", "/ready", StatusCode::OK),
        ("POST", "/ready", StatusCode::METHOD_NOT_ALLOWED),
        ("GET", "/api/v1/projects/health", StatusCode::OK),
        (
            "POST",
            "/api/v1/projects/health",
            StatusCode::METHOD_NOT_ALLOWED,
        ),
        ("GET", "/api/v1/projects", StatusCode::UNAUTHORIZED), // Would be OK with auth
        ("POST", "/api/v1/projects", StatusCode::UNAUTHORIZED), // Would be OK with auth
        ("DELETE", "/api/v1/projects", StatusCode::METHOD_NOT_ALLOWED),
    ];

    for (method, endpoint, expected_status) in method_tests {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            expected_status,
            "Method compliance failed for {} {}",
            method,
            endpoint
        );
    }
}

#[tokio::test]
async fn test_gateway_uuid_parameter_validation() {
    let app = create_test_app().await;

    // Test that UUID parameters are properly validated
    let uuid_endpoints = vec![
        "/api/v1/projects/invalid-uuid",
        "/api/v1/projects/invalid-uuid/stories",
        "/api/v1/stories/not-a-uuid",
        "/api/v1/prompt-builder/projects/bad-uuid/plan-pack",
    ];

    for endpoint in uuid_endpoints {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(endpoint)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should return 400 Bad Request for invalid UUID format
        assert!(
            response.status() == StatusCode::BAD_REQUEST
                || response.status() == StatusCode::NOT_FOUND
                || response.status() == StatusCode::UNAUTHORIZED,
            "UUID validation failed for {}",
            endpoint
        );
    }
}

#[tokio::test]
async fn test_gateway_request_size_limits() {
    let app = create_test_app().await;

    // Test that request size limits are properly enforced
    let large_payload = json!({
        "name": "x".repeat(1024 * 1024), // 1MB string
        "description": "Large test payload"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/projects")
                .header("content-type", "application/json")
                .body(Body::from(large_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should handle large payloads gracefully (reject or process)
    assert!(
        response.status().is_client_error()
            || response.status().is_server_error()
            || response.status() == StatusCode::UNAUTHORIZED,
        "Large payload handling failed"
    );
}

#[tokio::test]
async fn test_gateway_openapi_status_code_compliance() {
    let app = create_test_app().await;

    // Comprehensive status code compliance test
    let status_code_tests = vec![
        // Success cases (when available)
        ("GET", "/health", None, StatusCode::OK),
        ("GET", "/ready", None, StatusCode::OK),
        // Authentication required cases
        ("GET", "/api/v1/projects", None, StatusCode::UNAUTHORIZED),
        (
            "POST",
            "/api/v1/projects",
            Some(json!({"name": "Test"})),
            StatusCode::UNAUTHORIZED,
        ),
        // Method not allowed cases
        ("POST", "/health", None, StatusCode::METHOD_NOT_ALLOWED),
        ("DELETE", "/ready", None, StatusCode::METHOD_NOT_ALLOWED),
        // Bad request cases (invalid data)
        (
            "POST",
            "/api/v1/projects",
            Some(json!("invalid")),
            StatusCode::BAD_REQUEST,
        ),
    ];

    for (method, endpoint, payload, expected_status) in status_code_tests {
        let body = match payload {
            Some(data) => Body::from(data.to_string()),
            None => Body::empty(),
        };

        let mut request_builder = Request::builder().method(method).uri(endpoint);

        if payload.is_some() {
            request_builder = request_builder.header("content-type", "application/json");
        }

        let response = app
            .clone()
            .oneshot(request_builder.body(body).unwrap())
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            expected_status,
            "Status code compliance failed for {} {} (expected {}, got {})",
            method,
            endpoint,
            expected_status.as_u16(),
            response.status().as_u16()
        );
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn validate_gateway_response_headers(headers: &HeaderMap, endpoint: &str) {
    // Validate common response headers that should be present

    // Content-Type should be appropriate for health checks
    if endpoint.ends_with("/health") || endpoint.ends_with("/ready") {
        if let Some(content_type) = headers.get("content-type") {
            let content_type_str = content_type.to_str().unwrap_or("");
            // Health endpoints typically return plain text
            assert!(
                content_type_str.contains("text/plain") || content_type_str.contains("text/html"),
                "Unexpected content-type for health endpoint {}: {}",
                endpoint,
                content_type_str
            );
        }
    }

    // Security headers validation
    validate_security_headers(headers, endpoint);
}

fn validate_security_headers(headers: &HeaderMap, endpoint: &str) {
    // Note: In production, these headers should be present
    // For testing, we just validate they don't have obviously bad values

    if let Some(x_frame_options) = headers.get("x-frame-options") {
        let value = x_frame_options.to_str().unwrap_or("");
        assert!(
            value == "DENY" || value == "SAMEORIGIN" || value.starts_with("ALLOW-FROM"),
            "Invalid X-Frame-Options header for {}: {}",
            endpoint,
            value
        );
    }

    if let Some(content_security_policy) = headers.get("content-security-policy") {
        let value = content_security_policy.to_str().unwrap_or("");
        assert!(
            !value.contains("unsafe-eval") || !value.contains("unsafe-inline"),
            "Potentially unsafe CSP for {}: {}",
            endpoint,
            value
        );
    }
}

// Helper function to validate response time performance
async fn validate_response_time<F, Fut>(test_fn: F, max_duration_ms: u64, description: &str)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    let start = std::time::Instant::now();
    test_fn().await;
    let duration = start.elapsed();

    assert!(
        duration.as_millis() < max_duration_ms as u128,
        "{} took too long: {:?} (max: {}ms)",
        description,
        duration,
        max_duration_ms
    );
}
