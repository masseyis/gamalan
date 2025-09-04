use std::fmt;
use tracing::Span;
use uuid::Uuid;

/// Enhanced error context that captures request and system state information
#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub request_id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub service_name: String,
    pub endpoint: Option<String>,
    pub method: Option<String>,
    pub user_id: Option<String>,
    pub trace_id: Option<String>,
    pub additional_context: std::collections::HashMap<String, String>,
}

impl ErrorContext {
    pub fn new(service_name: impl Into<String>) -> Self {
        Self {
            request_id: Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now(),
            service_name: service_name.into(),
            endpoint: None,
            method: None,
            user_id: None,
            trace_id: None,
            additional_context: std::collections::HashMap::new(),
        }
    }

    pub fn with_request_info(
        mut self,
        method: impl Into<String>,
        endpoint: impl Into<String>,
    ) -> Self {
        self.method = Some(method.into());
        self.endpoint = Some(endpoint.into());
        self
    }

    pub fn with_user_id(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    pub fn with_trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = Some(trace_id.into());
        self
    }

    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.additional_context.insert(key.into(), value.into());
        self
    }

    pub fn add_to_span(&self, span: &Span) {
        span.record("request_id", &self.request_id);
        span.record("service", &self.service_name);

        if let Some(ref endpoint) = self.endpoint {
            span.record("endpoint", endpoint);
        }

        if let Some(ref method) = self.method {
            span.record("method", method);
        }

        if let Some(ref user_id) = self.user_id {
            span.record("user_id", user_id);
        }

        if let Some(ref trace_id) = self.trace_id {
            span.record("trace_id", trace_id);
        }
    }
}

impl fmt::Display for ErrorContext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "RequestID: {} | Service: {} | Time: {}",
            self.request_id, self.service_name, self.timestamp
        )
    }
}

/// Extension trait to add context to any Result
pub trait ResultExt<T, E> {
    fn with_error_context(self, ctx: ErrorContext) -> Result<T, crate::AppError>;
    fn with_context_msg(self, ctx: ErrorContext, msg: &str) -> Result<T, crate::AppError>;
}

impl<T, E> ResultExt<T, E> for Result<T, E>
where
    E: Into<anyhow::Error> + Send + Sync + 'static,
{
    fn with_error_context(self, ctx: ErrorContext) -> Result<T, crate::AppError> {
        self.map_err(|e| {
            let error: anyhow::Error = e.into();
            crate::AppError::InternalServerErrorWithContext {
                message: error.to_string(),
                context: Box::new(ctx),
                source: error,
            }
        })
    }

    fn with_context_msg(self, ctx: ErrorContext, msg: &str) -> Result<T, crate::AppError> {
        self.map_err(|e| {
            let error: anyhow::Error = e.into();
            let error_with_context = error.context(msg.to_string());
            crate::AppError::InternalServerErrorWithContext {
                message: msg.to_string(),
                context: Box::new(ctx),
                source: error_with_context,
            }
        })
    }
}

impl Default for ErrorContext {
    fn default() -> Self {
        Self::new("unknown")
    }
}
