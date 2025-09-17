use axum::{extract::FromRequestParts, http::request::Parts};
use common::AppError;
use uuid::Uuid;

/// Organization context extracted from request headers
#[derive(Debug, Clone)]
pub struct OrganizationContext {
    pub organization_id: Option<String>,
    pub user_id: Option<String>,
    pub context_type: ContextType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ContextType {
    Organization,
    Personal,
}

impl OrganizationContext {
    /// Create organization context from headers
    pub fn from_headers(
        org_id_header: Option<&str>,
        user_id_header: Option<&str>,
        context_type_header: Option<&str>,
    ) -> Self {
        let context_type = match context_type_header {
            Some("organization") => ContextType::Organization,
            Some("personal") => ContextType::Personal,
            _ => {
                // Default to personal if no valid context type
                ContextType::Personal
            }
        };

        Self {
            organization_id: org_id_header.map(|s| s.to_string()),
            user_id: user_id_header.map(|s| s.to_string()),
            context_type,
        }
    }

    /// Get the organization ID as UUID if available
    pub fn organization_uuid(&self) -> Option<Uuid> {
        self.organization_id
            .as_ref()
            .and_then(|id| Uuid::parse_str(id).ok())
    }

    /// Get the user ID as UUID if available
    pub fn user_uuid(&self) -> Option<Uuid> {
        self.user_id
            .as_ref()
            .and_then(|id| Uuid::parse_str(id).ok())
    }

    /// Check if this is an organization context
    pub fn is_organization(&self) -> bool {
        self.context_type == ContextType::Organization
    }

    /// Check if this is a personal context
    pub fn is_personal(&self) -> bool {
        self.context_type == ContextType::Personal
    }

    /// Get the effective organization ID for database filtering
    /// Returns the organization ID if in organization context, None for personal
    pub fn effective_organization_id(&self) -> Option<String> {
        if self.is_organization() {
            self.organization_id.clone()
        } else {
            None
        }
    }

    /// Get the effective organization UUID for database filtering
    pub fn effective_organization_uuid(&self) -> Option<Uuid> {
        self.effective_organization_id()
            .and_then(|id| Uuid::parse_str(&id).ok())
    }
}

impl<S> FromRequestParts<S> for OrganizationContext
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let org_id = parts
            .headers
            .get("x-organization-id")
            .and_then(|v| v.to_str().ok());

        let user_id = parts.headers.get("x-user-id").and_then(|v| v.to_str().ok());

        let context_type = parts
            .headers
            .get("x-context-type")
            .and_then(|v| v.to_str().ok());

        Ok(OrganizationContext::from_headers(
            org_id,
            user_id,
            context_type,
        ))
    }
}

/// Authentication with organization context
#[derive(Debug, Clone)]
pub struct AuthenticatedWithOrg {
    pub auth: super::Authenticated,
    pub org_context: OrganizationContext,
}

impl<S> FromRequestParts<S> for AuthenticatedWithOrg
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth = super::Authenticated::from_request_parts(parts, state).await?;
        let org_context = OrganizationContext::from_request_parts(parts, state).await?;

        Ok(AuthenticatedWithOrg { auth, org_context })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_organization_context_from_headers() {
        // Test organization context
        let org_ctx = OrganizationContext::from_headers(
            Some("org_123"),
            Some("user_456"),
            Some("organization"),
        );
        assert_eq!(org_ctx.organization_id, Some("org_123".to_string()));
        assert_eq!(org_ctx.user_id, Some("user_456".to_string()));
        assert_eq!(org_ctx.context_type, ContextType::Organization);
        assert!(org_ctx.is_organization());
        assert!(!org_ctx.is_personal());

        // Test personal context
        let personal_ctx =
            OrganizationContext::from_headers(None, Some("user_456"), Some("personal"));
        assert_eq!(personal_ctx.organization_id, None);
        assert_eq!(personal_ctx.user_id, Some("user_456".to_string()));
        assert_eq!(personal_ctx.context_type, ContextType::Personal);
        assert!(!personal_ctx.is_organization());
        assert!(personal_ctx.is_personal());

        // Test default to personal
        let default_ctx =
            OrganizationContext::from_headers(None, Some("user_456"), Some("invalid"));
        assert_eq!(default_ctx.context_type, ContextType::Personal);
    }

    #[test]
    fn test_effective_organization_id() {
        // Organization context should return the org ID
        let org_ctx = OrganizationContext::from_headers(
            Some("org_123"),
            Some("user_456"),
            Some("organization"),
        );
        assert_eq!(
            org_ctx.effective_organization_id(),
            Some("org_123".to_string())
        );

        // Personal context should return None
        let personal_ctx =
            OrganizationContext::from_headers(None, Some("user_456"), Some("personal"));
        assert_eq!(personal_ctx.effective_organization_id(), None);
    }

    #[test]
    fn test_uuid_parsing() {
        let valid_uuid = "550e8400-e29b-41d4-a716-446655440000";
        let ctx = OrganizationContext::from_headers(
            Some(valid_uuid),
            Some(valid_uuid),
            Some("organization"),
        );

        assert!(ctx.organization_uuid().is_some());
        assert!(ctx.user_uuid().is_some());
        assert!(ctx.effective_organization_uuid().is_some());

        // Test invalid UUID
        let invalid_ctx = OrganizationContext::from_headers(
            Some("invalid-uuid"),
            Some("invalid-uuid"),
            Some("organization"),
        );
        assert!(invalid_ctx.organization_uuid().is_none());
        assert!(invalid_ctx.user_uuid().is_none());
    }
}
