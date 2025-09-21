use crate::domain::user::{ContributorSpecialty, User, UserRole};

#[test]
fn test_sponsor_permissions() {
    let sponsor_role = UserRole::Sponsor;

    assert!(!sponsor_role.can_modify_backlog());
    assert!(!sponsor_role.can_accept_stories());
    assert!(!sponsor_role.can_take_task_ownership());
    assert!(!sponsor_role.is_contributor());
    assert!(sponsor_role.can_view_project_data());
}

#[test]
fn test_product_owner_permissions() {
    let po_role = UserRole::ProductOwner;

    assert!(po_role.can_modify_backlog());
    assert!(po_role.can_accept_stories());
    assert!(!po_role.can_take_task_ownership());
    assert!(!po_role.is_contributor());
    assert!(po_role.can_view_project_data());
}

#[test]
fn test_contributor_permissions() {
    let contributor_role = UserRole::Contributor;

    assert!(!contributor_role.can_modify_backlog());
    assert!(!contributor_role.can_accept_stories());
    assert!(contributor_role.can_take_task_ownership());
    assert!(contributor_role.is_contributor());
    assert!(contributor_role.can_view_project_data());
}

#[test]
fn test_managing_contributor_permissions() {
    let managing_contributor_role = UserRole::ManagingContributor;

    assert!(!managing_contributor_role.can_modify_backlog());
    assert!(!managing_contributor_role.can_accept_stories());
    assert!(managing_contributor_role.can_take_task_ownership());
    assert!(managing_contributor_role.is_contributor());
    assert!(managing_contributor_role.can_view_project_data());
}

#[test]
fn test_create_contributor_with_specialty() {
    let user = User::new(
        "clerk-ext-123".to_string(),
        "dev@example.com".to_string(),
        UserRole::Contributor,
        Some(ContributorSpecialty::Backend),
    )
    .unwrap();

    assert_eq!(user.role, UserRole::Contributor);
    assert_eq!(user.specialty, Some(ContributorSpecialty::Backend));
    assert_eq!(user.email, "dev@example.com");
}

#[test]
fn test_create_non_contributor_with_specialty_fails() {
    let result = User::new(
        "clerk-ext-123".to_string(),
        "sponsor@example.com".to_string(),
        UserRole::Sponsor,
        Some(ContributorSpecialty::Backend),
    );

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Non-contributors cannot have specialties"));
}

#[test]
fn test_create_user_with_invalid_email_fails() {
    let result = User::new(
        "clerk-ext-123".to_string(),
        "invalid-email".to_string(),
        UserRole::Contributor,
        Some(ContributorSpecialty::Frontend),
    );

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Invalid email format"));
}

#[test]
fn test_update_contributor_role() {
    let mut user = User::new(
        "clerk-ext-123".to_string(),
        "dev@example.com".to_string(),
        UserRole::Contributor,
        Some(ContributorSpecialty::Frontend),
    )
    .unwrap();

    // Update to managing contributor
    user.update_role(
        UserRole::ManagingContributor,
        Some(ContributorSpecialty::Fullstack),
    )
    .unwrap();

    assert_eq!(user.role, UserRole::ManagingContributor);
    assert_eq!(user.specialty, Some(ContributorSpecialty::Fullstack));
}

#[test]
fn test_update_to_non_contributor_removes_specialty() {
    let mut user = User::new(
        "clerk-ext-123".to_string(),
        "dev@example.com".to_string(),
        UserRole::Contributor,
        Some(ContributorSpecialty::Frontend),
    )
    .unwrap();

    // Update to product owner should remove specialty
    user.update_role(UserRole::ProductOwner, None).unwrap();

    assert_eq!(user.role, UserRole::ProductOwner);
    assert_eq!(user.specialty, None);
}

#[test]
fn test_update_non_contributor_with_specialty_fails() {
    let mut user = User::new(
        "clerk-ext-123".to_string(),
        "po@example.com".to_string(),
        UserRole::ProductOwner,
        None,
    )
    .unwrap();

    let result = user.update_role(UserRole::Sponsor, Some(ContributorSpecialty::QA));

    assert!(result.is_err());
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("Non-contributors cannot have specialties"));
}
