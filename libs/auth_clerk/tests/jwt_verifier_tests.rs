use auth_clerk::{claims::Claims, JwtVerifier};
use base64::{engine::general_purpose, Engine as _};
use jsonwebtoken::{encode, EncodingKey, Header};
use mockito::Server;
use rsa::pkcs1::EncodeRsaPrivateKey;
use rsa::traits::PublicKeyParts;
use rsa::{RsaPrivateKey, RsaPublicKey};
use serde_json::json;

struct TestJwtSetup {
    private_key: RsaPrivateKey,
    public_key: RsaPublicKey,
    kid: String,
    issuer: String,
    #[allow(dead_code)]
    audience: Option<String>,
}

impl TestJwtSetup {
    fn new() -> Self {
        let mut rng = rsa::rand_core::OsRng;
        let bits = 2048;
        let private_key = RsaPrivateKey::new(&mut rng, bits).expect("Failed to generate key");
        let public_key = RsaPublicKey::from(&private_key);

        Self {
            private_key,
            public_key,
            kid: "test-key-id".to_string(),
            issuer: "https://test-issuer.clerk.dev".to_string(),
            audience: Some("test-audience".to_string()),
        }
    }

    fn jwks_json(&self) -> serde_json::Value {
        let n = general_purpose::URL_SAFE_NO_PAD.encode(self.public_key.n().to_bytes_be());
        let e = general_purpose::URL_SAFE_NO_PAD.encode(self.public_key.e().to_bytes_be());

        json!({
            "keys": [{
                "kid": self.kid,
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "n": n,
                "e": e
            }]
        })
    }

    fn create_token_with_claims(&self, claims: &Claims) -> String {
        let mut header = Header::new(jsonwebtoken::Algorithm::RS256);
        header.kid = Some(self.kid.clone());

        let encoding_key =
            EncodingKey::from_rsa_der(self.private_key.to_pkcs1_der().unwrap().as_bytes());
        encode(&header, claims, &encoding_key).expect("Failed to encode token")
    }

    fn create_token_without_aud(&self) -> String {
        let claims = Claims {
            iss: self.issuer.clone(),
            sub: "user123".to_string(),
            aud: None, // This is the key - no 'aud' field
            exp: 9999999999,
            iat: 1000000000,
            email: Some("test@example.com".to_string()),
            orgs: Some(vec!["org123".to_string()]),
            org_id: Some("org_123".to_string()),
            org_slug: Some("org-123".to_string()),
            org_role: Some("admin".to_string()),
            org_name: Some("Test Org".to_string()),
            org: None,
        };
        self.create_token_with_claims(&claims)
    }

    fn create_token_with_aud(&self, aud: &str) -> String {
        let claims = Claims {
            iss: self.issuer.clone(),
            sub: "user123".to_string(),
            aud: Some(aud.to_string()),
            exp: 9999999999,
            iat: 1000000000,
            email: Some("test@example.com".to_string()),
            orgs: Some(vec!["org123".to_string()]),
            org_id: Some("org_123".to_string()),
            org_slug: Some("org-123".to_string()),
            org_role: Some("admin".to_string()),
            org_name: Some("Test Org".to_string()),
            org: None,
        };
        self.create_token_with_claims(&claims)
    }
}

async fn setup_mock_jwks_server(setup: &TestJwtSetup) -> (mockito::ServerGuard, String) {
    let mut server = Server::new_async().await;
    let jwks_url = format!("{}/jwks", server.url());

    server
        .mock("GET", "/jwks")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(setup.jwks_json().to_string())
        .create_async()
        .await;

    (server, jwks_url)
}

// ================================
// FAILING TESTS FOR JWT WITHOUT 'AUD' FIELD
// ================================

#[tokio::test]
async fn test_jwt_validation_without_aud_field_with_audience_configured_should_fail() {
    // FAILING TEST: When audience is configured but JWT has no 'aud' field
    // This simulates the production error where Clerk JWT doesn't include 'aud'
    // but verifier is configured with an audience expectation

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    // Create verifier WITH audience configured
    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("expected-audience".to_string()),
    );

    // Create token WITHOUT 'aud' field (as Clerk does)
    let token = setup.create_token_without_aud();

    let result = verifier.verify(&token).await;

    // This test SHOULD FAIL initially - current implementation will fail with missing 'aud'
    // After fix: should succeed because verifier should handle missing 'aud' gracefully
    assert!(result.is_ok(), "JWT without 'aud' field should be valid when 'aud' validation is disabled for missing field");

    let claims = result.unwrap();
    assert_eq!(claims.sub, "user123");
    assert_eq!(claims.aud, None);
}

#[tokio::test]
async fn test_jwt_validation_without_aud_field_no_audience_configured_should_succeed() {
    // FAILING TEST: When no audience is configured and JWT has no 'aud' field
    // This should work but let's verify the current behavior

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    // Create verifier WITHOUT audience configured
    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        None, // No audience configured
    );

    // Create token WITHOUT 'aud' field
    let token = setup.create_token_without_aud();

    let result = verifier.verify(&token).await;

    // This should succeed - both sides have no audience expectation
    assert!(
        result.is_ok(),
        "JWT without 'aud' field should be valid when no audience is configured"
    );

    let claims = result.unwrap();
    assert_eq!(claims.sub, "user123");
    assert_eq!(claims.aud, None);
}

#[tokio::test]
async fn test_jwt_with_wrong_audience_should_fail() {
    // Control test: JWT with wrong audience should still fail appropriately

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("expected-audience".to_string()),
    );

    // Create token with WRONG audience
    let token = setup.create_token_with_aud("wrong-audience");

    let result = verifier.verify(&token).await;

    assert!(result.is_err(), "JWT with wrong audience should fail");

    let error = result.unwrap_err();
    // Should be INVALID_AUDIENCE error code
    match error {
        common::AppError::UnauthorizedWithContext { error_code, .. } => {
            assert_eq!(error_code, "INVALID_AUDIENCE");
        }
        _ => panic!("Expected UnauthorizedWithContext with INVALID_AUDIENCE error code"),
    }
}

#[tokio::test]
async fn test_jwt_with_correct_audience_should_succeed() {
    // Control test: JWT with correct audience should succeed

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("correct-audience".to_string()),
    );

    // Create token with CORRECT audience
    let token = setup.create_token_with_aud("correct-audience");

    let result = verifier.verify(&token).await;

    assert!(result.is_ok(), "JWT with correct audience should succeed");

    let claims = result.unwrap();
    assert_eq!(claims.sub, "user123");
    assert_eq!(claims.aud, Some("correct-audience".to_string()));
}

// ================================
// FAILING TESTS FOR EMPTY/MISSING AUDIENCE CONFIGURATION
// ================================

#[tokio::test]
async fn test_verifier_creation_with_empty_audience_string() {
    // FAILING TEST: What happens when audience is empty string instead of None?
    // This might happen in configuration where env var is set but empty

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    // Create verifier with empty string audience - this is a common config mistake
    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("".to_string()), // Empty audience string
    );

    let token = setup.create_token_without_aud();

    let result = verifier.verify(&token).await;

    // This test might FAIL initially - empty string audience validation behavior is undefined
    // After fix: should handle empty string audience gracefully (treat as None)
    assert!(
        result.is_ok(),
        "JWT should be valid when audience is empty string"
    );
}

#[tokio::test]
async fn test_verifier_creation_with_whitespace_audience() {
    // FAILING TEST: What happens with whitespace-only audience?

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("   ".to_string()), // Whitespace-only audience
    );

    let token = setup.create_token_without_aud();

    let result = verifier.verify(&token).await;

    // Should handle whitespace gracefully
    assert!(
        result.is_ok(),
        "JWT should be valid when audience is whitespace-only"
    );
}

// ================================
// ERROR HANDLING AND EDGE CASES
// ================================

#[tokio::test]
async fn test_detailed_error_context_for_missing_aud() {
    // FAILING TEST: Verify error context is helpful for debugging

    let setup = TestJwtSetup::new();
    let (_server, jwks_url) = setup_mock_jwks_server(&setup).await;

    let verifier = JwtVerifier::new(
        jwks_url,
        setup.issuer.clone(),
        Some("expected-audience".to_string()),
    );

    let token = setup.create_token_without_aud();

    let result = verifier.verify(&token).await;

    // Initially this will fail, but after fix should succeed
    // If it does fail, let's check the error details
    if let Err(error) = result {
        match error {
            common::AppError::UnauthorizedWithContext {
                message,
                error_code,
                context,
            } => {
                println!("Error message: {}", message);
                println!("Error code: {}", error_code);
                println!("Context: {:?}", context);

                // Should NOT be a JSON parsing error - that's the wrong error type
                assert_ne!(
                    error_code, "TOKEN_VALIDATION_FAILED",
                    "Should not fail with JSON parsing error for missing 'aud' field"
                );
            }
            _ => panic!("Unexpected error type: {:?}", error),
        }

        // This assertion will make the test fail initially
        panic!("JWT validation should succeed for missing 'aud' when handled gracefully");
    }
}

// ================================
// BASIC FUNCTIONALITY TESTS (SHOULD PASS)
// ================================

#[tokio::test]
async fn test_jwt_verifier_creation() {
    // Basic test that should continue to work
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let _verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));
    // Should not panic
}

#[tokio::test]
async fn test_jwt_verifier_with_invalid_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    let result = verifier.verify("invalid.token.here").await;
    assert!(result.is_err(), "Invalid token should return an error");
}

#[tokio::test]
async fn test_jwt_verifier_with_malformed_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    let result = verifier.verify("malformed").await;
    assert!(result.is_err(), "Malformed token should return an error");
}

#[tokio::test]
async fn test_jwt_verifier_with_empty_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    let result = verifier.verify("").await;
    assert!(result.is_err(), "Empty token should return an error");
}
