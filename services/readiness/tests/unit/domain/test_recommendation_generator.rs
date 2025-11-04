use readiness::application::ports::TaskInfo;
use readiness::domain::{GapType, TaskAnalyzer};
use uuid::Uuid;

/// Test that recommendations include specific file path suggestions based on task context
#[test]
fn test_file_path_recommendations_for_backend_tasks() {
    // AC: 81054dee - recommend adding file paths to modify
    // Use a description that triggers file path gap detection (no file extensions)
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[Backend] Build recommendation generation logic".to_string(),
        description: Some(
            "Generate specific recommendations based on gaps. \
             Create functionality to suggest improvements."
                .to_string(),
        ),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(3),
    };

    let valid_ac_ids = vec!["ac-1".to_string(), "ac-2".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Find technical details recommendation
    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have technical details recommendation");

    // Should suggest specific file paths based on [Backend] prefix
    let suggestions_text = tech_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("services/")
            || suggestions_text.contains("domain/")
            || suggestions_text.contains("src/"),
        "Should suggest backend file paths for [Backend] tasks, got: {}",
        suggestions_text
    );
}

#[test]
fn test_file_path_recommendations_for_frontend_tasks() {
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[Frontend] Build UI component".to_string(),
        description: Some("Create a new component for displaying recommendations".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(2),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have technical details recommendation");

    let suggestions_text = tech_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("components/") || suggestions_text.contains("src/"),
        "Should suggest frontend file paths for [Frontend] tasks"
    );
}

#[test]
fn test_file_path_recommendations_for_qa_tasks() {
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[QA] Test recommendation generation".to_string(),
        description: Some("Verify specific recommendations per gap type".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: Some(2),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have technical details recommendation");

    let suggestions_text = tech_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("tests/") || suggestions_text.contains("spec"),
        "Should suggest test file paths for [QA] tasks"
    );
}

#[test]
fn test_ac_id_suggestions_based_on_task_context() {
    // AC: 81054dee - recommend specific AC IDs based on task context
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Implement JWT authentication".to_string(),
        description: Some("Add token-based authentication to the login endpoint".to_string()),
        acceptance_criteria_refs: vec![], // Missing AC refs
        estimated_hours: Some(4),
    };

    // Available ACs include auth-related ones
    let valid_ac_ids = vec![
        "ac-auth-jwt-001".to_string(),
        "ac-auth-jwt-002".to_string(),
        "ac-ui-display-001".to_string(),
        "ac-db-migration-001".to_string(),
    ];

    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ac_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAcceptanceCriteria)
        .expect("Should have AC recommendation");

    // Should suggest relevant AC IDs (auth-related)
    let suggestions_text = ac_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("ac-auth-jwt"),
        "Should suggest auth-related AC IDs for auth task"
    );

    // ac_references should contain ALL valid IDs
    assert_eq!(ac_rec.ac_references.len(), 4);
    assert!(ac_rec
        .ac_references
        .contains(&"ac-auth-jwt-001".to_string()));
}

#[test]
fn test_test_coverage_recommendations_specific_to_task_type() {
    // AC: 81054dee - recommend test coverage needs
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[Backend] Add user registration endpoint".to_string(),
        description: Some(
            "Create POST /api/users endpoint that accepts email and password".to_string(),
        ),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ai_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAiAgentCompatibility)
        .expect("Should have AI compatibility recommendation");

    // Should recommend specific test types for backend endpoint
    let suggestions_text = ai_rec.specific_suggestions.join(" ");
    println!("AI Compatibility suggestions: {}", suggestions_text);
    assert!(
        suggestions_text.to_lowercase().contains("unit")
            || suggestions_text.to_lowercase().contains("integration"),
        "Should recommend specific test types for backend endpoints, got: {}",
        suggestions_text
    );
}

#[test]
fn test_recommendation_prioritization() {
    // Recommendations should be ordered by importance/impact
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Do something".to_string(),
        description: Some("Fix it".to_string()),
        acceptance_criteria_refs: vec![],
        estimated_hours: None,
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    // Should have multiple recommendations
    assert!(
        analysis.recommendations.len() >= 3,
        "Should have multiple recommendations"
    );

    // Critical gaps (missing ACs, missing tech details) should come first
    let gap_types: Vec<GapType> = analysis
        .recommendations
        .iter()
        .map(|r| r.gap_type.clone())
        .collect();

    // First few should be high-priority gaps
    assert!(
        gap_types.iter().take(3).any(|t| matches!(
            t,
            GapType::MissingTechnicalDetails | GapType::MissingAcceptanceCriteria
        )),
        "High-priority gaps should be prioritized"
    );
}

#[test]
fn test_context_aware_function_component_suggestions() {
    // Should suggest appropriate function/component names based on task title
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[Backend] Build recommendation generation logic".to_string(),
        description: Some("Generate recommendations".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(3),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have tech recommendation");

    let suggestions_text = tech_rec.specific_suggestions.join(" ");

    // Should suggest relevant function/struct names
    assert!(
        suggestions_text.contains("RecommendationGenerator")
            || suggestions_text.contains("generate_recommendations")
            || suggestions_text.contains("struct")
            || suggestions_text.contains("function"),
        "Should suggest context-aware function/component names"
    );
}

#[test]
fn test_codebase_pattern_suggestions() {
    // Should suggest following existing codebase patterns
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "[Backend] Add new analysis feature".to_string(),
        description: Some("Analyze tasks for completeness".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails);

    if let Some(rec) = tech_rec {
        let suggestions_text = rec.specific_suggestions.join(" ");
        // Should mention hexagonal architecture or domain patterns
        assert!(
            suggestions_text.contains("domain/")
                || suggestions_text.contains("application/")
                || suggestions_text.contains("adapters/")
                || suggestions_text.contains("hexagonal")
                || suggestions_text.contains("pattern"),
            "Should suggest following hexagonal architecture patterns"
        );
    }
}

#[test]
fn test_input_output_specification_examples() {
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Process user data".to_string(),
        description: Some("Handle user information".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(3),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let tech_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingTechnicalDetails)
        .expect("Should have tech recommendation");

    // Should provide examples of how to specify inputs/outputs
    let has_input_output_guidance = tech_rec.specific_suggestions.iter().any(|s| {
        s.contains("Input:")
            || s.contains("Output:")
            || s.contains("parameter")
            || s.contains("return")
    });

    assert!(
        has_input_output_guidance,
        "Should provide guidance on specifying inputs/outputs"
    );
}

#[test]
fn test_definition_of_done_template_suggestion() {
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "New feature".to_string(),
        description: Some("Add functionality".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(4),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ai_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAiAgentCompatibility)
        .expect("Should have AI compatibility recommendation");

    // Should suggest template for definition of done
    let suggestions_text = ai_rec.specific_suggestions.join(" ");
    assert!(
        suggestions_text.contains("definition of done")
            || suggestions_text.contains("completion criteria")
            || suggestions_text.contains("done"),
        "Should mention definition of done"
    );
}

#[test]
fn test_dependency_identification_suggestions() {
    let task_info = TaskInfo {
        id: Uuid::new_v4(),
        story_id: Uuid::new_v4(),
        title: "Add database migration".to_string(),
        description: Some("Create new table".to_string()),
        acceptance_criteria_refs: vec!["ac-1".to_string()],
        estimated_hours: Some(2),
    };

    let valid_ac_ids = vec!["ac-1".to_string()];
    let analysis = TaskAnalyzer::analyze(&task_info, &valid_ac_ids, None);

    let ai_rec = analysis
        .recommendations
        .iter()
        .find(|r| r.gap_type == GapType::MissingAiAgentCompatibility);

    if let Some(rec) = ai_rec {
        let suggestions_text = rec.specific_suggestions.join(" ");
        // Should suggest identifying dependencies
        assert!(
            suggestions_text.contains("dependencies")
                || suggestions_text.contains("prerequisite")
                || suggestions_text.contains("require"),
            "Should suggest listing dependencies"
        );
    }
}
