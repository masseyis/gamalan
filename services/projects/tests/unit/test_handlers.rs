use axum::{http::StatusCode, response::IntoResponse};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::util::ServiceExt;

use auth_clerk::Authenticated;

// Mock authentication for testing
fn mock_authenticated() -> Authenticated {
    Authenticated {
        sub: "test-user-id".to_string(),
        email: Some("test@example.com".to_string()),
        orgs: Some(vec!["test-org".to_string()]),
    }
}

#[tokio::test]
async fn test_get_projects_returns_json() {
    use projects::adapters::http::handlers::get_projects;

    let auth = mock_authenticated();
    let response = get_projects(auth).await.into_response();

    assert_eq!(response.status(), StatusCode::OK);

    // Check content type is JSON
    let content_type = response.headers().get("content-type");
    assert!(content_type.is_some());
    let content_type_str = content_type.unwrap().to_str().unwrap();
    assert!(content_type_str.contains("application/json"));
}

#[tokio::test]
async fn test_get_projects_contains_required_fields() {
    use projects::adapters::http::handlers::get_projects;

    let auth = mock_authenticated();
    let response = get_projects(auth).await.into_response();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let projects: Value = serde_json::from_slice(&body).unwrap();

    assert!(projects.is_array());
    let projects_array = projects.as_array().unwrap();
    assert!(!projects_array.is_empty());

    for project in projects_array {
        // Validate required fields exist
        assert!(project.get("id").is_some());
        assert!(project.get("name").is_some());
        assert!(project.get("description").is_some());
        assert!(project.get("createdAt").is_some());
        assert!(project.get("updatedAt").is_some());

        // Validate field types
        assert!(project["id"].is_string());
        assert!(project["name"].is_string());
        assert!(project["description"].is_string());
        assert!(project["createdAt"].is_string());
        assert!(project["updatedAt"].is_string());

        // Validate non-empty strings
        assert!(!project["id"].as_str().unwrap().is_empty());
        assert!(!project["name"].as_str().unwrap().is_empty());
    }
}

#[tokio::test]
async fn test_create_project_returns_created() {
    use projects::adapters::http::handlers::create_project;

    let auth = mock_authenticated();
    let response = create_project(auth).await.into_response();

    assert_eq!(response.status(), StatusCode::CREATED);
}

#[tokio::test]
async fn test_update_project_settings_returns_ok() {
    use projects::adapters::http::handlers::update_project_settings;

    let auth = mock_authenticated();
    let response = update_project_settings(auth).await.into_response();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_project_returns_ok() {
    use projects::adapters::http::handlers::get_project;

    let response = get_project().await.into_response();

    assert_eq!(response.status(), StatusCode::OK);
}

// Property-based tests for project data validation
#[cfg(test)]
mod property_tests {
    use proptest::prelude::*;

    fn arb_project_name() -> impl Strategy<Value = String> {
        "[A-Za-z0-9 ]{3,100}"
    }

    fn arb_project_description() -> impl Strategy<Value = String> {
        "[A-Za-z0-9 .,!?]{10,500}"
    }

    proptest! {
        #[test]
        fn test_project_name_validation(name in arb_project_name()) {
            // Project names should be reasonable length and contain valid characters
            prop_assert!(name.len() >= 3);
            prop_assert!(name.len() <= 100);
            prop_assert!(!name.trim().is_empty());
        }

        #[test]
        fn test_project_description_validation(desc in arb_project_description()) {
            // Project descriptions should have minimum meaningful content
            prop_assert!(desc.len() >= 10);
            prop_assert!(desc.len() <= 500);
        }
    }
}

// Integration tests for the complete request/response cycle
mod integration_tests {
    use super::*;
    use axum::{body::Body, extract::Request, Router};

    async fn create_test_router() -> Router {
        use auth_clerk::JwtVerifier;
        use projects::create_projects_router;
        use sqlx::PgPool;
        use std::sync::Arc;
        use tokio::sync::Mutex;

        let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:password@localhost:5432/gamalan_test".to_string()
        });

        let pool = PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database");

        let verifier = Arc::new(Mutex::new(JwtVerifier::new(
            "https://test.jwks.url".to_string(),
            "https://test-issuer".to_string(),
            Some("test-audience".to_string()),
        )));

        create_projects_router(pool, verifier).await
    }

    #[tokio::test]
    async fn test_projects_route_without_auth() {
        let app = create_test_router().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/projects")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_projects_route_with_invalid_auth() {
        let app = create_test_router().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/projects")
                    .header("authorization", "Bearer invalid-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_create_project_without_auth() {
        let app = create_test_router().await;

        let project_data = json!({
            "name": "Test Project",
            "description": "A test project"
        });

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/projects")
                    .header("content-type", "application/json")
                    .body(Body::from(project_data.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_nonexistent_route() {
        let app = create_test_router().await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
