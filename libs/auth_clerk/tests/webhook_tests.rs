use auth_clerk::webhook::WebhookValidator;
use base64::{engine::general_purpose, Engine as _};
use common::error_context::ErrorContext;

// ================================
// FAILING TESTS FOR EMPTY WEBHOOK SECRETS
// ================================

#[test]
fn test_webhook_validator_with_empty_secret_should_fail() {
    // FAILING TEST: When webhook secret is empty string
    // This simulates the staging environment issue where CLERK_WEBHOOK_SECRET is empty

    let validator = WebhookValidator::new(Some("".to_string())); // Empty secret
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = "v1=some-signature-here";

    let result = validator.validate_signature(payload, signature, context);

    // This test SHOULD FAIL initially - empty secret should be treated as missing
    // After fix: empty secret should be detected and handled gracefully
    assert!(
        result.is_err(),
        "Empty webhook secret should cause validation failure"
    );

    let error = result.unwrap_err();
    match error {
        common::AppError::InternalServerErrorWithContext { message, .. } => {
            assert!(
                message.contains("not properly configured"),
                "Error should indicate configuration problem"
            );
        }
        _ => panic!("Expected InternalServerErrorWithContext for empty secret"),
    }
}

#[test]
fn test_webhook_validator_with_none_secret_should_fail() {
    // FAILING TEST: When webhook secret is None
    // This should definitely fail - no secret means no validation possible

    let validator = WebhookValidator::new(None);
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = "v1=some-signature-here";

    let result = validator.validate_signature(payload, signature, context);

    assert!(
        result.is_err(),
        "Missing webhook secret should cause validation failure"
    );

    let error = result.unwrap_err();
    match error {
        common::AppError::InternalServerErrorWithContext { source, .. } => {
            assert!(
                source.to_string().contains("CLERK_WEBHOOK_SECRET"),
                "Error should mention the missing environment variable"
            );
        }
        _ => panic!("Expected InternalServerErrorWithContext for missing secret"),
    }
}

#[test]
fn test_webhook_validator_with_whitespace_secret_should_fail() {
    // FAILING TEST: When webhook secret is whitespace only
    // This should be treated as effectively empty

    let validator = WebhookValidator::new(Some("   ".to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = "v1=some-signature-here";

    let result = validator.validate_signature(payload, signature, context);

    // This test might FAIL initially - whitespace secret might not be handled
    // After fix: should detect whitespace-only secrets as invalid
    assert!(
        result.is_err(),
        "Whitespace-only webhook secret should cause validation failure"
    );
}

// ================================
// FAILING TESTS FOR MALFORMED SIGNATURES
// ================================

#[test]
fn test_webhook_validator_with_empty_signature_header_should_fail() {
    // FAILING TEST: When signature header is empty

    let validator = WebhookValidator::new(Some("valid-secret".to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = ""; // Empty signature header

    let result = validator.validate_signature(payload, signature, context);

    assert!(
        result.is_err(),
        "Empty signature header should cause validation failure"
    );

    let error = result.unwrap_err();
    match error {
        common::AppError::UnauthorizedWithContext { error_code, .. } => {
            assert_eq!(error_code, "MISSING_SIGNATURE");
        }
        _ => panic!("Expected UnauthorizedWithContext with MISSING_SIGNATURE"),
    }
}

#[test]
fn test_webhook_validator_with_malformed_signature_header_should_fail() {
    // FAILING TEST: When signature header is malformed

    let validator = WebhookValidator::new(Some("valid-secret".to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = "malformed-signature-without-equals"; // No '=' separator

    let result = validator.validate_signature(payload, signature, context);

    assert!(
        result.is_err(),
        "Malformed signature header should cause validation failure"
    );
}

#[test]
fn test_webhook_validator_with_invalid_base64_signature_should_fail() {
    // FAILING TEST: When signature contains invalid base64

    let validator = WebhookValidator::new(Some("valid-secret".to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    let signature = "v1=invalid-base64!!!"; // Invalid base64 characters

    let result = validator.validate_signature(payload, signature, context);

    assert!(
        result.is_err(),
        "Invalid base64 in signature should cause validation failure"
    );

    let error = result.unwrap_err();
    match error {
        common::AppError::UnauthorizedWithContext { error_code, .. } => {
            assert_eq!(error_code, "INVALID_SIGNATURE_FORMAT");
        }
        _ => panic!("Expected UnauthorizedWithContext with INVALID_SIGNATURE_FORMAT"),
    }
}

// ================================
// FAILING TESTS FOR SIGNATURE VALIDATION
// ================================

#[test]
fn test_webhook_validator_with_wrong_signature_should_fail() {
    // FAILING TEST: When signature is valid format but wrong value

    let validator = WebhookValidator::new(Some("correct-secret".to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";
    // This is a valid base64 string but wrong signature
    let signature = "v1=aW52YWxpZC1zaWduYXR1cmU="; // base64 for "invalid-signature"

    let result = validator.validate_signature(payload, signature, context);

    assert!(
        result.is_err(),
        "Wrong signature should cause validation failure"
    );

    let error = result.unwrap_err();
    match error {
        common::AppError::UnauthorizedWithContext { error_code, .. } => {
            assert_eq!(error_code, "INVALID_WEBHOOK_SIGNATURE");
        }
        _ => panic!("Expected UnauthorizedWithContext with INVALID_WEBHOOK_SIGNATURE"),
    }
}

#[test]
fn test_webhook_validator_with_correct_signature_should_succeed() {
    // Control test: Valid signature should succeed
    // This test might INITIALLY FAIL due to implementation issues, but should pass after fixes

    let secret = "test-secret-key";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"test payload";

    // Manually compute expected signature using same algorithm
    // This is what the webhook validator should compute internally
    use ring::hmac;
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    let expected_signature = hmac::sign(&key, payload);
    let signature_b64 = general_purpose::STANDARD.encode(expected_signature.as_ref());
    let signature_header = format!("v1={}", signature_b64);

    let result = validator.validate_signature(payload, &signature_header, context);

    // Debug the result
    if let Err(ref e) = result {
        println!("Validation failed: {:?}", e);
    }

    // This should succeed when implementation is correct
    assert!(result.is_ok(), "Correct signature should pass validation");
}

// ================================
// INTEGRATION TESTS FOR REALISTIC SCENARIOS
// ================================

#[test]
fn test_multiple_signature_versions_with_one_valid() {
    // Test with multiple signature versions where one is valid

    let secret = "test-secret";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let context = ErrorContext::new("test_webhook_validation");
    let payload = b"webhook payload";

    // Compute correct v1 signature
    use ring::hmac;
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    let v1_signature = hmac::sign(&key, payload);
    let v1_b64 = general_purpose::STANDARD.encode(v1_signature.as_ref());

    // Create header with multiple versions, one correct
    let signature_header = format!("v0=wrong-signature,v1={},v2=another-wrong-sig", v1_b64);

    let result = validator.validate_signature(payload, &signature_header, context);

    // Should succeed because v1 signature is valid
    assert!(
        result.is_ok(),
        "Should succeed when at least one signature version is valid"
    );
}

#[test]
fn test_realistic_clerk_webhook_signature_format() {
    // Test with realistic Clerk webhook signature format

    let secret = "whsec_test_secret_key_12345";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let context = ErrorContext::new("clerk_webhook_validation");

    // Realistic Clerk webhook payload
    let payload = r#"{"data":{"id":"user_123","email_addresses":[{"email_address":"test@example.com"}]},"object":"event","type":"user.created"}"#;

    // Compute signature as Clerk would
    use ring::hmac;
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    let signature = hmac::sign(&key, payload.as_bytes());
    let signature_b64 = general_purpose::STANDARD.encode(signature.as_ref());
    let signature_header = format!("v1={}", signature_b64);

    let result = validator.validate_signature(payload.as_bytes(), &signature_header, context);

    assert!(
        result.is_ok(),
        "Realistic Clerk webhook signature should validate successfully"
    );
}

// ================================
// CONFIGURATION ERROR TESTS
// ================================

#[test]
fn test_webhook_validator_error_context_includes_helpful_info() {
    // Verify error context includes helpful debugging information

    let validator = WebhookValidator::new(None);
    let context = ErrorContext::new("production_webhook")
        .with_request_info("POST".to_string(), "/clerk/webhooks".to_string());
    let payload = b"important webhook payload";
    let signature = "v1=some-signature";

    let result = validator.validate_signature(payload, signature, context);

    assert!(result.is_err());

    let error = result.unwrap_err();
    match error {
        common::AppError::InternalServerErrorWithContext { context, .. } => {
            // Error context should include request information for debugging
            let context_debug = format!("{:?}", context);
            assert!(
                context_debug.contains("production_webhook"),
                "Error context should include service context"
            );
        }
        _ => panic!("Expected detailed error context for configuration issues"),
    }
}
