use base64::{engine::general_purpose, Engine as _};
use common::{error_context::ErrorContext, AppError};
use ring::hmac;
use std::collections::HashMap;
use subtle::ConstantTimeEq;

/// Clerk webhook signature validator
/// Validates that incoming webhook requests are actually from Clerk
#[derive(Clone)]
pub struct WebhookValidator {
    secret: Option<String>,
}

impl WebhookValidator {
    /// Create a new webhook validator with the given secret
    pub fn new(secret: Option<String>) -> Self {
        Self { secret }
    }

    /// Create a test validator that accepts any signature (for testing only)
    pub fn new_test_validator() -> Self {
        Self { secret: None }
    }

    /// Maximum size for webhook signature header to prevent DoS attacks
    const MAX_SIGNATURE_HEADER_SIZE: usize = 4096;
    /// Maximum number of signature versions to prevent resource exhaustion
    const MAX_SIGNATURE_VERSIONS: usize = 10;
    /// Maximum size for webhook payload to prevent memory exhaustion
    const MAX_PAYLOAD_SIZE: usize = 1024 * 1024; // 1MB

    /// Validate a webhook signature against the payload
    pub fn validate_signature(
        &self,
        payload: &[u8],
        signature_header: &str,
        context: ErrorContext,
    ) -> Result<(), AppError> {
        // Prevent DoS attacks via oversized inputs
        if signature_header.len() > Self::MAX_SIGNATURE_HEADER_SIZE {
            tracing::warn!(
                "Webhook signature header too large: {} bytes",
                signature_header.len()
            );
            return Err(AppError::UnauthorizedWithContext {
                message: "Signature header too large".to_string(),
                error_code: "SIGNATURE_HEADER_TOO_LARGE".to_string(),
                context: Box::new(
                    context.with_context("header_size", signature_header.len().to_string()),
                ),
            });
        }

        if payload.len() > Self::MAX_PAYLOAD_SIZE {
            tracing::warn!("Webhook payload too large: {} bytes", payload.len());
            return Err(AppError::UnauthorizedWithContext {
                message: "Payload too large".to_string(),
                error_code: "PAYLOAD_TOO_LARGE".to_string(),
                context: Box::new(context.with_context("payload_size", payload.len().to_string())),
            });
        }
        // If no secret is configured, we can't validate - this should fail
        let secret = self
            .secret
            .as_ref()
            .filter(|s| !s.trim().is_empty()) // Filter out empty or whitespace-only secrets
            .ok_or_else(|| {
                tracing::error!("Webhook secret not configured or is empty/whitespace");
                AppError::InternalServerErrorWithContext {
                    message: "Webhook validation not properly configured".to_string(),
                    source: anyhow::Error::msg("CLERK_WEBHOOK_SECRET is empty or not set"),
                    context: Box::new(
                        context
                            .clone()
                            .with_context("config_error", "missing_webhook_secret"),
                    ),
                }
            })?;

        // Parse signature headers (format: "svix-signature: v1=hash1,v2=hash2")
        let signatures = self.parse_signature_header(signature_header, context.clone())?;

        // Verify at least one signature matches
        for (version, provided_sig) in signatures {
            if version == "v1" {
                let expected_sig = self.compute_signature_v1(payload, secret);
                if self.constant_time_eq(&provided_sig, &expected_sig) {
                    return Ok(());
                }
            }
        }

        Err(AppError::UnauthorizedWithContext {
            message: "Invalid webhook signature".to_string(),
            error_code: "INVALID_WEBHOOK_SIGNATURE".to_string(),
            context: Box::new(context.with_context("validation_error", "signature_mismatch")),
        })
    }

    fn parse_signature_header(
        &self,
        header: &str,
        context: ErrorContext,
    ) -> Result<HashMap<String, Vec<u8>>, AppError> {
        let mut signatures = HashMap::new();
        let mut decode_errors = Vec::new();
        let mut signature_count = 0;

        tracing::debug!("Parsing signature header: {}", header);

        for part in header.split(',') {
            signature_count += 1;
            if signature_count > Self::MAX_SIGNATURE_VERSIONS {
                tracing::warn!("Too many signature versions in header: {}", signature_count);
                return Err(AppError::UnauthorizedWithContext {
                    message: "Too many signature versions".to_string(),
                    error_code: "TOO_MANY_SIGNATURES".to_string(),
                    context: Box::new(
                        context.with_context("signature_count", signature_count.to_string()),
                    ),
                });
            }
            let trimmed_part = part.trim();

            // Split only on the first '=' to handle base64 padding
            if let Some(equals_pos) = trimmed_part.find('=') {
                let version = &trimmed_part[..equals_pos];
                let sig_b64 = &trimmed_part[equals_pos + 1..];
                tracing::debug!(
                    "Version: '{}', Signature length: {}",
                    version,
                    sig_b64.len()
                );

                let sig_bytes = match general_purpose::STANDARD.decode(sig_b64) {
                    Ok(bytes) => {
                        tracing::debug!("Successfully decoded signature for version '{}'", version);
                        bytes
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Failed to decode signature for version '{}': {}",
                            version,
                            e
                        );
                        decode_errors.push((version.to_string(), e.to_string()));
                        continue;
                    }
                };

                signatures.insert(version.to_string(), sig_bytes);
            } else {
                tracing::debug!("Skipping part with no '=' separator: '{}'", trimmed_part);
            }
        }

        tracing::debug!("Found {} valid signatures", signatures.len());

        if signatures.is_empty() {
            // If we have decode errors but no valid signatures, return format error
            if !decode_errors.is_empty() {
                let error_details = decode_errors
                    .iter()
                    .map(|(version, error)| format!("{}:{}", version, error))
                    .collect::<Vec<_>>()
                    .join(", ");

                return Err(AppError::UnauthorizedWithContext {
                    message: "Invalid signature encoding".to_string(),
                    error_code: "INVALID_SIGNATURE_FORMAT".to_string(),
                    context: Box::new(context.clone().with_context("decode_errors", error_details)),
                });
            }

            // Otherwise it's missing signature
            return Err(AppError::UnauthorizedWithContext {
                message: "No valid signatures found in header".to_string(),
                error_code: "MISSING_SIGNATURE".to_string(),
                context: Box::new(context.with_context("header_value", header)),
            });
        }

        Ok(signatures)
    }

    fn compute_signature_v1(&self, payload: &[u8], secret: &str) -> Vec<u8> {
        let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
        let signature = hmac::sign(&key, payload);
        signature.as_ref().to_vec()
    }

    fn constant_time_eq(&self, a: &[u8], b: &[u8]) -> bool {
        // Use cryptographically secure constant-time comparison from subtle crate
        // This prevents timing attacks that could leak signature information
        a.ct_eq(b).into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_webhook_validator_creation_with_secret() {
        let validator = WebhookValidator::new(Some("test-secret".to_string()));
        assert!(validator.secret.is_some());
    }

    #[test]
    fn test_webhook_validator_creation_without_secret() {
        let validator = WebhookValidator::new(None);
        assert!(validator.secret.is_none());
    }
}
