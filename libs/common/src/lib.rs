use axum::{
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    body::Body,
};
use thiserror::Error;
use tracing::Level;
use tracing_subscriber::FmtSubscriber;
use utoipa::ToSchema;
use uuid::Uuid;

const X_REQUEST_ID: &str = "x-request-id";

/// Initializes the tracing subscriber.
pub fn init_tracing() {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .json()
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");
}

/// Axum middleware to extract the correlation ID from the request headers.
/// If no correlation ID is present, a new one is generated.
pub async fn correlation_id_extractor(mut req: Request<Body>, next: Next) -> Response {
    let id = req
        .headers()
        .get(X_REQUEST_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    req.headers_mut()
        .insert(X_REQUEST_ID, id.parse().unwrap());

    let mut res = next.run(req).await;

    res.headers_mut()
        .insert(X_REQUEST_ID, id.parse().unwrap());

    res
}

/// A common error type for the application.
#[derive(Debug, Error, ToSchema)]
pub enum AppError {
    #[error("internal server error")]
    InternalServerError,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::InternalServerError => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            AppError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, self.to_string()),
        };

        (status, error_message).into_response()
    }
}