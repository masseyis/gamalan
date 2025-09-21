use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::time::Instant;
use thiserror::Error;
use tracing::{debug, error, info};
use utoipa::ToSchema;
use uuid::Uuid;

pub mod error_context;
pub mod feature_flags;
pub mod observability;

use error_context::ErrorContext;

const X_REQUEST_ID: &str = "x-request-id";

/// Initialize production-ready tracing for a service
pub fn init_tracing(service_name: &str) {
    if let Err(e) = observability::init_production_tracing(service_name) {
        eprintln!("Failed to initialize tracing: {}", e);
        // Fallback to basic tracing, but only if no subscriber is already set
        if tracing::subscriber::set_global_default(tracing_subscriber::fmt().json().finish())
            .is_err()
        {
            eprintln!("Tracing subscriber already initialized, skipping fallback setup");
        }
    }
}

/// Enhanced request context middleware with comprehensive logging
pub async fn enhanced_request_middleware(req: Request<Body>, next: Next) -> Response {
    let start_time = Instant::now();

    // Extract request information
    let method = req.method().clone();
    let uri = req.uri().clone();
    let user_agent = req
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");

    // Get or create request ID
    let request_id = req
        .headers()
        .get(X_REQUEST_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Create a span for the entire request
    let span = tracing::info_span!(
        "request",
        method = %method,
        uri = %uri,
        request_id = %request_id,
        user_agent = %user_agent,
        status = tracing::field::Empty,
        duration_ms = tracing::field::Empty,
        error = tracing::field::Empty,
    );

    let _enter = span.enter();

    // Add request ID to the request
    let mut req = req;
    req.headers_mut()
        .insert(X_REQUEST_ID, request_id.parse().unwrap());

    debug!("Processing request: {} {}", method, uri);

    // Process the request
    let mut response = next.run(req).await;
    let status = response.status();
    let duration = start_time.elapsed();

    // Log completion
    if status.is_server_error() {
        error!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request failed"
        );
    } else if status.is_client_error() {
        info!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed with client error"
        );
    } else {
        debug!(
            status = %status,
            duration_ms = duration.as_millis(),
            "Request completed successfully"
        );
    }

    // Add request ID to response headers
    response
        .headers_mut()
        .insert(X_REQUEST_ID, request_id.parse().unwrap());

    response
}

/// Legacy correlation ID extractor - kept for backward compatibility
pub async fn correlation_id_extractor(mut req: Request<Body>, next: Next) -> Response {
    let id = req
        .headers()
        .get(X_REQUEST_ID)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    req.headers_mut().insert(X_REQUEST_ID, id.parse().unwrap());

    let mut res = next.run(req).await;

    res.headers_mut().insert(X_REQUEST_ID, id.parse().unwrap());

    res
}

/// Enhanced error types with context and debugging information
#[derive(Debug, Error, ToSchema)]
pub enum AppError {
    #[error("internal server error")]
    InternalServerError,

    #[error("internal server error: {message}")]
    InternalServerErrorWithContext {
        message: String,
        #[source]
        source: anyhow::Error,
        context: Box<ErrorContext>,
    },

    #[error("not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("bad request: {message}")]
    BadRequestWithContext {
        message: String,
        details: HashMap<String, String>,
        context: Box<ErrorContext>,
    },

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("unauthorized: {message}")]
    UnauthorizedWithContext {
        message: String,
        error_code: String,
        context: Box<ErrorContext>,
    },

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("rate limit exceeded")]
    RateLimitExceeded,

    #[error("external service error: {0}")]
    ExternalServiceError(String),

    #[error("database error: {message}")]
    DatabaseError {
        message: String,
        operation: String,
        context: Box<ErrorContext>,
    },

    #[error("configuration error: {message}")]
    ConfigurationError {
        message: String,
        missing_keys: Vec<String>,
        context: Box<ErrorContext>,
    },
}

/// Structured error response for API consistency
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    pub error: ErrorDetails,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorDetails {
    pub code: String,
    pub message: String,
    pub request_id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debug_info: Option<DebugInfo>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DebugInfo {
    pub service: String,
    pub endpoint: Option<String>,
    pub method: Option<String>,
    pub user_id: Option<String>,
    pub error_chain: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack_trace: Option<String>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let is_debug = std::env::var("RUST_ENV")
            .map(|env| env != "production")
            .unwrap_or(true);

        let (status, _error_code, error_response) = match &self {
            AppError::InternalServerError => {
                error!("Internal server error occurred");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_SERVER_ERROR".to_string(),
                    create_error_response(
                        "INTERNAL_SERVER_ERROR",
                        "Internal server error",
                        None,
                        None,
                        is_debug,
                    ),
                )
            }
            AppError::InternalServerErrorWithContext {
                message,
                source,
                context,
            } => {
                // Log the full error chain with context
                error!(
                    request_id = %context.request_id,
                    service = %context.service_name,
                    endpoint = ?context.endpoint,
                    method = ?context.method,
                    user_id = ?context.user_id,
                    error_chain = ?get_error_chain(source),
                    "Internal server error with context: {}", message
                );

                let debug_info = if is_debug {
                    Some(DebugInfo {
                        service: context.service_name.clone(),
                        endpoint: context.endpoint.clone(),
                        method: context.method.clone(),
                        user_id: context.user_id.clone(),
                        error_chain: get_error_chain(source),
                        stack_trace: get_stack_trace(),
                    })
                } else {
                    None
                };

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_SERVER_ERROR_WITH_CONTEXT".to_string(),
                    create_error_response(
                        "INTERNAL_SERVER_ERROR_WITH_CONTEXT",
                        message,
                        Some(context.request_id.clone()),
                        debug_info,
                        is_debug,
                    ),
                )
            }
            AppError::NotFound(msg) => {
                info!("Resource not found: {}", msg);
                (
                    StatusCode::NOT_FOUND,
                    "NOT_FOUND".to_string(),
                    create_error_response("NOT_FOUND", msg, None, None, is_debug),
                )
            }
            AppError::BadRequest(msg) => {
                info!("Bad request: {}", msg);
                (
                    StatusCode::BAD_REQUEST,
                    "BAD_REQUEST".to_string(),
                    create_error_response("BAD_REQUEST", msg, None, None, is_debug),
                )
            }
            AppError::BadRequestWithContext {
                message,
                details,
                context,
            } => {
                info!(
                    request_id = %context.request_id,
                    service = %context.service_name,
                    details = ?details,
                    "Bad request with context: {}", message
                );

                let debug_info = if is_debug {
                    Some(DebugInfo {
                        service: context.service_name.clone(),
                        endpoint: context.endpoint.clone(),
                        method: context.method.clone(),
                        user_id: context.user_id.clone(),
                        error_chain: vec![message.clone()],
                        stack_trace: None,
                    })
                } else {
                    None
                };

                (
                    StatusCode::BAD_REQUEST,
                    "BAD_REQUEST_WITH_CONTEXT".to_string(),
                    create_error_response(
                        "BAD_REQUEST_WITH_CONTEXT",
                        message,
                        Some(context.request_id.clone()),
                        debug_info,
                        is_debug,
                    ),
                )
            }
            AppError::Unauthorized(msg) => {
                info!("Unauthorized access: {}", msg);
                (
                    StatusCode::UNAUTHORIZED,
                    "UNAUTHORIZED".to_string(),
                    create_error_response("UNAUTHORIZED", msg, None, None, is_debug),
                )
            }
            AppError::UnauthorizedWithContext {
                message,
                error_code,
                context,
            } => {
                info!(
                    request_id = %context.request_id,
                    service = %context.service_name,
                    error_code = %error_code,
                    user_id = ?context.user_id,
                    "Unauthorized access with context: {}", message
                );

                let debug_info = if is_debug {
                    Some(DebugInfo {
                        service: context.service_name.clone(),
                        endpoint: context.endpoint.clone(),
                        method: context.method.clone(),
                        user_id: context.user_id.clone(),
                        error_chain: vec![format!("{}: {}", error_code, message)],
                        stack_trace: None,
                    })
                } else {
                    None
                };

                (
                    StatusCode::UNAUTHORIZED,
                    error_code.clone(),
                    create_error_response(
                        error_code,
                        message,
                        Some(context.request_id.clone()),
                        debug_info,
                        is_debug,
                    ),
                )
            }
            AppError::Forbidden(msg) => {
                info!("Forbidden access: {}", msg);
                (
                    StatusCode::FORBIDDEN,
                    "FORBIDDEN".to_string(),
                    create_error_response("FORBIDDEN", msg, None, None, is_debug),
                )
            }
            AppError::RateLimitExceeded => {
                info!("Rate limit exceeded");
                (
                    StatusCode::TOO_MANY_REQUESTS,
                    "RATE_LIMIT_EXCEEDED".to_string(),
                    create_error_response(
                        "RATE_LIMIT_EXCEEDED",
                        "Rate limit exceeded",
                        None,
                        None,
                        is_debug,
                    ),
                )
            }
            AppError::ExternalServiceError(msg) => {
                error!("External service error: {}", msg);
                (
                    StatusCode::BAD_GATEWAY,
                    "EXTERNAL_SERVICE_ERROR".to_string(),
                    create_error_response("EXTERNAL_SERVICE_ERROR", msg, None, None, is_debug),
                )
            }
            AppError::DatabaseError {
                message,
                operation,
                context,
            } => {
                error!(
                    request_id = %context.request_id,
                    service = %context.service_name,
                    operation = %operation,
                    "Database error: {}", message
                );

                let debug_info = if is_debug {
                    Some(DebugInfo {
                        service: context.service_name.clone(),
                        endpoint: context.endpoint.clone(),
                        method: context.method.clone(),
                        user_id: context.user_id.clone(),
                        error_chain: vec![format!(
                            "Database operation '{}' failed: {}",
                            operation, message
                        )],
                        stack_trace: get_stack_trace(),
                    })
                } else {
                    None
                };

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "DATABASE_ERROR".to_string(),
                    create_error_response(
                        "DATABASE_ERROR",
                        "A database error occurred",
                        Some(context.request_id.clone()),
                        debug_info,
                        is_debug,
                    ),
                )
            }
            AppError::ConfigurationError {
                message,
                missing_keys,
                context,
            } => {
                error!(
                    request_id = %context.request_id,
                    service = %context.service_name,
                    missing_keys = ?missing_keys,
                    "Configuration error: {}", message
                );

                let debug_info = if is_debug {
                    Some(DebugInfo {
                        service: context.service_name.clone(),
                        endpoint: context.endpoint.clone(),
                        method: context.method.clone(),
                        user_id: context.user_id.clone(),
                        error_chain: vec![format!(
                            "Missing configuration keys: {:?}",
                            missing_keys
                        )],
                        stack_trace: get_stack_trace(),
                    })
                } else {
                    None
                };

                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "CONFIGURATION_ERROR".to_string(),
                    create_error_response(
                        "CONFIGURATION_ERROR",
                        "Service configuration error",
                        Some(context.request_id.clone()),
                        debug_info,
                        is_debug,
                    ),
                )
            }
        };

        // Record error metrics if available
        // TODO: Re-enable metrics when the feature is properly configured
        // observability::metrics::increment_error_counter(&error_code);

        (status, Json(error_response)).into_response()
    }
}

fn create_error_response(
    code: &str,
    message: &str,
    request_id: Option<String>,
    debug_info: Option<DebugInfo>,
    is_debug: bool,
) -> ErrorResponse {
    ErrorResponse {
        error: ErrorDetails {
            code: code.to_string(),
            message: message.to_string(),
            request_id: request_id.unwrap_or_else(|| "unknown".to_string()),
            timestamp: chrono::Utc::now(),
            details: None,
            debug_info: if is_debug { debug_info } else { None },
        },
    }
}

fn get_error_chain(error: &anyhow::Error) -> Vec<String> {
    let mut chain = Vec::new();
    let mut current = error.source();
    chain.push(error.to_string());

    while let Some(cause) = current {
        chain.push(cause.to_string());
        current = cause.source();
    }

    chain
}

fn get_stack_trace() -> Option<String> {
    let backtrace = std::backtrace::Backtrace::capture();
    match backtrace.status() {
        std::backtrace::BacktraceStatus::Captured => Some(backtrace.to_string()),
        _ => None,
    }
}

/// Health check endpoint handler
pub async fn health_check() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now(),
        "service": env!("CARGO_PKG_NAME")
    }))
}

/// Detailed health check endpoint handler
pub async fn detailed_health_check() -> impl IntoResponse {
    Json(observability::detailed_health_check().await)
}
