use backlog::domain::Task;
use uuid::Uuid;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_creation_success() {
        let story_id = Uuid::new_v4();
        let task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            Some("Task description".to_string()),
            vec!["AC1".to_string(), "AC2".to_string()],
        )
        .unwrap();

        assert_eq!(task.title, "Test Task");
        assert_eq!(task.description, Some("Task description".to_string()));
        assert_eq!(task.story_id, story_id);
        assert_eq!(task.acceptance_criteria_refs, vec!["AC1", "AC2"]);
        assert!(!task.id.is_nil());
    }

    #[test]
    fn test_task_creation_with_empty_title_fails() {
        let story_id = Uuid::new_v4();
        let result = Task::new(
            story_id,
            None,
            "".to_string(),
            None,
            vec!["AC1".to_string()],
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_task_creation_with_whitespace_title_fails() {
        let story_id = Uuid::new_v4();
        let result = Task::new(
            story_id,
            None,
            "   ".to_string(),
            None,
            vec!["AC1".to_string()],
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_task_creation_with_empty_ac_refs_fails() {
        let story_id = Uuid::new_v4();
        let result = Task::new(story_id, None, "Test Task".to_string(), None, vec![]);

        assert!(result.is_err());
    }

    #[test]
    fn test_task_creation_with_empty_ac_ref_fails() {
        let story_id = Uuid::new_v4();
        let result = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            None,
            vec!["AC1".to_string(), "".to_string()],
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_task_update_ac_refs() {
        let story_id = Uuid::new_v4();
        let mut task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            None,
            vec!["AC1".to_string()],
        )
        .unwrap();

        let result =
            task.update_acceptance_criteria_refs(vec!["AC2".to_string(), "AC3".to_string()]);
        assert!(result.is_ok());
        assert_eq!(task.acceptance_criteria_refs, vec!["AC2", "AC3"]);
    }

    #[test]
    fn test_task_update_ac_refs_with_empty_fails() {
        let story_id = Uuid::new_v4();
        let mut task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            None,
            vec!["AC1".to_string()],
        )
        .unwrap();

        let result = task.update_acceptance_criteria_refs(vec![]);
        assert!(result.is_err());
        // Original refs should remain unchanged
        assert_eq!(task.acceptance_criteria_refs, vec!["AC1"]);
    }

    #[test]
    fn test_task_update_ac_refs_with_empty_ref_fails() {
        let story_id = Uuid::new_v4();
        let mut task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            None,
            vec!["AC1".to_string()],
        )
        .unwrap();

        let result = task.update_acceptance_criteria_refs(vec!["AC2".to_string(), "".to_string()]);
        assert!(result.is_err());
        // Original refs should remain unchanged
        assert_eq!(task.acceptance_criteria_refs, vec!["AC1"]);
    }

    #[test]
    fn test_task_clone() {
        let story_id = Uuid::new_v4();
        let task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            Some("Description".to_string()),
            vec!["AC1".to_string()],
        )
        .unwrap();

        let cloned = task.clone();
        assert_eq!(task.id, cloned.id);
        assert_eq!(task.title, cloned.title);
        assert_eq!(task.description, cloned.description);
        assert_eq!(task.story_id, cloned.story_id);
        assert_eq!(
            task.acceptance_criteria_refs,
            cloned.acceptance_criteria_refs
        );
    }

    #[test]
    fn test_task_serialization() {
        use serde_json;

        let story_id = Uuid::new_v4();
        let task = Task::new(
            story_id,
            None,
            "Test Task".to_string(),
            Some("Description".to_string()),
            vec!["AC1".to_string()],
        )
        .unwrap();

        let serialized = serde_json::to_string(&task).unwrap();
        let deserialized: Task = serde_json::from_str(&serialized).unwrap();

        assert_eq!(task.id, deserialized.id);
        assert_eq!(task.title, deserialized.title);
        assert_eq!(task.description, deserialized.description);
        assert_eq!(task.story_id, deserialized.story_id);
        assert_eq!(
            task.acceptance_criteria_refs,
            deserialized.acceptance_criteria_refs
        );
    }
}
