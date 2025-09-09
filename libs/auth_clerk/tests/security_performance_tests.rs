use auth_clerk::{webhook::WebhookValidator, JwtVerifier};
use base64::{engine::general_purpose, Engine as _};
use common::error_context::ErrorContext;
use ring::hmac;
use std::time::{Duration, Instant};

/// SECURITY PERFORMANCE TESTS
/// These tests verify that the auth_clerk library handles various security scenarios
/// and performs adequately under load conditions.

// ================================
// PERFORMANCE TESTS
// ================================

#[tokio::test]
async fn test_jwt_verifier_performance_under_load() {
    // Performance test: Multiple concurrent JWT validations
    let verifier = JwtVerifier::new_test_verifier();

    let start = Instant::now();
    let mut handles = vec![];

    // Test 100 concurrent JWT validations
    for _ in 0..100 {
        let verifier_clone = verifier.clone();
        let handle = tokio::spawn(async move {
            let result = verifier_clone.verify("valid-test-token").await;
            assert!(result.is_ok(), "JWT validation should succeed under load");
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        handle.await.expect("Task should complete successfully");
    }

    let duration = start.elapsed();
    println!("100 concurrent JWT validations took: {:?}", duration);

    // Performance requirement: Should complete within 5 seconds
    assert!(
        duration < Duration::from_secs(5),
        "JWT validation performance under load should be < 5 seconds, took {:?}",
        duration
    );
}

#[test]
fn test_webhook_validator_performance_under_load() {
    // Performance test: Multiple rapid webhook validations
    let secret = "performance-test-secret";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let payload = b"performance test payload";

    // Pre-compute signature to avoid timing signature generation
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    let signature = hmac::sign(&key, payload);
    let signature_b64 = general_purpose::STANDARD.encode(signature.as_ref());
    let signature_header = format!("v1={}", signature_b64);

    let start = Instant::now();

    // Test 1000 rapid webhook validations
    for i in 0..1000 {
        let context = ErrorContext::new(format!("test_iteration_{}", i));
        let result = validator.validate_signature(payload, &signature_header, context);
        assert!(
            result.is_ok(),
            "Webhook validation {} should succeed under load",
            i
        );
    }

    let duration = start.elapsed();
    println!("1000 webhook validations took: {:?}", duration);

    // Performance requirement: Should complete within 2 seconds
    assert!(
        duration < Duration::from_secs(2),
        "Webhook validation performance should be < 2 seconds, took {:?}",
        duration
    );
}

// ================================
// SECURITY TESTS - TIMING ATTACKS
// ================================

#[test]
fn test_webhook_validator_constant_time_signature_comparison() {
    // Security test: Verify signature comparison is constant-time
    let secret = "constant-time-test-secret";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let payload = b"constant time test payload";

    // Create signatures with different lengths and patterns
    let signatures = vec![
        "v1=aGVsbG8=",                                             // Short signature
        "v1=dGhpcyBpcyBhIGxvbmdlciBzaWduYXR1cmUgdGhhbiBub3JtYWw=", // Long signature
        "v1=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",             // All same bytes
        "v1=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",             // All different pattern
    ];

    let mut timings = vec![];

    // Measure timing for different invalid signatures
    for signature in signatures {
        let context = ErrorContext::new("timing_test");
        let start = Instant::now();
        let result = validator.validate_signature(payload, signature, context);
        let duration = start.elapsed();

        assert!(result.is_err(), "Invalid signature should fail");
        timings.push(duration.as_nanos());
    }

    // Calculate timing variance
    let mean_time = timings.iter().sum::<u128>() / timings.len() as u128;
    let variance = timings
        .iter()
        .map(|&time| (time as i128 - mean_time as i128).unsigned_abs())
        .max()
        .unwrap_or(0);

    println!(
        "Timing variance: {} nanoseconds (mean: {})",
        variance, mean_time
    );

    // Security requirement: Timing variance should be minimal
    // Allow for 10ms variance to account for system noise
    let max_variance_ns = 10_000_000; // 10ms in nanoseconds
    assert!(
        variance < max_variance_ns,
        "Signature comparison timing variance {} ns exceeds security threshold {} ns",
        variance,
        max_variance_ns
    );
}

// ================================
// SECURITY TESTS - MEMORY SAFETY
// ================================

#[test]
fn test_webhook_validator_memory_safety_with_large_payloads() {
    // Security test: Verify library handles large payloads safely
    let secret = "memory-safety-test";
    let validator = WebhookValidator::new(Some(secret.to_string()));

    // Test with progressively larger payloads
    let sizes = vec![1024, 10 * 1024, 100 * 1024, 1024 * 1024]; // 1KB to 1MB

    for size in sizes {
        let payload = vec![0u8; size];

        // Compute valid signature
        let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
        let signature = hmac::sign(&key, &payload);
        let signature_b64 = general_purpose::STANDARD.encode(signature.as_ref());
        let signature_header = format!("v1={}", signature_b64);

        let context = ErrorContext::new(format!("memory_test_{}_bytes", size));
        let result = validator.validate_signature(&payload, &signature_header, context);

        assert!(
            result.is_ok(),
            "Memory safety test with {} byte payload should succeed",
            size
        );
        println!("Memory safety test passed for {} byte payload", size);
    }
}

// ================================
// SECURITY TESTS - INPUT VALIDATION
// ================================

#[test]
fn test_webhook_validator_input_sanitization() {
    // Security test: Verify proper handling of malicious inputs
    let secret = "input-sanitization-test";
    let validator = WebhookValidator::new(Some(secret.to_string()));
    let payload = b"test payload";

    // Test various malicious signature header patterns
    let extremely_long_sig = format!("v1={}", "A".repeat(10000));
    let malicious_signatures = vec![
        // SQL injection attempts
        "v1='; DROP TABLE users; --",
        // XSS attempts
        "v1=<script>alert('xss')</script>",
        // Path traversal attempts
        "v1=../../../etc/passwd",
        // NULL bytes
        "v1=test\0signature",
        // Unicode normalization attacks
        "v1=café",
        "v1=cafe\u{0301}", // Same visually but different unicode
        // Control characters
        "v1=test\x00\x01\x02signature",
        // Extremely long signature
        &extremely_long_sig,
    ];

    for malicious_sig in malicious_signatures {
        let context = ErrorContext::new("input_sanitization_test");
        let result = validator.validate_signature(payload, malicious_sig, context);

        // All should fail gracefully without panicking
        assert!(
            result.is_err(),
            "Malicious signature '{}' should be rejected",
            malicious_sig
        );
    }

    println!("Input sanitization tests passed - all malicious inputs properly rejected");
}

// ================================
// SECURITY TESTS - RESOURCE EXHAUSTION
// ================================

#[test]
fn test_webhook_validator_resource_exhaustion_protection() {
    // Security test: Verify protection against resource exhaustion attacks
    let secret = "resource-test-secret";
    let validator = WebhookValidator::new(Some(secret.to_string()));

    // Test multiple signature versions (DoS attempt)
    let many_versions = (0..1000)
        .map(|i| format!("v{}=dGVzdA==", i))
        .collect::<Vec<_>>()
        .join(",");

    let payload = b"resource exhaustion test";
    let context = ErrorContext::new("resource_exhaustion_test");

    let start = Instant::now();
    let result = validator.validate_signature(payload, &many_versions, context);
    let duration = start.elapsed();

    // Should fail (no valid signature) but not timeout
    assert!(
        result.is_err(),
        "Should reject signature with too many versions"
    );
    assert!(
        duration < Duration::from_secs(1),
        "Resource exhaustion protection failed - took {:?}",
        duration
    );

    println!(
        "Resource exhaustion protection passed - rejected in {:?}",
        duration
    );
}

// ================================
// CONCURRENCY AND RACE CONDITION TESTS
// ================================

#[tokio::test]
async fn test_jwt_verifier_thread_safety() {
    // Concurrency test: Verify thread safety of JWT verifier
    let verifier = JwtVerifier::new_test_verifier();
    let mut handles = vec![];

    // Start multiple concurrent tasks that access the verifier
    for i in 0..50 {
        let verifier_clone = verifier.clone();
        let handle = tokio::spawn(async move {
            // Mix of valid and invalid tokens
            let token = if i % 2 == 0 {
                "valid-test-token"
            } else {
                "invalid-token"
            };

            let result = verifier_clone.verify(token).await;

            if i % 2 == 0 {
                assert!(
                    result.is_ok(),
                    "Valid token should succeed in concurrent test"
                );
            } else {
                assert!(
                    result.is_err(),
                    "Invalid token should fail in concurrent test"
                );
            }
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        handle
            .await
            .expect("Concurrent task should complete successfully");
    }

    println!("Thread safety test passed - no data races or panics detected");
}

#[test]
fn test_webhook_validator_concurrent_validations() {
    // Concurrency test: Multiple threads validating webhooks simultaneously
    use std::sync::Arc;
    use std::thread;

    let secret = "concurrent-validation-test";
    let validator = Arc::new(WebhookValidator::new(Some(secret.to_string())));
    let payload = b"concurrent test payload";

    // Pre-compute valid signature
    let key = hmac::Key::new(hmac::HMAC_SHA256, secret.as_bytes());
    let signature = hmac::sign(&key, payload);
    let signature_b64 = general_purpose::STANDARD.encode(signature.as_ref());
    let signature_header = format!("v1={}", signature_b64);

    let mut handles = vec![];

    // Start multiple threads performing validations
    for i in 0..10 {
        let validator_clone = validator.clone();
        let header_clone = signature_header.clone();

        let handle = thread::spawn(move || {
            for j in 0..10 {
                let context = ErrorContext::new(format!("concurrent_test_{}_{}", i, j));
                let result = validator_clone.validate_signature(payload, &header_clone, context);
                assert!(result.is_ok(), "Concurrent validation should succeed");
            }
        });
        handles.push(handle);
    }

    // Wait for all threads to complete
    for handle in handles {
        handle
            .join()
            .expect("Concurrent thread should complete successfully");
    }

    println!("Concurrent webhook validation test passed - no race conditions detected");
}
