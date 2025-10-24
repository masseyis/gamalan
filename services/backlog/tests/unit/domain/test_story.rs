use backlog::domain::{Story, StoryStatus};
use uuid::Uuid;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_story_creation() {
        let project_id = Uuid::new_v4();
        let story = Story::new(
            project_id,
            None,
            "Test Story".to_string(),
            Some("Test description".to_string()),
        )
        .unwrap();

        assert_eq!(story.title, "Test Story");
        assert_eq!(story.description, Some("Test description".to_string()));
        assert_eq!(story.project_id, project_id);
        assert_eq!(story.status, StoryStatus::Draft);
        assert!(story.labels.is_empty());
        assert!(!story.id.is_nil());
    }

    #[test]
    fn test_story_status_update() {
        let project_id = Uuid::new_v4();
        let mut story = Story::new(project_id, None, "Test".to_string(), None).unwrap();

        // Valid transition: Draft -> NeedsRefinement
        story.update_status(StoryStatus::NeedsRefinement).unwrap();
        assert_eq!(story.status, StoryStatus::NeedsRefinement);

        // Valid transition: NeedsRefinement -> Draft
        story.update_status(StoryStatus::Draft).unwrap();
        assert_eq!(story.status, StoryStatus::Draft);

        // Invalid transition should fail
        assert!(story.update_status(StoryStatus::Accepted).is_err());
    }

    #[test]
    fn test_story_label_management() {
        let project_id = Uuid::new_v4();
        let mut story = Story::new(project_id, None, "Test".to_string(), None).unwrap();

        // Add labels
        story.add_label("bug".to_string());
        story.add_label("frontend".to_string());
        assert_eq!(story.labels.len(), 2);
        assert!(story.labels.contains(&"bug".to_string()));
        assert!(story.labels.contains(&"frontend".to_string()));

        // Adding duplicate label should not increase count
        story.add_label("bug".to_string());
        assert_eq!(story.labels.len(), 2);

        // Remove label
        story.remove_label("bug");
        assert_eq!(story.labels.len(), 1);
        assert!(!story.labels.contains(&"bug".to_string()));
        assert!(story.labels.contains(&"frontend".to_string()));

        // Remove non-existent label should not panic
        story.remove_label("nonexistent");
        assert_eq!(story.labels.len(), 1);
    }

    #[test]
    fn test_story_status_from_str() {
        assert_eq!(StoryStatus::from_str("draft"), Some(StoryStatus::Draft));
        assert_eq!(StoryStatus::from_str("Draft"), Some(StoryStatus::Draft));
        assert_eq!(StoryStatus::from_str("DRAFT"), Some(StoryStatus::Draft));

        assert_eq!(StoryStatus::from_str("ready"), Some(StoryStatus::Ready));
        assert_eq!(StoryStatus::from_str("Ready"), Some(StoryStatus::Ready));

        assert_eq!(
            StoryStatus::from_str("inprogress"),
            Some(StoryStatus::InProgress)
        );
        assert_eq!(
            StoryStatus::from_str("InProgress"),
            Some(StoryStatus::InProgress)
        );

        assert_eq!(
            StoryStatus::from_str("accepted"),
            Some(StoryStatus::Accepted)
        );

        assert_eq!(StoryStatus::from_str("invalid"), None);
        assert_eq!(StoryStatus::from_str(""), None);
    }

    #[test]
    fn test_story_status_display() {
        assert_eq!(StoryStatus::Draft.to_string(), "draft");
        assert_eq!(StoryStatus::Ready.to_string(), "ready");
        assert_eq!(StoryStatus::InProgress.to_string(), "inprogress");
        assert_eq!(StoryStatus::Deployed.to_string(), "deployed");
        assert_eq!(StoryStatus::Accepted.to_string(), "accepted");
    }

    #[test]
    fn test_story_status_serialization() {
        use serde_json;

        let status = StoryStatus::Ready;
        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: StoryStatus = serde_json::from_str(&serialized).unwrap();

        assert_eq!(status, deserialized);
    }

    #[test]
    fn test_story_clone() {
        let project_id = Uuid::new_v4();
        let mut story = Story::new(project_id, None, "Test".to_string(), None).unwrap();
        story.add_label("test".to_string());

        let cloned = story.clone();
        assert_eq!(story.id, cloned.id);
        assert_eq!(story.title, cloned.title);
        assert_eq!(story.labels, cloned.labels);
        assert_eq!(story.status, cloned.status);
    }

    #[test]
    fn test_story_title_validation() {
        let project_id = Uuid::new_v4();

        // Empty title should fail
        let result = Story::new(project_id, None, "".to_string(), None);
        assert!(result.is_err());

        // Whitespace-only title should fail
        let result = Story::new(project_id, None, "   ".to_string(), None);
        assert!(result.is_err());

        // Valid title should succeed
        let result = Story::new(project_id, None, "Valid Title".to_string(), None);
        assert!(result.is_ok());
    }
}
