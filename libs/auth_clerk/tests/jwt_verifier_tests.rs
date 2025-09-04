use auth_clerk::JwtVerifier;

#[tokio::test]
async fn test_jwt_verifier_creation() {
    // Test that the verifier can be created with valid parameters
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let _verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    // This test just verifies that we can create a verifier without panicking
    // The JwtVerifier struct should be created successfully
}

#[tokio::test]
async fn test_jwt_verifier_with_invalid_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    // Test with an obviously invalid token
    let result = verifier.verify("invalid.token.here").await;
    assert!(result.is_err(), "Invalid token should return an error");
}

#[tokio::test]
async fn test_jwt_verifier_with_malformed_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    // Test with a malformed JWT (not enough parts)
    let result = verifier.verify("malformed").await;
    assert!(result.is_err(), "Malformed token should return an error");
}

#[tokio::test]
async fn test_jwt_verifier_with_empty_token() {
    let issuer = "test-issuer".to_string();
    let audience = "test-audience".to_string();
    let jwks_url = "https://example.com/.well-known/jwks.json".to_string();

    let verifier = JwtVerifier::new(jwks_url, issuer, Some(audience));

    // Test with an empty token
    let result = verifier.verify("").await;
    assert!(result.is_err(), "Empty token should return an error");
}
