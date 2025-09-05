pub mod claims;
pub mod jwks;

use crate::claims::Claims;
use crate::jwks::{Jwk, JwksCache};
use axum::{extract::FromRequestParts, http::request::Parts, RequestPartsExt};

use axum_extra::headers::{authorization::Bearer, Authorization};
use axum_extra::TypedHeader;
use common::{error_context::ErrorContext, AppError};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use std::sync::Arc;
use tokio::sync::Mutex;

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

        // Only set audience validation if an audience is provided
        if let Some(aud) = audience {
            validation.set_audience(&[aud]);
        } else {
            // Disable audience validation since Clerk doesn't include aud by default
            validation.validate_aud = false;
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
                sub: "test-user".to_string(),
                iss: "test-issuer".to_string(),
                aud: None,
                exp: 9999999999,
                iat: 1000000000,
                email: Some("test@example.com".to_string()),
                orgs: Some(vec!["test-org".to_string()]),
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
        Ok(Authenticated {
            sub: claims.sub,
            email: claims.email,
            orgs: claims.orgs,
        })
    }
}
