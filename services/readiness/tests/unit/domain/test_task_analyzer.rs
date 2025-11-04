use readiness::application::ports::TaskInfo;
use readiness::domain::{GapType, TaskAnalyzer};
use uuid::Uuid;

#[test]
fn test_missing_technical_details_recommendation() {
    // Given: a task description that lacks specific technical details
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement user authentication".to_string(),
        description: Some("Create a login feature".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: the system should recommend adding technical details
    let tech_detail_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails);

    assert!(
        tech_detail_rec.is_some(),
        "Should generate technical details recommendation"
    );

    let rec = tech_detail_rec.unwrap();
    assert_eq!(
        rec.message,
        "Task description lacks specific technical details"
    );
    assert!(!rec.specific_suggestions.is_empty());

    // Enhanced recommendations should provide context-aware specific examples
    let suggestions_text = rec.specific_suggestions.join(" ");

    // Should suggest file paths (enhanced with examples)
    assert!(
        rec.specific_suggestions.iter().any(|s| s.contains("file")
            || s.contains("path")
            || s.contains("src/")
            || s.contains("services/")),
        "Should suggest adding file paths with examples, got: {}",
        suggestions_text
    );

    // Should suggest functions/components (enhanced with examples)
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("function")
                || s.contains("component")
                || s.contains("struct")
                || s.contains("Example")),
        "Should suggest specifying functions/components with examples, got: {}",
        suggestions_text
    );

    // Should suggest inputs/outputs (enhanced with type examples)
    assert!(
        rec.specific_suggestions.iter().any(|s| s.contains("input")
            || s.contains("output")
            || s.contains("parameter")
            || s.contains("Input:")),
        "Should suggest defining inputs/outputs with examples, got: {}",
        suggestions_text
    );

    // Should suggest technical approach (enhanced with hexagonal architecture)
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("technical approach")
                || s.contains("architecture")
                || s.contains("hexagonal")),
        "Should suggest describing technical approach with examples, got: {}",
        suggestions_text
    );
}

#[test]
fn test_no_technical_details_recommendation_when_present() {
    // Given: a task with detailed technical information
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement user authentication".to_string(),
        description: Some(
            "Modify src/auth/login.rs file to add authenticate_user function. \
             The function should accept email and password as input parameters and \
             return a JWT token as output. Use bcrypt for password hashing. \
             Follow hexagonal architecture pattern with ports and adapters."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should not generate technical details recommendation
    let tech_detail_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails);

    assert!(
        tech_detail_rec.is_none(),
        "Should not generate technical details recommendation when details are present"
    );
}

#[test]
fn test_vague_language_detection() {
    // Given: a task with vague or ambiguous language
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Fix the authentication".to_string(),
        description: Some(
            "Implement a better login system. Add some improvements to the user interface. \
             Build the authentication module and create the necessary components."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: the system should flag vague terms
    let vague_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::VagueLanguage);

    assert!(vague_rec.is_some(), "Should detect vague language");

    let rec = vague_rec.unwrap();
    assert_eq!(rec.message, "Task contains vague or ambiguous language");

    // Should flag specific vague terms
    let suggestions_text = rec.specific_suggestions.join(" ");
    assert!(suggestions_text.contains("implement"));
    assert!(suggestions_text.contains("add"));
    assert!(suggestions_text.contains("build"));
    assert!(suggestions_text.contains("create"));

    // Should recommend concrete actions
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("concrete, measurable actions")),
        "Should recommend using concrete, measurable actions"
    );
}

#[test]
fn test_missing_acceptance_criteria_recommendation() {
    // Given: a task with no linked acceptance criteria
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement feature".to_string(),
        description: Some("Some description".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string(), "ac-2".to_string(), "ac-3".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: the system should recommend linking to specific AC IDs
    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria);

    assert!(
        ac_rec.is_some(),
        "Should generate missing AC recommendation"
    );

    let rec = ac_rec.unwrap();
    assert_eq!(rec.message, "Task is not linked to acceptance criteria");

    // Should suggest linking to ACs
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("Link this task to specific acceptance criteria IDs")),
        "Should suggest linking to AC IDs"
    );

    // Should list available AC IDs
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("ac-1") && s.contains("ac-2") && s.contains("ac-3")),
        "Should list available AC IDs"
    );

    // ac_references should contain valid AC IDs
    assert_eq!(rec.ac_references, valid_ac_ids);
}

#[test]
fn test_invalid_acceptance_criteria_references() {
    // Given: a task that references invalid AC IDs
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement feature".to_string(),
        description: Some("Some description".to_string()),
        acceptance_criteria_refs: vec!["invalid-ac".to_string(), "another-invalid".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string(), "ac-2".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should recommend updating to valid AC references
    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria);

    assert!(
        ac_rec.is_some(),
        "Should generate invalid AC reference recommendation"
    );

    let rec = ac_rec.unwrap();
    assert_eq!(
        rec.message,
        "Task references invalid acceptance criteria IDs"
    );

    // Should list invalid references
    let suggestions_text = rec.specific_suggestions.join(" ");
    assert!(suggestions_text.contains("invalid-ac"));
    assert!(suggestions_text.contains("another-invalid"));

    // Should list valid AC IDs
    assert!(suggestions_text.contains("ac-1"));
    assert!(suggestions_text.contains("ac-2"));
}

#[test]
fn test_ai_agent_compatibility_checks() {
    // Given: a task missing AI agent compatibility elements
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement feature".to_string(),
        description: Some("Create a new authentication module".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the readiness check runs
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should evaluate AI agent compatibility
    let ai_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAiAgentCompatibility);

    assert!(
        ai_rec.is_some(),
        "Should check AI agent compatibility requirements"
    );

    let rec = ai_rec.unwrap();
    assert_eq!(
        rec.message,
        "Task missing elements for AI agent compatibility"
    );

    // Should check for clear success criteria
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("success criteria")),
        "Should check for success criteria"
    );

    // Should check for explicit dependencies
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("dependencies") || s.contains("prerequisites")),
        "Should check for dependencies"
    );

    // Should check for environment setup
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("environment setup")),
        "Should check for environment setup"
    );

    // Should check for test coverage
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("test coverage")),
        "Should check for test coverage expectations"
    );

    // Should check for definition of done
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("definition of done")),
        "Should check for definition of done"
    );
}

#[test]
fn test_well_defined_task_high_clarity_score() {
    // Given: a well-defined task with all elements
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Add JWT authentication to login endpoint".to_string(),
        description: Some(
            "Modify src/auth/handlers.rs to add JWT token generation in the login function. \
             Function should accept LoginRequest struct as input and return LoginResponse with JWT token. \
             Use jsonwebtoken crate for token generation. Follow hexagonal architecture with auth port. \
             Success criteria: User receives valid JWT on successful login. \
             Dependencies: jsonwebtoken crate, bcrypt for password verification. \
             Environment: Requires JWT_SECRET env var. \
             Tests: Add unit tests for token generation, integration tests for login endpoint. \
             Definition of done: All tests pass, code reviewed, JWT tokens expire in 24h."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the analysis evaluates the task
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should have high clarity score and minimal recommendations
    assert!(
        analysis.clarity_score >= 80,
        "Well-defined task should have high clarity score, got {}",
        analysis.clarity_score
    );
    assert_eq!(
        analysis.summary,
        "Task is well-defined and ready for implementation"
    );
    // Even well-defined tasks might get some recommendations if they use terms like "add"
    // but the key is the clarity score should be high
    assert!(
        analysis.recommendations.len() <= 1,
        "Well-defined task should have minimal recommendations, got {}",
        analysis.recommendations.len()
    );
}

#[test]
fn test_clarity_score_calculation() {
    // Test that clarity score decreases appropriately with each gap

    // No description: -20
    let task_no_desc = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: None,
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };
    let analysis = TaskAnalyzer::analyze(&task_no_desc, &["ac-1".to_string()], None);
    assert_eq!(analysis.clarity_score, 80); // 100 - 20 for no description

    // Missing AC refs: -15, missing estimate: -10, AI compatibility: -10
    let task_missing_ac_estimate = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Good technical description with file path src/main.rs and function details with input/output parameters and architecture approach.".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };
    let analysis = TaskAnalyzer::analyze(&task_missing_ac_estimate, &["ac-1".to_string()], None);
    // Clarity score: 100 - 15 (no AC) - 10 (no estimate) - 10 (missing AI compatibility elements like tests, deps, etc.)
    assert_eq!(analysis.clarity_score, 65);
}

#[test]
fn test_no_ac_suggestions_when_none_available() {
    // Given: a task with no ACs and no valid ACs available for the story
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Description".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(4),
    };

    let valid_ac_ids: Vec<String> = vec![];

    // When: the analysis runs
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should suggest defining story-level ACs first
    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria)
        .expect("Should have AC recommendation");

    assert!(
        ac_rec
            .specific_suggestions
            .iter()
            .any(|s| s.contains("No acceptance criteria available")),
        "Should indicate no ACs available"
    );
}

#[test]
fn test_multiple_gap_types_combined() {
    // Given: a task with multiple issues
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Fix something".to_string(),
        description: Some("Just fix the bug and improve the code".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    // When: the analysis runs
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should identify multiple gap types
    assert!(
        analysis.recommendations.len() >= 3,
        "Should have multiple recommendations for multiple gaps"
    );

    // Should have technical details gap
    assert!(
        analysis
            .recommendations
            .iter()
            .any(|r| r.gap_type == GapType::MissingTechnicalDetails),
        "Should identify missing technical details"
    );

    // Should have vague language gap (fix, improve)
    assert!(
        analysis
            .recommendations
            .iter()
            .any(|r| r.gap_type == GapType::VagueLanguage),
        "Should identify vague language"
    );

    // Should have missing AC gap
    assert!(
        analysis
            .recommendations
            .iter()
            .any(|r| r.gap_type == GapType::MissingAcceptanceCriteria),
        "Should identify missing ACs"
    );

    // Should have AI compatibility gap
    assert!(
        analysis
            .recommendations
            .iter()
            .any(|r| r.gap_type == GapType::MissingAiAgentCompatibility),
        "Should identify AI compatibility issues"
    );

    // Clarity score should be low
    assert!(
        analysis.clarity_score < 60,
        "Multiple gaps should result in low clarity score"
    );
}

// ============================================================================
// COMPREHENSIVE CLARITY SCORING ACCURACY TESTS
// ============================================================================

#[test]
fn test_vague_vs_detailed_task_comparison() {
    // AC: e0261453 - clarity score indicates how well-defined the task is

    // Given: a vague task with minimal detail
    let vague_task = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Update the system".to_string(),
        description: Some("Fix bugs and add features".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };

    // Given: a detailed task with comprehensive information
    let detailed_task = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Add JWT refresh token rotation to auth service".to_string(),
        description: Some(
            "Modify services/auth-gateway/src/domain/auth.rs to implement refresh token rotation. \
             Create a RefreshTokenService struct that handles token rotation logic. \
             Function signature: async fn rotate_token(old_token: &str) -> Result<TokenPair, AuthError>. \
             Input: expired JWT refresh token. Output: new access token + new refresh token. \
             Use Redis adapter for token blacklisting (add to adapters/persistence/redis_token_store.rs). \
             Follow hexagonal architecture with TokenStore port in application/ports.rs. \
             Success criteria: Old refresh tokens are invalidated after rotation. \
             Dependencies: redis crate v0.23, jsonwebtoken v9. \
             Environment: Requires REDIS_URL and JWT_SECRET env vars. \
             Tests: Unit tests for rotation logic, integration tests with Redis testcontainer, test token blacklisting. \
             Definition of done: All tests pass with >85% coverage, tokens rotate successfully, old tokens rejected."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-123".to_string()],
        estimated_hours: Some(6),
    };

    let valid_ac_ids = vec!["ac-123".to_string()];

    // When: both tasks are analyzed
    let vague_analysis = TaskAnalyzer::analyze(&vague_task, &[], None);
    let detailed_analysis = TaskAnalyzer::analyze(&detailed_task, &valid_ac_ids, None);

    // Then: detailed task should have significantly higher clarity score
    assert!(
        detailed_analysis.clarity_score >= 80,
        "Detailed task should have clarity score >= 80, got {}",
        detailed_analysis.clarity_score
    );
    assert!(
        vague_analysis.clarity_score < 60,
        "Vague task should have clarity score < 60, got {}",
        vague_analysis.clarity_score
    );

    // Score difference should be substantial
    let score_diff = detailed_analysis.clarity_score - vague_analysis.clarity_score;
    assert!(
        score_diff >= 30,
        "Score difference should be >= 30 points, got {}",
        score_diff
    );

    // Vague task should have more recommendations
    assert!(
        vague_analysis.recommendations.len() > detailed_analysis.recommendations.len(),
        "Vague task should have more recommendations: {} vs {}",
        vague_analysis.recommendations.len(),
        detailed_analysis.recommendations.len()
    );
}

#[test]
fn test_recommendations_match_specific_gaps() {
    // AC: 81054dee - recommendations match missing technical details

    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Create authentication".to_string(),
        description: Some("Build a login system".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Then: should recommend all four technical detail categories
    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have technical details recommendation");

    // Verify all four categories of technical details are recommended
    let suggestions = tech_rec.specific_suggestions.join(" ");

    // Enhanced recommendations should include context-aware specific examples
    assert!(
        suggestions.contains("file")
            || suggestions.contains("path")
            || suggestions.contains("src/")
            || suggestions.contains("services/"),
        "Should recommend file paths when missing, got: {}",
        suggestions
    );
    assert!(
        suggestions.contains("function")
            || suggestions.contains("component")
            || suggestions.contains("struct")
            || suggestions.contains("Example"),
        "Should recommend functions/components when missing, got: {}",
        suggestions
    );
    assert!(
        suggestions.contains("input")
            || suggestions.contains("output")
            || suggestions.contains("parameter")
            || suggestions.contains("Input:"),
        "Should recommend inputs/outputs when missing, got: {}",
        suggestions
    );
    assert!(
        suggestions.contains("technical approach")
            || suggestions.contains("architecture")
            || suggestions.contains("hexagonal"),
        "Should recommend technical approach when missing, got: {}",
        suggestions
    );
}

#[test]
fn test_recommendations_match_vague_language_gaps() {
    // AC: 30639999 - flag vague terms and recommend concrete actions

    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Enhance system".to_string(),
        description: Some(
            "Implement better error handling. Add logging. Fix authentication issues. \
             Create new database schema. Build improved UI. Update API endpoints."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(10),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let vague_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::VagueLanguage)
        .expect("Should detect vague language");

    // Verify each vague term is flagged
    let suggestions_text = vague_rec.specific_suggestions.join(" ");

    assert!(
        suggestions_text.contains("implement"),
        "Should flag 'implement'"
    );
    assert!(suggestions_text.contains("add"), "Should flag 'add'");
    assert!(suggestions_text.contains("fix"), "Should flag 'fix'");
    assert!(suggestions_text.contains("create"), "Should flag 'create'");
    assert!(suggestions_text.contains("build"), "Should flag 'build'");
    assert!(suggestions_text.contains("update"), "Should flag 'update'");

    // Verify recommendation for concrete actions is present
    assert!(
        suggestions_text.contains("concrete") || suggestions_text.contains("measurable"),
        "Should recommend concrete, measurable actions"
    );
}

#[test]
fn test_recommendations_match_ac_gaps() {
    // AC: 5649e91e - recommend linking to specific AC IDs

    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Add feature".to_string(),
        description: Some("Good description with technical details".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(5),
    };

    let valid_ac_ids = vec![
        "ac-auth-001".to_string(),
        "ac-auth-002".to_string(),
        "ac-ui-003".to_string(),
    ];

    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria)
        .expect("Should have AC recommendation");

    // Should list all available AC IDs
    let suggestions_text = ac_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("ac-auth-001"),
        "Should list ac-auth-001"
    );
    assert!(
        suggestions_text.contains("ac-auth-002"),
        "Should list ac-auth-002"
    );
    assert!(
        suggestions_text.contains("ac-ui-003"),
        "Should list ac-ui-003"
    );

    // ac_references field should contain all valid IDs
    assert_eq!(ac_rec.ac_references, valid_ac_ids);
}

#[test]
fn test_recommendations_match_ai_compatibility_gaps() {
    // AC: 3f42fa09 - evaluate AI agent compatibility elements

    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement feature".to_string(),
        description: Some("Write code to add functionality".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ai_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAiAgentCompatibility)
        .expect("Should check AI compatibility");

    // Verify all five AI compatibility elements are checked
    let suggestions_text = ai_rec.specific_suggestions.join(" ");

    assert!(
        suggestions_text.contains("success criteria") || suggestions_text.contains("success"),
        "Should check for success criteria"
    );
    assert!(
        suggestions_text.contains("dependencies") || suggestions_text.contains("prerequisite"),
        "Should check for dependencies"
    );
    assert!(
        suggestions_text.contains("environment") || suggestions_text.contains("setup"),
        "Should check for environment setup"
    );
    assert!(
        suggestions_text.contains("test") || suggestions_text.contains("coverage"),
        "Should check for test coverage"
    );
    assert!(
        suggestions_text.contains("definition of done") || suggestions_text.contains("done"),
        "Should check for definition of done"
    );
}

#[test]
fn test_edge_case_empty_description() {
    // Edge case: empty string description (not None)
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("   ".to_string()), // whitespace only
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

    // Should treat whitespace-only as missing description
    assert!(
        analysis
            .missing_elements
            .iter()
            .any(|e| e.contains("lacks a detailed description")),
        "Should detect empty/whitespace-only description"
    );
    assert!(
        analysis.clarity_score <= 80,
        "Should penalize empty description"
    );
}

#[test]
fn test_edge_case_very_long_description() {
    // Edge case: extremely long description with all details
    let long_desc = format!(
        "{}. File: src/main.rs. Function: process_data(input: Vec<u8>) -> Result<Output>. \
         Architecture: hexagonal pattern. Success: data processed correctly. \
         Dependencies: serde, tokio. Environment: DATABASE_URL required. \
         Tests: unit and integration tests with 90% coverage. \
         Definition of done: all tests pass, code reviewed, deployed to staging.",
        "x".repeat(5000)
    );

    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Process data".to_string(),
        description: Some(long_desc),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(8),
    };

    let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

    // Should still analyze correctly regardless of length
    assert!(
        analysis.clarity_score >= 80,
        "Long but complete description should score high"
    );
}

#[test]
fn test_edge_case_special_characters_in_description() {
    // Edge case: special characters and code snippets
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Add validation".to_string(),
        description: Some(
            "Modify src/validators.rs to add email validation function.\n\
             Function signature: `fn validate_email(email: &str) -> Result<bool>`.\n\
             Use regex pattern: `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$`.\n\
             Input: email string. Output: true/false.\n\
             Architecture: add EmailValidator struct.\n\
             Success: validates emails correctly.\n\
             Tests: unit tests for valid/invalid emails.\n\
             Definition of done: tests pass, handles unicode."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(3),
    };

    let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

    // Should handle special characters correctly
    assert!(
        analysis.clarity_score >= 80,
        "Should handle special characters in technical descriptions"
    );
}

#[test]
fn test_edge_case_case_insensitive_keyword_detection() {
    // Edge case: keywords in different cases
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "IMPLEMENT Feature".to_string(),
        description: Some(
            "File: SRC/AUTH.RS. Function: AUTHENTICATE with INPUT parameters and OUTPUT result. \
             CREATE new component. BUILD the module. FIX the bug. \
             Architecture: HEXAGONAL. Success: TESTS PASS."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(5),
    };

    let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

    // Should detect vague keywords regardless of case
    let has_vague = analysis
        .recommendations
        .iter()
        .any(|r| r.gap_type == GapType::VagueLanguage);
    assert!(has_vague, "Should detect vague terms in any case");

    // Technical details detection is case-insensitive
    // The description has "File:", ".RS", "Function", "INPUT", "OUTPUT", "Architecture"
    // All converted to lowercase for matching, so should recognize all technical details
    let has_tech = analysis
        .recommendations
        .iter()
        .any(|r| r.gap_type == GapType::MissingTechnicalDetails);

    assert!(
        !has_tech,
        "Should recognize technical details regardless of case"
    );
}

#[test]
fn test_edge_case_multiple_valid_and_invalid_ac_refs() {
    // Edge case: mix of valid and invalid AC references
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Feature".to_string(),
        description: Some("Good description".to_string()),
        acceptance_criteria_refs: vec![
            "ac-valid-1".to_string(),
            "ac-invalid-1".to_string(),
            "ac-valid-2".to_string(),
            "ac-invalid-2".to_string(),
        ],
        estimated_hours: Some(5),
    };

    let valid_ac_ids = vec!["ac-valid-1".to_string(), "ac-valid-2".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria);

    // Should flag invalid references
    assert!(ac_rec.is_some(), "Should detect invalid AC references");

    let suggestions_text = ac_rec.unwrap().specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("ac-invalid-1"),
        "Should list first invalid AC"
    );
    assert!(
        suggestions_text.contains("ac-invalid-2"),
        "Should list second invalid AC"
    );
}

#[test]
fn test_edge_case_zero_estimated_hours() {
    // Edge case: 0 hours estimate (Some(0) vs None)
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Description".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(0),
    };

    let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

    // Some(0) means estimate is present (even if zero)
    assert!(
        !analysis
            .missing_elements
            .iter()
            .any(|e| e.contains("time estimate")),
        "Some(0) should be treated as having an estimate"
    );
}

#[test]
fn test_clarity_score_boundary_conditions() {
    // Test score boundaries for summary messages

    // Score >= 80: "ready for implementation"
    let good_task = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some(
            "File: src/main.rs. Function: foo(). Input: x. Output: y. \
             Architecture: clean. Success: works. Dependencies: none. \
             Environment: none needed. Tests: unit tests. Done: deployed."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };
    let analysis = TaskAnalyzer::analyze(&good_task, &["ac-1".to_string()], None);
    assert!(analysis.clarity_score >= 80);
    assert_eq!(
        analysis.summary,
        "Task is well-defined and ready for implementation"
    );

    // Score 60-79: "needs some improvements"
    let medium_task = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Create a feature with some details about files".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };
    let analysis = TaskAnalyzer::analyze(&medium_task, &["ac-1".to_string()], None);
    assert!(analysis.clarity_score >= 60 && analysis.clarity_score < 80);
    assert_eq!(
        analysis.summary,
        "Task needs some improvements before it's ready"
    );

    // Score < 60: "requires significant clarification"
    let poor_task = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Do stuff".to_string(),
        description: Some("Fix it".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };
    let analysis = TaskAnalyzer::analyze(&poor_task, &[], None);
    assert!(analysis.clarity_score < 60);
    assert_eq!(analysis.summary, "Task requires significant clarification");
}

#[test]
fn test_score_calculation_precision() {
    // Verify exact score deductions

    // Perfect task: 100
    let perfect = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some(
            "File: src/main.rs. Component: Processor struct. \
             Function: process(input: Data) -> Result<Output>. \
             Architecture: hexagonal design pattern. \
             Success criteria: processes data correctly. \
             Dependencies: tokio runtime required. \
             Environment setup: DATABASE_URL env var. \
             Test coverage: unit and integration tests >85%. \
             Definition of done: tests pass, code reviewed, deployed."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(6),
    };
    let analysis = TaskAnalyzer::analyze(&perfect, &["ac-1".to_string()], None);
    assert_eq!(analysis.clarity_score, 100, "Perfect task should score 100");

    // No description: -20
    let no_desc = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: None,
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };
    let analysis = TaskAnalyzer::analyze(&no_desc, &["ac-1".to_string()], None);
    assert_eq!(analysis.clarity_score, 80, "No description: 100 - 20 = 80");

    // Missing tech details: -15
    let no_tech = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Generic description without technical specifics".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };
    let analysis = TaskAnalyzer::analyze(&no_tech, &["ac-1".to_string()], None);
    // Should deduct for missing tech details and AI compatibility
    assert!(analysis.clarity_score <= 85);

    // Missing AC: -15, Missing estimate: -10
    let no_ac_est = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some(
            "File: src/main.rs with function process() taking input and output. \
             Using architecture pattern."
                .to_string(),
        ),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };
    let analysis = TaskAnalyzer::analyze(&no_ac_est, &["ac-1".to_string()], None);
    // 100 - 15 (no AC) - 10 (no estimate) - 10 (AI compat) = 65
    assert_eq!(
        analysis.clarity_score, 65,
        "Missing AC and estimate: 100 - 15 - 10 - 10 = 65"
    );
}

#[test]
fn test_all_vague_terms_detected() {
    // Comprehensive test for all vague terms
    let vague_terms = vec![
        "implement",
        "create",
        "build",
        "add",
        "fix",
        "update",
        "improve",
        "enhance",
    ];

    for term in vague_terms {
        let task_info = TaskInfo {
            id: Uuid::new_v4(),
            story_id: Uuid::new_v4(),
            title: "Task".to_string(),
            description: Some(format!("We need to {} the system", term)),
            acceptance_criteria_refs: vec!["ac-1".to_string()],
            estimated_hours: Some(4),
        };

        let analysis = TaskAnalyzer::analyze(&task_info, &["ac-1".to_string()], None);

        let vague_rec = analysis
            .recommendations
            .iter()
            .find(|r| r.gap_type == GapType::VagueLanguage);

        assert!(vague_rec.is_some(), "Should detect vague term: {}", term);

        let suggestions_text = vague_rec.unwrap().specific_suggestions.join(" ");
        assert!(
            suggestions_text.to_lowercase().contains(term),
            "Should mention vague term '{}' in suggestions",
            term
        );
    }
}

#[test]
fn test_task_with_only_one_gap_type() {
    // Test tasks with single specific gaps

    // Only missing estimate
    let only_estimate_gap = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Email validation implementation".to_string(),
        description: Some(
            "Modify src/validators.rs file to include validate_email function. \
             Component: EmailValidator struct. \
             Function signature: fn validate_email(email: &str) -> Result<bool>. \
             Input: email string. Output: validation result. \
             Architecture: use regex pattern matching approach. \
             Success criteria: validates RFC 5322 compliant emails. \
             Dependencies: regex crate v1.5. \
             Environment: no special setup required. \
             Tests: unit tests for valid/invalid emails with 90% coverage. \
             Definition of done: all tests pass, handles edge cases."
                .to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: None, // Only gap
    };

    let analysis = TaskAnalyzer::analyze(&only_estimate_gap, &["ac-1".to_string()], None);

    // Should only deduct for missing estimate
    assert_eq!(
        analysis.missing_elements.len(),
        1,
        "Should only have one missing element"
    );
    assert!(
        analysis.missing_elements[0].contains("time estimate"),
        "Should flag missing estimate"
    );
    assert_eq!(
        analysis.clarity_score, 90,
        "Should deduct only 10 points for missing estimate"
    );
}

#[test]
fn test_idempotency_of_analysis() {
    // Running analysis multiple times should produce same result
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Task".to_string(),
        description: Some("Description with function and file.rs".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];

    let analysis1 = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);
    let analysis2 = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);
    let analysis3 = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Scores should be identical
    assert_eq!(analysis1.clarity_score, analysis2.clarity_score);
    assert_eq!(analysis2.clarity_score, analysis3.clarity_score);

    // Number of recommendations should be identical
    assert_eq!(
        analysis1.recommendations.len(),
        analysis2.recommendations.len()
    );
    assert_eq!(
        analysis2.recommendations.len(),
        analysis3.recommendations.len()
    );

    // Summaries should be identical
    assert_eq!(analysis1.summary, analysis2.summary);
    assert_eq!(analysis2.summary, analysis3.summary);
}
