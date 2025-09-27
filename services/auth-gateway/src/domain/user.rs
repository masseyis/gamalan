use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Sponsor,             // Can view progress, demos, forecasts (read-only)
    ProductOwner,        // Can manage backlog, prioritize stories, accept completed work
    ManagingContributor, // Technical leadership + mentorship (same capabilities as Contributor)
    Contributor,         // Self-organize work, take task ownership, implement solutions
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ContributorSpecialty {
    Frontend,
    Backend,
    Fullstack,
    QA,
    DevOps,
    UXDesigner,
}

impl fmt::Display for UserRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            UserRole::Sponsor => write!(f, "sponsor"),
            UserRole::ProductOwner => write!(f, "product_owner"),
            UserRole::ManagingContributor => write!(f, "managing_contributor"),
            UserRole::Contributor => write!(f, "contributor"),
        }
    }
}

impl UserRole {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "sponsor" => Some(UserRole::Sponsor),
            "product_owner" => Some(UserRole::ProductOwner),
            "managing_contributor" => Some(UserRole::ManagingContributor),
            "contributor" => Some(UserRole::Contributor),
            _ => None,
        }
    }

    /// Sponsors can only view, cannot modify anything
    pub fn can_modify_backlog(&self) -> bool {
        matches!(self, UserRole::ProductOwner)
    }

    /// Only PO can accept completed stories
    pub fn can_accept_stories(&self) -> bool {
        matches!(self, UserRole::ProductOwner)
    }

    /// Contributors and managing contributors can take task ownership
    pub fn can_take_task_ownership(&self) -> bool {
        matches!(self, UserRole::Contributor | UserRole::ManagingContributor)
    }

    /// Only contributors participate in sprint work
    pub fn is_contributor(&self) -> bool {
        matches!(self, UserRole::Contributor | UserRole::ManagingContributor)
    }

    /// Can view all project data
    pub fn can_view_project_data(&self) -> bool {
        true // All roles can view
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub external_id: String,
    pub email: String,
    pub role: UserRole,
    pub specialty: Option<ContributorSpecialty>, // Only relevant for contributors
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn new(
        external_id: String,
        email: String,
        role: UserRole,
        specialty: Option<ContributorSpecialty>,
    ) -> Result<Self, AppError> {
        // Validate that non-contributors don't have specialties
        if !role.is_contributor() && specialty.is_some() {
            return Err(AppError::BadRequest(
                "Non-contributors cannot have specialties".to_string(),
            ));
        }

        // Validate email format (basic check)
        if !email.contains('@') {
            return Err(AppError::BadRequest("Invalid email format".to_string()));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            external_id,
            email,
            role,
            specialty,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    pub fn update_role(
        &mut self,
        role: UserRole,
        specialty: Option<ContributorSpecialty>,
    ) -> Result<(), AppError> {
        // Validate that non-contributors don't have specialties
        if !role.is_contributor() && specialty.is_some() {
            return Err(AppError::BadRequest(
                "Non-contributors cannot have specialties".to_string(),
            ));
        }

        self.role = role;
        self.specialty = if self.role.is_contributor() {
            specialty
        } else {
            None
        };
        self.updated_at = Utc::now();

        Ok(())
    }
}
