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

    // Should suggest file paths
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("file paths")),
        "Should suggest adding file paths"
    );

    // Should suggest functions/components
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("functions or components")),
        "Should suggest specifying functions/components"
    );

    // Should suggest inputs/outputs
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("inputs and outputs")),
        "Should suggest defining inputs/outputs"
    );

    // Should suggest technical approach
    assert!(
        rec.specific_suggestions
            .iter()
            .any(|s| s.contains("technical approach")),
        "Should suggest describing technical approach"
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
