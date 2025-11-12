use auth_clerk::{ApiKeyAuthClaims, ContextType};
use axum::{
    body::Body,
    extract::State,
    http::{HeaderValue, Request},
    middleware::Next,
};
use common::{error_context::ErrorContext, AppError};
use sqlx::{PgPool, Row};
use std::sync::Arc;

#[derive(Clone)]
pub struct ApiKeyState {
    pool: Arc<PgPool>,
}

impl ApiKeyState {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

pub async fn api_key_auth(
    State(state): State<ApiKeyState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<axum::response::Response, AppError> {
    maybe_inject_org_id(&mut req, state.pool()).await?;

    if let Some(key) = extract_api_key(&req) {
        let record = lookup_api_key(state.pool(), key).await?;

        // Set contextual headers so downstream organization extractor works.
        req.headers_mut().insert(
            "x-user-id",
            HeaderValue::from_str(&record.user_id).map_err(|_| AppError::InternalServerError)?,
        );

        let context_value = if record.organization_id.is_some() {
            "organization"
        } else {
            "personal"
        };
        req.headers_mut()
            .insert("x-context-type", HeaderValue::from_static(context_value));

        if let Some(org_id) = record.organization_id.as_deref() {
            req.headers_mut().insert(
                "x-organization-id",
                HeaderValue::from_str(org_id).map_err(|_| AppError::InternalServerError)?,
            );
        }

        if let Some(org_external_id) = record.organization_external_id.as_deref() {
            req.headers_mut().insert(
                "x-organization-external-id",
                HeaderValue::from_str(org_external_id)
                    .map_err(|_| AppError::InternalServerError)?,
            );
        }

        if let Some(org_name) = record.organization_name.as_deref() {
            req.headers_mut().insert(
                "x-organization-name",
                HeaderValue::from_str(org_name).map_err(|_| AppError::InternalServerError)?,
            );
        }

        // Make the resolved claims available to the downstream extractor.
        req.extensions_mut().insert(ApiKeyAuthClaims {
            sub: record.user_external_id.clone(),
            email: record.email.clone(),
            org_id: record.organization_id.clone(),
            org_slug: record.organization_external_id.clone(),
            org_role: Some(record.organization_role.clone()),
            org_name: record.organization_name.clone(),
            context_type: if record.organization_id.is_some() {
                ContextType::Organization
            } else {
                ContextType::Personal
            },
        });
    }

    Ok(next.run(req).await)
}

fn extract_api_key<B>(req: &Request<B>) -> Option<&str> {
    if let Some(value) = req.headers().get("x-api-key") {
        if let Ok(key) = value.to_str() {
            if !key.trim().is_empty() {
                return Some(key);
            }
        }
    }

    if let Some(value) = req.headers().get("authorization") {
        if let Ok(raw) = value.to_str() {
            if let Some(stripped) = raw.strip_prefix("ApiKey ") {
                let trimmed = stripped.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
    }

    None
}

struct ApiKeyRecord {
    user_id: String,
    user_external_id: String,
    email: Option<String>,
    organization_id: Option<String>,
    organization_external_id: Option<String>,
    organization_name: Option<String>,
    organization_role: String,
}

async fn lookup_api_key(pool: &PgPool, token: &str) -> Result<ApiKeyRecord, AppError> {
    let context = ErrorContext::new("api_key_auth");
    let record = sqlx::query(
        r#"
        SELECT
            api_keys.user_id,
            users.external_id AS user_external_id,
            users.email,
            api_keys.organization_id,
            organizations.external_id AS organization_external_id,
            organizations.name AS organization_name,
            COALESCE(organization_memberships.role, 'member') AS organization_role
        FROM api_keys
        JOIN users ON users.id = api_keys.user_id
        LEFT JOIN organizations ON organizations.id = api_keys.organization_id
        LEFT JOIN organization_memberships
            ON organization_memberships.organization_id = api_keys.organization_id
           AND organization_memberships.user_id = api_keys.user_id
        WHERE api_keys.token = $1
        "#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::DatabaseError {
        message: e.to_string(),
        operation: "lookup_api_key".to_string(),
        context: Box::new(context.clone().with_context("query", "lookup_api_key")),
    })?;

    if let Some(row) = record {
        sqlx::query("UPDATE api_keys SET last_used_at = NOW() WHERE token = $1")
            .bind(token)
            .execute(pool)
            .await
            .map_err(|e| AppError::DatabaseError {
                message: e.to_string(),
                operation: "update_api_key_last_used".to_string(),
                context: Box::new(context.clone().with_context("query", "update_last_used")),
            })?;

        let user_id: uuid::Uuid = row
            .try_get("user_id")
            .map_err(|e| AppError::DatabaseError {
                message: e.to_string(),
                operation: "lookup_api_key".to_string(),
                context: Box::new(context.clone().with_context("column", "user_id")),
            })?;
        let user_external_id: String =
            row.try_get("user_external_id")
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                    operation: "lookup_api_key".to_string(),
                    context: Box::new(context.clone().with_context("column", "user_external_id")),
                })?;
        let email: Option<String> = row.try_get("email").map_err(|e| AppError::DatabaseError {
            message: e.to_string(),
            operation: "lookup_api_key".to_string(),
            context: Box::new(context.clone().with_context("column", "email")),
        })?;
        let organization_id: Option<uuid::Uuid> =
            row.try_get("organization_id")
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                    operation: "lookup_api_key".to_string(),
                    context: Box::new(context.clone().with_context("column", "organization_id")),
                })?;
        let organization_external_id: Option<String> = row
            .try_get("organization_external_id")
            .map_err(|e| AppError::DatabaseError {
                message: e.to_string(),
                operation: "lookup_api_key".to_string(),
                context: Box::new(
                    context
                        .clone()
                        .with_context("column", "organization_external_id"),
                ),
            })?;
        let organization_name: Option<String> =
            row.try_get("organization_name")
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                    operation: "lookup_api_key".to_string(),
                    context: Box::new(context.clone().with_context("column", "organization_name")),
                })?;
        let organization_role: Option<String> =
            row.try_get("organization_role")
                .map_err(|e| AppError::DatabaseError {
                    message: e.to_string(),
                    operation: "lookup_api_key".to_string(),
                    context: Box::new(context.clone().with_context("column", "organization_role")),
                })?;

        return Ok(ApiKeyRecord {
            user_id: user_id.to_string(),
            user_external_id,
            email,
            organization_id: organization_id.map(|id| id.to_string()),
            organization_external_id,
            organization_name,
            organization_role: organization_role.unwrap_or_else(|| "member".to_string()),
        });
    }

    Err(AppError::Unauthorized("Invalid API key".to_string()))
}

async fn maybe_inject_org_id(req: &mut Request<Body>, pool: &PgPool) -> Result<(), AppError> {
    let has_org_id = req.headers().contains_key("x-organization-id");
    if has_org_id {
        return Ok(());
    }

    let external = req
        .headers()
        .get("x-organization-external-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());

    if let Some(external_id) = external {
        if let Some(record) = lookup_org_by_external_id(pool, external_id).await? {
            req.headers_mut().insert(
                "x-organization-id",
                HeaderValue::from_str(&record.id).map_err(|_| AppError::InternalServerError)?,
            );

            if !req.headers().contains_key("x-organization-name") {
                if let Some(name) = record.name {
                    req.headers_mut().insert(
                        "x-organization-name",
                        HeaderValue::from_str(&name).map_err(|_| AppError::InternalServerError)?,
                    );
                }
            }

            if !req.headers().contains_key("x-context-type") {
                req.headers_mut()
                    .insert("x-context-type", HeaderValue::from_static("organization"));
            }
        }
    }

    Ok(())
}

async fn lookup_org_by_external_id(
    pool: &PgPool,
    external_id: &str,
) -> Result<Option<OrgRecord>, AppError> {
    let record = sqlx::query("SELECT id::text, name FROM organizations WHERE external_id = $1")
        .bind(external_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::DatabaseError {
            message: e.to_string(),
            operation: "lookup_org_by_external_id".to_string(),
            context: Box::new(ErrorContext::new("api_key_auth")),
        })?;

    Ok(record.map(|row| OrgRecord {
        id: row.try_get::<String, _>("id").unwrap_or_default(),
        name: row.try_get::<Option<String>, _>("name").unwrap_or(None),
    }))
}

struct OrgRecord {
    id: String,
    name: Option<String>,
}
