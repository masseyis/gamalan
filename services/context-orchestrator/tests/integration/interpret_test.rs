use auth_clerk::JwtVerifier;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use context_orchestrator::create_context_orchestrator_router;
use event_bus::EventBus;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower::ServiceExt;

#[tokio::test]
async fn test_interpret_handler_success() {
    let verifier = Arc::new(Mutex::new(JwtVerifier::new(
        "https://test.clerk.dev/.well-known/jwks.json".to_string(),
        "https://test.clerk.dev".to_string(),
        Some("test-audience".to_string()),
    )));

    let pool_result = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect("postgres://postgres:password@localhost:5432/gamalan")
        .await;

    if let Ok(pool) = pool_result {
        let event_bus = Arc::new(EventBus::new());
        let app = create_context_orchestrator_router(pool, verifier, event_bus).await;

        let request = Request::builder()
            .uri("/interpret")
            .method("POST")
            .header("Content-Type", "application/json")
            .body(Body::from(
                json!({
                    "utterance": "test utterance",
                    "projectId": "test-project-id"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
