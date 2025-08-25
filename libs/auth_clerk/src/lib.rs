pub mod claims;
pub mod jwks;

use crate::claims::Claims;
use crate::jwks::{Jwk, JwksCache};
use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::request::Parts,
    RequestPartsExt,
};

use axum_extra::TypedHeader;
use axum_extra::headers::{authorization::Bearer, Authorization};
use common::AppError;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct JwtVerifier {
    jwks_cache: JwksCache,
    validation: Validation,
}

impl JwtVerifier {
    pub fn new(jwks_url: String, issuer: String, audience: String) -> Self {
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[issuer]);
        validation.set_audience(&[audience]);
        validation.leeway = 5;

        Self {
            jwks_cache: JwksCache::new(jwks_url),
            validation,
        }
    }

    pub async fn verify(&self, token: &str) -> Result<Claims, AppError> {
        let header = decode_header(token).map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;
        let kid = header.kid.ok_or_else(|| AppError::Unauthorized("Missing kid".to_string()))?;

        let jwk = self.get_jwk(&kid).await?;

        let decoding_key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
            .map_err(|_| AppError::InternalServerError)?;

        let token_data = decode::<Claims>(token, &decoding_key, &self.validation)
            .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

        Ok(token_data.claims)
    }

    async fn get_jwk(&self, kid: &str) -> Result<Jwk, AppError> {
        if let Some(jwk) = self.jwks_cache.get_key(kid).await {
            return Ok(jwk);
        }

        self.jwks_cache.refresh().await.map_err(|_| AppError::InternalServerError)?;

        self.jwks_cache.get_key(kid).await.ok_or_else(|| AppError::Unauthorized("Unknown kid".to_string()))
    }
}

#[derive(Debug, Clone)]
pub struct Authenticated {
    pub sub: String,
    pub email: Option<String>,
    pub orgs: Option<Vec<String>>,
}

#[async_trait]
impl<S> FromRequestParts<S> for Authenticated
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AppError::Unauthorized("Missing bearer token".to_string()))?;

        let verifier = parts
            .extract::<axum::Extension<Arc<Mutex<JwtVerifier>>>>()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        let claims = verifier.lock().await.verify(bearer.token()).await?;

        Ok(Authenticated {
            sub: claims.sub,
            email: claims.email,
            orgs: claims.orgs,
        })
    }
}