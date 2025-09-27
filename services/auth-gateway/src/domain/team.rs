use super::user::{ContributorSpecialty, UserRole};
use chrono::{DateTime, Utc};
use common::AppError;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub organization_id: Uuid,
    pub active_sprint_id: Option<Uuid>, // Only one sprint at a time
    pub velocity_history: Vec<u32>,     // Historical points completed per sprint
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TeamMembership {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub role: UserRole,
    pub specialty: Option<ContributorSpecialty>,
    pub is_active: bool,
    pub joined_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Team {
    pub fn new(name: String, organization_id: Uuid) -> Result<Self, AppError> {
        if name.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Team name cannot be empty".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            name: name.trim().to_string(),
            organization_id,
            active_sprint_id: None,
            velocity_history: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Set active sprint - enforces only one sprint at a time
    pub fn set_active_sprint(&mut self, sprint_id: Option<Uuid>) {
        self.active_sprint_id = sprint_id;
        self.updated_at = Utc::now();
    }

    /// Add velocity data point for completed sprint
    pub fn record_sprint_velocity(&mut self, points_completed: u32) {
        self.velocity_history.push(points_completed);
        // Keep only last 10 sprints for capacity planning
        if self.velocity_history.len() > 10 {
            self.velocity_history.remove(0);
        }
        self.updated_at = Utc::now();
    }

    /// Calculate average velocity for capacity planning
    pub fn average_velocity(&self) -> f64 {
        if self.velocity_history.is_empty() {
            0.0
        } else {
            let sum: u32 = self.velocity_history.iter().sum();
            sum as f64 / self.velocity_history.len() as f64
        }
    }

    /// Check if team can start a new sprint
    pub fn can_start_new_sprint(&self) -> bool {
        self.active_sprint_id.is_none()
    }
}

impl TeamMembership {
    pub fn new(
        team_id: Uuid,
        user_id: Uuid,
        role: UserRole,
        specialty: Option<ContributorSpecialty>,
    ) -> Result<Self, AppError> {
        // Validate that non-contributors don't have specialties
        if !role.is_contributor() && specialty.is_some() {
            return Err(AppError::BadRequest(
                "Non-contributors cannot have specialties".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            team_id,
            user_id,
            role,
            specialty,
            is_active: true,
            joined_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Deactivate membership (soft delete)
    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    /// Update role and specialty
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

        self.specialty = if role.is_contributor() {
            specialty
        } else {
            None
        };
        self.role = role;
        self.updated_at = Utc::now();

        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTeamRequest {
    pub name: String,
    pub organization_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddTeamMemberRequest {
    pub user_id: Uuid,
    pub role: UserRole,
    pub specialty: Option<ContributorSpecialty>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_team_with_valid_name() {
        let org_id = Uuid::new_v4();
        let team = Team::new("Engineering Team".to_string(), org_id).unwrap();

        assert_eq!(team.name, "Engineering Team");
        assert_eq!(team.organization_id, org_id);
        assert!(team.active_sprint_id.is_none());
        assert!(team.velocity_history.is_empty());
        assert!(team.can_start_new_sprint());
    }

    #[test]
    fn test_create_team_with_empty_name_fails() {
        let org_id = Uuid::new_v4();
        let result = Team::new("".to_string(), org_id);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Team name cannot be empty"));
    }

    #[test]
    fn test_team_can_only_have_one_active_sprint() {
        let org_id = Uuid::new_v4();
        let mut team = Team::new("Test Team".to_string(), org_id).unwrap();

        let sprint_id = Uuid::new_v4();
        team.set_active_sprint(Some(sprint_id));

        assert_eq!(team.active_sprint_id, Some(sprint_id));
        assert!(!team.can_start_new_sprint());

        team.set_active_sprint(None);
        assert!(team.can_start_new_sprint());
    }

    #[test]
    fn test_velocity_history_tracking() {
        let org_id = Uuid::new_v4();
        let mut team = Team::new("Test Team".to_string(), org_id).unwrap();

        team.record_sprint_velocity(10);
        team.record_sprint_velocity(12);
        team.record_sprint_velocity(8);

        assert_eq!(team.velocity_history, vec![10, 12, 8]);
        assert_eq!(team.average_velocity(), 10.0);
    }

    #[test]
    fn test_velocity_history_limited_to_10_sprints() {
        let org_id = Uuid::new_v4();
        let mut team = Team::new("Test Team".to_string(), org_id).unwrap();

        // Add 12 velocity data points
        for i in 1..=12 {
            team.record_sprint_velocity(i);
        }

        // Should only keep last 10
        assert_eq!(team.velocity_history.len(), 10);
        assert_eq!(team.velocity_history[0], 3); // First should be 3 (1 and 2 removed)
        assert_eq!(team.velocity_history[9], 12); // Last should be 12
    }

    #[test]
    fn test_create_contributor_membership() {
        let team_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let membership = TeamMembership::new(
            team_id,
            user_id,
            UserRole::Contributor,
            Some(ContributorSpecialty::Backend),
        )
        .unwrap();

        assert_eq!(membership.team_id, team_id);
        assert_eq!(membership.user_id, user_id);
        assert_eq!(membership.role, UserRole::Contributor);
        assert_eq!(membership.specialty, Some(ContributorSpecialty::Backend));
        assert!(membership.is_active);
    }

    #[test]
    fn test_non_contributor_cannot_have_specialty() {
        let team_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let result = TeamMembership::new(
            team_id,
            user_id,
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
    fn test_deactivate_membership() {
        let team_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let mut membership = TeamMembership::new(
            team_id,
            user_id,
            UserRole::Contributor,
            Some(ContributorSpecialty::Frontend),
        )
        .unwrap();

        assert!(membership.is_active);

        membership.deactivate();
        assert!(!membership.is_active);
    }

    #[test]
    fn test_update_membership_role() {
        let team_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();

        let mut membership = TeamMembership::new(
            team_id,
            user_id,
            UserRole::Contributor,
            Some(ContributorSpecialty::Frontend),
        )
        .unwrap();

        // Update to managing contributor
        membership
            .update_role(
                UserRole::ManagingContributor,
                Some(ContributorSpecialty::Fullstack),
            )
            .unwrap();

        assert_eq!(membership.role, UserRole::ManagingContributor);
        assert_eq!(membership.specialty, Some(ContributorSpecialty::Fullstack));

        // Update to non-contributor role should remove specialty
        membership
            .update_role(UserRole::ProductOwner, None)
            .unwrap();

        assert_eq!(membership.role, UserRole::ProductOwner);
        assert_eq!(membership.specialty, None);
    }
}
