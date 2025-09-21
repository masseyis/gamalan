use backlog::domain::{Story, StoryStatus, Task, TaskStatus};
use common::AppError;
use uuid::Uuid;

#[test]
fn test_story_creation_with_valid_data() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(
        project_id,
        org_id,
        "User Authentication".to_string(),
        Some("Implement OAuth2 authentication system".to_string()),
    )
    .unwrap();

    story.add_label("feature".to_string());
    story.add_label("security".to_string());

    assert_eq!(story.title, "User Authentication");
    assert_eq!(
        story.description,
        Some("Implement OAuth2 authentication system".to_string())
    );
    assert_eq!(story.status, StoryStatus::Draft);
    assert_eq!(story.labels, vec!["feature", "security"]);
    assert_eq!(story.project_id, project_id);
    assert_eq!(story.organization_id, org_id);
}

#[test]
fn test_story_creation_with_empty_title_fails() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let result = Story::new(
        project_id,
        org_id,
        "".to_string(),
        Some("Description".to_string()),
    );

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Story title cannot be empty"));
}

#[test]
fn test_story_creation_with_title_too_long_fails() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let long_title = "x".repeat(256);

    let result = Story::new(
        project_id,
        org_id,
        long_title,
        Some("Description".to_string()),
    );

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Story title cannot exceed 255 characters"));
}

#[test]
fn test_story_update_valid_fields() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(
        project_id,
        org_id,
        "Original Title".to_string(),
        Some("Original Description".to_string()),
    )
    .unwrap();

    story.add_label("original".to_string());

    story
        .update(
            Some("Updated Title".to_string()),
            Some(Some("Updated Description".to_string())),
            Some(vec!["updated".to_string(), "feature".to_string()]),
        )
        .unwrap();

    assert_eq!(story.title, "Updated Title");
    assert_eq!(story.description, Some("Updated Description".to_string()));
    assert_eq!(story.labels, vec!["updated", "feature"]);
}

#[test]
fn test_story_update_empty_title_fails() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(project_id, org_id, "Original Title".to_string(), None).unwrap();

    let result = story.update(Some("".to_string()), None, None);

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Story title cannot be empty"));
}

#[test]
fn test_story_status_transitions() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(project_id, org_id, "Test Story".to_string(), None).unwrap();

    // Draft -> NeedsRefinement
    story.update_status(StoryStatus::NeedsRefinement).unwrap();
    assert_eq!(story.status, StoryStatus::NeedsRefinement);

    // NeedsRefinement -> Ready
    story.update_status(StoryStatus::Ready).unwrap();
    assert_eq!(story.status, StoryStatus::Ready);

    // Ready -> Committed
    story.update_status(StoryStatus::Committed).unwrap();
    assert_eq!(story.status, StoryStatus::Committed);

    // Committed -> InProgress
    story.update_status(StoryStatus::InProgress).unwrap();
    assert_eq!(story.status, StoryStatus::InProgress);

    // InProgress -> TasksComplete
    story.update_status(StoryStatus::TasksComplete).unwrap();
    assert_eq!(story.status, StoryStatus::TasksComplete);

    // TasksComplete -> Deployed
    story.update_status(StoryStatus::Deployed).unwrap();
    assert_eq!(story.status, StoryStatus::Deployed);

    // Deployed -> AwaitingAcceptance
    story
        .update_status(StoryStatus::AwaitingAcceptance)
        .unwrap();
    assert_eq!(story.status, StoryStatus::AwaitingAcceptance);

    // AwaitingAcceptance -> Accepted
    story.update_status(StoryStatus::Accepted).unwrap();
    assert_eq!(story.status, StoryStatus::Accepted);
}

#[test]
fn test_story_status_invalid_transitions() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(project_id, org_id, "Test Story".to_string(), None).unwrap();

    // Can't go directly from Draft to Committed
    let result = story.update_status(StoryStatus::Committed);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Invalid status transition"));

    // Can't go from Draft to Accepted
    let result = story.update_status(StoryStatus::Accepted);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Invalid status transition"));
}

#[test]
fn test_story_status_can_go_back_to_draft() {
    let project_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let mut story = Story::new(project_id, org_id, "Test Story".to_string(), None).unwrap();

    // Go to NeedsRefinement then back to Draft
    story.update_status(StoryStatus::NeedsRefinement).unwrap();
    story.update_status(StoryStatus::Draft).unwrap();
    assert_eq!(story.status, StoryStatus::Draft);

    // Go to Ready then back to NeedsRefinement
    story.update_status(StoryStatus::NeedsRefinement).unwrap();
    story.update_status(StoryStatus::Ready).unwrap();
    story.update_status(StoryStatus::NeedsRefinement).unwrap();
    assert_eq!(story.status, StoryStatus::NeedsRefinement);
}

#[test]
fn test_task_creation_with_valid_data() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let task = Task::new(
        story_id,
        org_id,
        "Implement login endpoint".to_string(),
        Some("Create POST /auth/login endpoint".to_string()),
        vec!["AC1".to_string(), "AC2".to_string()],
    )
    .unwrap();

    assert_eq!(task.title, "Implement login endpoint");
    assert_eq!(
        task.description,
        Some("Create POST /auth/login endpoint".to_string())
    );
    assert_eq!(task.acceptance_criteria_refs, vec!["AC1", "AC2"]);
    assert_eq!(task.status, TaskStatus::Available);
    assert_eq!(task.story_id, story_id);
    assert_eq!(task.organization_id, org_id);
    assert_eq!(task.owner_user_id, None);
    assert_eq!(task.estimated_hours, None);
}

#[test]
fn test_task_creation_with_empty_title_fails() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());

    let result = Task::new(story_id, org_id, "".to_string(), None, vec![]);

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Task title cannot be empty"));
}

#[test]
fn test_task_ownership_workflow() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    // Take ownership
    task.take_ownership(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::Owned);
    assert_eq!(task.owner_user_id, Some(user_id));
    assert!(task.owned_at.is_some());

    // Start work
    task.start_work(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::InProgress);

    // Complete work
    task.complete(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::Completed);
    assert!(task.completed_at.is_some());
}

#[test]
fn test_task_ownership_authorization() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();
    let other_user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    task.take_ownership(user_id).unwrap();

    // Different user cannot start work on owned task
    let result = task.start_work(other_user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Only the task owner can start work"));

    // Different user cannot complete task
    task.start_work(user_id).unwrap();
    let result = task.complete(other_user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Only the task owner can complete work"));
}

#[test]
fn test_task_estimation_validation() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    task.take_ownership(user_id).unwrap();

    // Valid estimation (owner can set)
    task.set_estimated_hours(Some(8)).unwrap();
    assert_eq!(task.estimated_hours, Some(8));

    // Zero hours should fail
    let result = task.set_estimated_hours(Some(0));
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Estimated hours must be greater than 0"));

    // Over 40 hours should fail
    let result = task.set_estimated_hours(Some(41));
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Task cannot exceed 40 hours"));

    // Note: Authorization for estimates is handled at the application layer, not domain layer
}

#[test]
fn test_task_release_ownership() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    task.take_ownership(user_id).unwrap();
    task.set_estimated_hours(Some(8)).unwrap();

    // Release ownership
    task.release_ownership(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::Available);
    assert_eq!(task.owner_user_id, None);
    assert_eq!(task.estimated_hours, None); // Estimate should be cleared

    // Different user cannot release
    task.take_ownership(user_id).unwrap();
    let other_user_id = Uuid::new_v4();
    let result = task.release_ownership(other_user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Only the task owner can release ownership"));
}

#[test]
fn test_task_status_transitions() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    // Available -> Owned
    task.take_ownership(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::Owned);

    // Owned -> InProgress
    task.start_work(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::InProgress);

    // InProgress -> Completed
    task.complete(user_id).unwrap();
    assert_eq!(task.status, TaskStatus::Completed);
}

#[test]
fn test_task_invalid_status_transitions() {
    let story_id = Uuid::new_v4();
    let org_id = Some(Uuid::new_v4());
    let user_id = Uuid::new_v4();

    let mut task = Task::new(story_id, org_id, "Test Task".to_string(), None, vec![]).unwrap();

    // Cannot start work without ownership
    let result = task.start_work(user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Cannot start work on unowned task"));

    // Cannot complete without being in progress
    task.take_ownership(user_id).unwrap();
    let result = task.complete(user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Cannot complete task that is not in progress"));

    // Cannot take ownership of already owned task
    let other_user_id = Uuid::new_v4();
    let result = task.take_ownership(other_user_id);
    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Task is already owned"));
}

#[test]
fn test_story_status_string_conversion() {
    assert_eq!(StoryStatus::Draft.to_string(), "draft");
    assert_eq!(StoryStatus::NeedsRefinement.to_string(), "needs_refinement");
    assert_eq!(StoryStatus::Ready.to_string(), "ready");
    assert_eq!(StoryStatus::Committed.to_string(), "committed");
    assert_eq!(StoryStatus::InProgress.to_string(), "in_progress");
    assert_eq!(StoryStatus::TasksComplete.to_string(), "tasks_complete");
    assert_eq!(StoryStatus::Deployed.to_string(), "deployed");
    assert_eq!(
        StoryStatus::AwaitingAcceptance.to_string(),
        "awaiting_acceptance"
    );
    assert_eq!(StoryStatus::Accepted.to_string(), "accepted");

    assert_eq!(StoryStatus::from_str("draft"), Some(StoryStatus::Draft));
    assert_eq!(
        StoryStatus::from_str("needs_refinement"),
        Some(StoryStatus::NeedsRefinement)
    );
    assert_eq!(StoryStatus::from_str("ready"), Some(StoryStatus::Ready));
    assert_eq!(
        StoryStatus::from_str("committed"),
        Some(StoryStatus::Committed)
    );
    assert_eq!(
        StoryStatus::from_str("in_progress"),
        Some(StoryStatus::InProgress)
    );
    assert_eq!(
        StoryStatus::from_str("tasks_complete"),
        Some(StoryStatus::TasksComplete)
    );
    assert_eq!(
        StoryStatus::from_str("deployed"),
        Some(StoryStatus::Deployed)
    );
    assert_eq!(
        StoryStatus::from_str("awaiting_acceptance"),
        Some(StoryStatus::AwaitingAcceptance)
    );
    assert_eq!(
        StoryStatus::from_str("accepted"),
        Some(StoryStatus::Accepted)
    );
    assert_eq!(StoryStatus::from_str("invalid"), None);
}

#[test]
fn test_task_status_string_conversion() {
    assert_eq!(TaskStatus::Available.to_string(), "available");
    assert_eq!(TaskStatus::Owned.to_string(), "owned");
    assert_eq!(TaskStatus::InProgress.to_string(), "in_progress");
    assert_eq!(TaskStatus::Completed.to_string(), "completed");

    assert_eq!(
        TaskStatus::from_str("available"),
        Some(TaskStatus::Available)
    );
    assert_eq!(TaskStatus::from_str("owned"), Some(TaskStatus::Owned));
    assert_eq!(
        TaskStatus::from_str("in_progress"),
        Some(TaskStatus::InProgress)
    );
    assert_eq!(
        TaskStatus::from_str("completed"),
        Some(TaskStatus::Completed)
    );
    assert_eq!(TaskStatus::from_str("invalid"), None);
}
