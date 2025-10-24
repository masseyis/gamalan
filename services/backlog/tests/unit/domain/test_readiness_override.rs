use backlog::domain::{Story, AcceptanceCriteria};
use uuid::Uuid;

#[test]
fn test_story_readiness_override_clearing_with_logging() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut story = Story::new(
        project_id,
        org_id,
        "Test Story".to_string(),
        Some("Test description".to_string()),
    )
    .unwrap();

    // Apply readiness override with a reason
    story.apply_readiness_override(user_id, Some("Missing technical details".to_string()));
    assert!(story.readiness_override);
    assert_eq!(story.readiness_override_reason, Some("Missing technical details".to_string()));

    // Set up story to meet ready requirements
    story.set_story_points(3).unwrap();
    
    // Add required acceptance criteria (need at least 3)
    for i in 1..=3 {
        let ac = AcceptanceCriteria::new(
            format!("AC {}", i),
            format!("given {}", i),
            format!("when {}", i),
            format!("then {}", i),
        )
        .unwrap();
        story.add_acceptance_criteria(ac);
    }

    // Update the story - this should trigger the readiness override clearing with logging
    story
        .update(
            Some("Updated Title".to_string()),
            None,
            None,
            None,
        )
        .unwrap();

    // Verify the override was cleared
    assert!(!story.readiness_override);
    assert_eq!(story.readiness_override_reason, None);
    assert_eq!(story.readiness_override_by, None);
    assert_eq!(story.readiness_override_at, None);
}

#[test]
fn test_story_readiness_override_persists_when_requirements_not_met() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut story = Story::new(
        project_id,
        org_id,
        "Test Story".to_string(),
        Some("Test description".to_string()),
    )
    .unwrap();

    // Apply readiness override with a reason
    story.apply_readiness_override(user_id, Some("Missing technical details".to_string()));
    assert!(story.readiness_override);
    assert_eq!(story.readiness_override_reason, Some("Missing technical details".to_string()));

    // Update the story without meeting ready requirements
    story
        .update(
            Some("Updated Title".to_string()),
            None,
            None,
            None,
        )
        .unwrap();

    // Verify the override persists
    assert!(story.readiness_override);
    assert_eq!(story.readiness_override_reason, Some("Missing technical details".to_string()));
    assert_eq!(story.readiness_override_by, Some(user_id));
}

#[test]
fn test_explicit_readiness_override_clearing_with_logging() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut story = Story::new(
        project_id,
        org_id,
        "Test Story".to_string(),
        Some("Test description".to_string()),
    )
    .unwrap();

    // Apply readiness override with a reason
    story.apply_readiness_override(user_id, Some("Missing technical details".to_string()));
    assert!(story.readiness_override);
    assert_eq!(story.readiness_override_reason, Some("Missing technical details".to_string()));

    // Explicitly clear the override with logging
    story.clear_readiness_override_with_logging("Product Owner approved after review");

    // Verify the override was cleared
    assert!(!story.readiness_override);
    assert_eq!(story.readiness_override_reason, None);
    assert_eq!(story.readiness_override_by, None);
    assert_eq!(story.readiness_override_at, None);
}