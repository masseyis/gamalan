pub mod claims;
pub mod jwks;
pub mod organization;
pub mod webhook;

pub use organization::{AuthenticatedWithOrg, ContextType, OrganizationContext};

use crate::claims::Claims;
use crate::jwks::{Jwk, JwksCache};
use axum::{extract::FromRequestParts, http::request::Parts, RequestPartsExt};

use axum_extra::headers::{authorization::Bearer, Authorization};
use axum_extra::TypedHeader;
use common::{error_context::ErrorContext, AppError};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct ApiKeyAuthClaims {
    pub sub: String,
    pub email: Option<String>,
    pub org_id: Option<String>,
    pub org_slug: Option<String>,
    pub org_role: Option<String>,
    pub org_name: Option<String>,
    pub context_type: ContextType,
}

#[derive(Clone)]
pub struct JwtVerifier {
    jwks_cache: JwksCache,
    validation: Validation,
    test_mode: bool,
}

impl JwtVerifier {
    pub fn new(jwks_url: String, issuer: String, audience: Option<String>) -> Self {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[issuer]);

        // Handle audience validation with security-first approach
        match audience {
            Some(aud) if !aud.trim().is_empty() => {
                // Only validate audience if a non-empty audience is explicitly configured
                tracing::debug!("JWT audience validation enabled for: {}", aud);
                validation.set_audience(&[aud]);
            }
            Some(_empty_aud) => {
                // Log warning for empty/whitespace audience configuration
                tracing::warn!("Empty audience string provided - disabling audience validation");
                validation.validate_aud = false;
            }
            None => {
                // No audience configured - disable validation (common for Clerk)
                tracing::debug!("No audience configured - disabling audience validation");
                validation.validate_aud = false;
            }
        }
        validation.leeway = 5;

        Self {
            jwks_cache: JwksCache::new(jwks_url),
            validation,
            test_mode: false,
        }
    }

    /// Creates a test verifier that accepts the token "valid-test-token"
    /// for integration testing purposes. DO NOT use in production.
    pub fn new_test_verifier() -> Self {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = false;
        validation.validate_aud = false;
        validation.validate_nbf = false;

        Self {
            jwks_cache: JwksCache::new("test://invalid".to_string()),
            validation,
            test_mode: true,
        }
    }

    pub async fn verify(&self, token: &str) -> Result<Claims, AppError> {
        self.verify_with_context(token, ErrorContext::new("auth_clerk"))
            .await
    }

    pub async fn verify_with_context(
        &self,
        token: &str,
        context: ErrorContext,
    ) -> Result<Claims, AppError> {
        if self.test_mode && token == "valid-test-token" {
            return Ok(Claims {
                sub: "01234567-89ab-cdef-0123-456789abcdef".to_string(),
                iss: "test-issuer".to_string(),
                aud: None,
                exp: 9999999999,
                iat: 1000000000,
                email: Some("test@example.com".to_string()),
                orgs: Some(vec!["test-org".to_string()]),
                org_id: Some("test-org".to_string()),
                org_slug: Some("test-org".to_string()),
                org_role: Some("owner".to_string()),
                org_name: Some("Test Org".to_string()),
                org: None,
            });
        }
        let header = decode_header(token).map_err(|e| {
            tracing::error!("Failed to decode JWT header: {}", e);
            AppError::UnauthorizedWithContext {
                message: "Invalid JWT token format".to_string(),
                error_code: "INVALID_JWT_FORMAT".to_string(),
                context: Box::new(
                    context
                        .clone()
                        .with_context("jwt_decode_error", e.to_string()),
                ),
            }
        })?;
        let kid = header.kid.ok_or_else(|| {
            tracing::error!("JWT header missing kid claim");
            AppError::UnauthorizedWithContext {
                message: "JWT token missing key ID".to_string(),
                error_code: "MISSING_KID".to_string(),
                context: Box::new(context.clone().with_context("missing_field", "kid")),
            }
        })?;

        let jwk = self.get_jwk_with_context(&kid, context.clone()).await?;

        let decoding_key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e).map_err(|e| {
            tracing::error!("Failed to create RSA decoding key: {}", e);
            AppError::InternalServerErrorWithContext {
                message: "Failed to create JWT decoding key".to_string(),
                source: anyhow::Error::from(e),
                context: Box::new(
                    context
                        .clone()
                        .with_context("operation", "create_decoding_key"),
                ),
            }
        })?;

        // Temporarily decode without validation to see actual claims for debugging
        if self.validation.iss.is_some() {
            let mut debug_validation = self.validation.clone();
            debug_validation.iss = None;
            debug_validation.validate_aud = false;
            debug_validation.validate_exp = false;

            if let Ok(debug_token) = decode::<Claims>(token, &decoding_key, &debug_validation) {
                tracing::info!("JWT token issuer: {}", debug_token.claims.iss);
                tracing::info!("Expected issuer: {:?}", self.validation.iss);
            }
        }

        let token_data = decode::<Claims>(token, &decoding_key, &self.validation).map_err(|e| {
            tracing::error!("Failed to decode JWT token: {}", e);
            let error_code = match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => "TOKEN_EXPIRED",
                jsonwebtoken::errors::ErrorKind::InvalidAudience => "INVALID_AUDIENCE",
                jsonwebtoken::errors::ErrorKind::InvalidIssuer => "INVALID_ISSUER",
                jsonwebtoken::errors::ErrorKind::InvalidSignature => "INVALID_SIGNATURE",
                _ => "TOKEN_VALIDATION_FAILED",
            };
            AppError::UnauthorizedWithContext {
                message: format!("JWT token validation failed: {}", e),
                error_code: error_code.to_string(),
                context: Box::new(
                    context
                        .clone()
                        .with_context("validation_error", e.to_string()),
                ),
            }
        })?;

        Ok(token_data.claims)
    }

    async fn get_jwk_with_context(
        &self,
        kid: &str,
        context: ErrorContext,
    ) -> Result<Jwk, AppError> {
        if let Some(jwk) = self.jwks_cache.get_key(kid).await {
            return Ok(jwk);
        }

        tracing::debug!("Key ID '{}' not in cache, refreshing JWKS", kid);
        self.jwks_cache.refresh().await.map_err(|e| {
            tracing::error!("Failed to refresh JWKS cache: {}", e);
            AppError::ExternalServiceError(format!("Failed to refresh JWKS: {}", e))
        })?;

        self.jwks_cache.get_key(kid).await.ok_or_else(|| {
            tracing::error!("Key ID '{}' not found in JWKS after refresh", kid);
            AppError::UnauthorizedWithContext {
                message: format!("JWT key ID '{}' not found in JWKS", kid),
                error_code: "UNKNOWN_KID".to_string(),
                context: Box::new(context.clone().with_context("kid", kid)),
            }
        })
    }
}

#[derive(Debug, Clone)]
pub struct Authenticated {
    pub sub: String,
    pub email: Option<String>,
    pub orgs: Option<Vec<String>>,
    pub org_id: Option<String>,
    pub org_slug: Option<String>,
    pub org_role: Option<String>,
    pub org_name: Option<String>,
}

impl<S> FromRequestParts<S> for Authenticated
where
    S: Send + Sync,
{
    type Rejection = AppError;

    fn from_request_parts(
        parts: &mut Parts,
        _state: &S,
    ) -> impl std::future::Future<Output = Result<Self, Self::Rejection>> + Send {
        Self::extract_authenticated(parts)
    }
}

impl Authenticated {
    async fn extract_authenticated(parts: &mut Parts) -> Result<Self, AppError> {
        let method = parts.method.clone();
        let uri = parts.uri.clone();
        let _request_id = parts
            .headers
            .get("x-request-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let context =
            ErrorContext::new("auth_clerk").with_request_info(method.to_string(), uri.to_string());

        if let Some(api_claims) = parts.extensions.get::<ApiKeyAuthClaims>() {
            tracing::debug!("Authenticated via API key for user: {}", api_claims.sub);
            return Ok(Authenticated {
                sub: api_claims.sub.clone(),
                email: api_claims.email.clone(),
                orgs: api_claims.org_slug.as_ref().map(|slug| vec![slug.clone()]),
                org_id: api_claims.org_id.clone(),
                org_slug: api_claims.org_slug.clone(),
                org_role: api_claims.org_role.clone(),
                org_name: api_claims.org_name.clone(),
            });
        }

        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|e| {
                tracing::error!("Failed to extract bearer token from request headers: {}", e);
                AppError::UnauthorizedWithContext {
                    message: "Authorization header missing or invalid".to_string(),
                    error_code: "MISSING_AUTH_HEADER".to_string(),
                    context: Box::new(context.clone().with_context("header_error", e.to_string())),
                }
            })?;

        let verifier = parts
            .extract::<axum::Extension<Arc<Mutex<JwtVerifier>>>>()
            .await
            .map_err(|e| {
                tracing::error!(
                    "Failed to extract JWT verifier from request extensions: {}",
                    e
                );
                AppError::InternalServerErrorWithContext {
                    message: "JWT verifier not configured".to_string(),
                    source: anyhow::Error::from(e),
                    context: Box::new(
                        context
                            .clone()
                            .with_context("configuration_error", "jwt_verifier_missing"),
                    ),
                }
            })?;

        let claims = verifier
            .lock()
            .await
            .verify_with_context(bearer.token(), context.clone())
            .await?;

        tracing::debug!("Successfully authenticated user: {}", claims.sub);

        let org_id = claims
            .org_id
            .clone()
            .or_else(|| claims.org.as_ref().and_then(|o| o.id.clone()));
        let org_slug = claims
            .org_slug
            .clone()
            .or_else(|| claims.org.as_ref().and_then(|o| o.slug.clone()));
        let org_role = claims
            .org_role
            .clone()
            .or_else(|| claims.org.as_ref().and_then(|o| o.role.clone()));
        let org_name = claims
            .org_name
            .clone()
            .or_else(|| claims.org.as_ref().and_then(|o| o.name.clone()));

        Ok(Authenticated {
            sub: claims.sub,
            email: claims.email,
            orgs: claims.orgs,
            org_id,
            org_slug,
            org_role,
            org_name,
        })
    }
}
