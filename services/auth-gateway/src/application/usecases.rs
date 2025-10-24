use crate::application::ports::{
    OrganizationRepository, SprintRepository, TeamRepository, UserRepository,
};
use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, Organization, OrganizationMembership,
};
use crate::domain::sprint::{CreateSprintRequest, Sprint};
use crate::domain::team::{AddTeamMemberRequest, CreateTeamRequest, Team, TeamMembership};
use crate::domain::user::{ContributorSpecialty, User, UserRole};
use chrono::Utc;
use common::AppError;
use std::sync::Arc;
use uuid::Uuid;

pub struct UserUsecases {
    user_repo: Arc<dyn UserRepository>,
}

impl UserUsecases {
    pub fn new(user_repo: Arc<dyn UserRepository>) -> Self {
        Self { user_repo }
    }

    pub async fn upsert_user(&self, user: &User) -> Result<(), AppError> {
        self.user_repo.upsert_user(user).await
    }

    pub async fn get_user_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<User>, AppError> {
        self.user_repo.get_user_by_external_id(external_id).await
    }

    pub async fn get_user_by_id(&self, id: &Uuid) -> Result<Option<User>, AppError> {
        self.user_repo.get_user_by_id(id).await
    }

    pub async fn search_users(&self, query: &str, limit: usize) -> Result<Vec<User>, AppError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        self.user_repo
            .search_users(query.trim(), limit.clamp(1, 25))
            .await
    }

    pub async fn update_user_role(
        &self,
        user_id: &Uuid,
        role: UserRole,
        specialty: Option<ContributorSpecialty>,
    ) -> Result<User, AppError> {
        let mut user = self
            .user_repo
            .get_user_by_id(user_id)
            .await?
            .ok_or(AppError::NotFound("User not found".to_string()))?;

        user.update_role(role, specialty)?;
        self.user_repo.upsert_user(&user).await?;
        Ok(user)
    }

    pub async fn update_user_role_by_external_id(
        &self,
        external_id: &str,
        role: UserRole,
        specialty: Option<ContributorSpecialty>,
    ) -> Result<User, AppError> {
        let mut user = self
            .user_repo
            .get_user_by_external_id(external_id)
            .await?
            .ok_or(AppError::NotFound("User not found".to_string()))?;

        user.update_role(role, specialty)?;
        self.user_repo.upsert_user(&user).await?;
        Ok(user)
    }
}

pub struct OrganizationUsecases {
    organization_repo: Arc<dyn OrganizationRepository>,
    user_repo: Arc<dyn UserRepository>,
}

impl OrganizationUsecases {
    pub fn new(
        organization_repo: Arc<dyn OrganizationRepository>,
        user_repo: Arc<dyn UserRepository>,
    ) -> Self {
        Self {
            organization_repo,
            user_repo,
        }
    }

    pub async fn create_organization(
        &self,
        request: &CreateOrganizationRequest,
    ) -> Result<Organization, AppError> {
        // Verify the owner user exists
        let _user = self
            .user_repo
            .get_user_by_id(&request.owner_user_id)
            .await?
            .ok_or(AppError::NotFound("User not found".to_string()))?;

        self.organization_repo.create_organization(request).await
    }

    pub async fn get_organization_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<Organization>, AppError> {
        self.organization_repo
            .get_organization_by_external_id(external_id)
            .await
    }

    pub async fn get_user_organizations(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<(Organization, OrganizationMembership)>, AppError> {
        self.organization_repo.get_user_organizations(user_id).await
    }

    pub async fn add_member(
        &self,
        organization_id: &Uuid,
        request: &AddMemberRequest,
    ) -> Result<OrganizationMembership, AppError> {
        // Verify the organization exists
        let _org = self
            .organization_repo
            .get_organization_by_id(organization_id)
            .await?
            .ok_or(AppError::NotFound("Organization not found".to_string()))?;

        self.organization_repo
            .add_member(organization_id, request)
            .await
    }

    #[allow(dead_code)]
    pub async fn get_membership(
        &self,
        organization_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<OrganizationMembership>, AppError> {
        self.organization_repo
            .get_membership(organization_id, user_id)
            .await
    }

    #[allow(dead_code)]
    pub async fn remove_member(
        &self,
        organization_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<(), AppError> {
        self.organization_repo
            .remove_member(organization_id, user_id)
            .await
    }

    pub async fn ensure_organization_registered(
        &self,
        external_id: &str,
        fallback_name: Option<&str>,
        owner_user_id: Uuid,
        owner_email: Option<&str>,
    ) -> Result<Organization, AppError> {
        if let Some(existing) = self
            .organization_repo
            .get_organization_by_external_id(external_id)
            .await?
        {
            return Ok(existing);
        }

        let owner_external_id = owner_user_id.to_string();

        if self
            .user_repo
            .get_user_by_id(&owner_user_id)
            .await?
            .is_none()
        {
            let email = owner_email
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.to_string())
                .unwrap_or_else(|| format!("{}@placeholder.local", external_id));

            let mut user = User::new(
                owner_external_id.clone(),
                email,
                UserRole::ProductOwner,
                None,
            )?;
            user.id = owner_user_id;
            self.user_repo.upsert_user(&user).await?;
        }

        let name = fallback_name
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.trim().to_string())
            .unwrap_or_else(|| external_id.to_string());

        let slug = generate_slug(&name);

        let request = CreateOrganizationRequest {
            external_id: external_id.to_string(),
            name,
            slug,
            description: None,
            image_url: None,
            owner_user_id,
        };

        self.organization_repo.create_organization(&request).await
    }
}

fn generate_slug(input: &str) -> String {
    let sanitized = input
        .chars()
        .map(|c| match c {
            ch if ch.is_ascii_alphanumeric() => ch.to_ascii_lowercase(),
            ch if ch.is_whitespace() || ch == '-' => '-',
            _ => '-',
        })
        .collect::<String>();

    let condensed = sanitized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if condensed.is_empty() {
        format!("org-{}", Uuid::new_v4().simple())
    } else {
        let suffix = Uuid::new_v4().to_string();
        let short_suffix = suffix.split('-').next().unwrap_or(&suffix);
        format!("{}-{}", condensed, short_suffix)
    }
}

pub struct TeamUsecases {
    team_repo: Arc<dyn TeamRepository>,
    user_repo: Arc<dyn UserRepository>,
    organization_repo: Arc<dyn OrganizationRepository>,
}

impl TeamUsecases {
    pub fn new(
        team_repo: Arc<dyn TeamRepository>,
        user_repo: Arc<dyn UserRepository>,
        organization_repo: Arc<dyn OrganizationRepository>,
    ) -> Self {
        Self {
            team_repo,
            user_repo,
            organization_repo,
        }
    }

    pub async fn create_team(&self, request: &CreateTeamRequest) -> Result<Team, AppError> {
        // Verify the organization exists
        let _org = self
            .organization_repo
            .get_organization_by_id(&request.organization_id)
            .await?
            .ok_or(AppError::NotFound("Organization not found".to_string()))?;

        let _team = Team::new(request.name.clone(), request.organization_id)?;
        self.team_repo.create_team(request).await
    }

    pub async fn get_team(&self, id: &Uuid) -> Result<Option<Team>, AppError> {
        self.team_repo.get_team(id).await
    }

    pub async fn update_team_details(
        &self,
        team_id: &Uuid,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<Team, AppError> {
        let mut team = self
            .team_repo
            .get_team(team_id)
            .await?
            .ok_or(AppError::NotFound("Team not found".to_string()))?;

        let mut modified = false;

        if let Some(new_name) = name {
            let trimmed = new_name.trim();
            if trimmed.is_empty() {
                return Err(AppError::BadRequest(
                    "Team name cannot be empty".to_string(),
                ));
            }
            if team.name != trimmed {
                team.name = trimmed.to_string();
                modified = true;
            }
        }

        if let Some(desc) = description {
            let trimmed = desc.trim();
            let sanitized = if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            };

            if team.description != sanitized {
                team.description = sanitized;
                modified = true;
            }
        }

        if !modified {
            return Ok(team);
        }

        team.updated_at = Utc::now();

        self.team_repo.update_team(&team).await?;
        Ok(team)
    }

    pub async fn delete_team(&self, id: &Uuid) -> Result<(), AppError> {
        let team = self
            .team_repo
            .get_team(id)
            .await?
            .ok_or(AppError::NotFound("Team not found".to_string()))?;

        if team.active_sprint_id.is_some() {
            return Err(AppError::BadRequest(
                "Cannot delete a team with an active sprint".to_string(),
            ));
        }

        let members = self.team_repo.get_team_members(id).await?;
        if !members.is_empty() {
            return Err(AppError::BadRequest(
                "Remove all team members before deleting the team".to_string(),
            ));
        }

        self.team_repo.delete_team(id).await
    }

    pub async fn get_teams_by_organization(
        &self,
        organization_id: &Uuid,
    ) -> Result<Vec<Team>, AppError> {
        self.team_repo
            .get_teams_by_organization(organization_id)
            .await
    }

    pub async fn add_team_member(
        &self,
        team_id: &Uuid,
        request: &AddTeamMemberRequest,
        _requester_user_id: &Uuid,
    ) -> Result<TeamMembership, AppError> {
        // Verify the team exists
        let _team = self
            .team_repo
            .get_team(team_id)
            .await?
            .ok_or(AppError::NotFound("Team not found".to_string()))?;

        // Verify the user being added exists
        let _user = self.user_repo.get_user_by_id(&request.user_id).await?;

        // Check if requester has permission (must be managing contributor or above)
        // This would require getting the requester's role in the organization
        // For now, we'll trust the caller has validated permissions

        self.team_repo.add_team_member(team_id, request).await
    }

    pub async fn get_team_members(
        &self,
        team_id: &Uuid,
    ) -> Result<Vec<(User, TeamMembership)>, AppError> {
        self.team_repo.get_team_members(team_id).await
    }

    pub async fn get_user_teams(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<(Team, TeamMembership)>, AppError> {
        self.team_repo.get_user_teams(user_id).await
    }

    pub async fn remove_team_member(
        &self,
        team_id: &Uuid,
        user_id: &Uuid,
        _requester_user_id: &Uuid,
    ) -> Result<(), AppError> {
        // Check permissions - only managing contributors or the user themselves can remove
        // For now, we'll trust the caller has validated permissions

        self.team_repo.remove_team_member(team_id, user_id).await
    }
}

pub struct SprintUsecases {
    sprint_repo: Arc<dyn SprintRepository>,
    team_repo: Arc<dyn TeamRepository>,
}

impl SprintUsecases {
    pub fn new(sprint_repo: Arc<dyn SprintRepository>, team_repo: Arc<dyn TeamRepository>) -> Self {
        Self {
            sprint_repo,
            team_repo,
        }
    }

    pub async fn create_sprint(&self, request: &CreateSprintRequest) -> Result<Sprint, AppError> {
        // Verify the team exists and can start a new sprint
        let mut team = self
            .team_repo
            .get_team(&request.team_id)
            .await?
            .ok_or(AppError::NotFound("Team not found".to_string()))?;

        if !team.can_start_new_sprint() {
            return Err(AppError::BadRequest(
                "Team already has an active sprint".to_string(),
            ));
        }

        // Create the sprint
        let _sprint = Sprint::new(
            request.team_id,
            request.name.clone(),
            request.goal.clone(),
            request.capacity_points,
            request.start_date,
            request.end_date,
        )?;

        let created_sprint = self.sprint_repo.create_sprint(request).await?;

        // Update team to reference the new sprint
        team.set_active_sprint(Some(created_sprint.id));
        self.team_repo.update_team(&team).await?;

        Ok(created_sprint)
    }

    pub async fn get_sprint(&self, id: &Uuid) -> Result<Option<Sprint>, AppError> {
        self.sprint_repo.get_sprint(id).await
    }

    pub async fn get_sprints_by_team(&self, team_id: &Uuid) -> Result<Vec<Sprint>, AppError> {
        self.sprint_repo.get_sprints_by_team(team_id).await
    }

    pub async fn get_active_sprint_by_team(
        &self,
        team_id: &Uuid,
    ) -> Result<Option<Sprint>, AppError> {
        self.sprint_repo.get_active_sprint_by_team(team_id).await
    }

    pub async fn start_sprint(&self, sprint_id: &Uuid) -> Result<(), AppError> {
        let mut sprint = self
            .sprint_repo
            .get_sprint(sprint_id)
            .await?
            .ok_or(AppError::NotFound("Sprint not found".to_string()))?;

        sprint.start()?;
        self.sprint_repo.update_sprint(&sprint).await
    }

    pub async fn move_sprint_to_review(&self, sprint_id: &Uuid) -> Result<(), AppError> {
        let mut sprint = self
            .sprint_repo
            .get_sprint(sprint_id)
            .await?
            .ok_or(AppError::NotFound("Sprint not found".to_string()))?;

        sprint.move_to_review()?;
        self.sprint_repo.update_sprint(&sprint).await
    }

    pub async fn complete_sprint(&self, sprint_id: &Uuid) -> Result<(), AppError> {
        let mut sprint = self
            .sprint_repo
            .get_sprint(sprint_id)
            .await?
            .ok_or(AppError::NotFound("Sprint not found".to_string()))?;

        let mut team = self
            .team_repo
            .get_team(&sprint.team_id)
            .await?
            .ok_or(AppError::NotFound("Team not found".to_string()))?;

        // Complete the sprint
        sprint.complete()?;
        self.sprint_repo.update_sprint(&sprint).await?;

        // Record velocity and clear active sprint from team
        team.record_sprint_velocity(sprint.completed_points);
        team.set_active_sprint(None);
        self.team_repo.update_team(&team).await?;

        Ok(())
    }

    pub async fn commit_story_points(&self, sprint_id: &Uuid, points: u32) -> Result<(), AppError> {
        let mut sprint = self
            .sprint_repo
            .get_sprint(sprint_id)
            .await?
            .ok_or(AppError::NotFound("Sprint not found".to_string()))?;

        sprint.commit_story_points(points)?;
        self.sprint_repo.update_sprint(&sprint).await
    }

    pub async fn complete_story_points(
        &self,
        sprint_id: &Uuid,
        points: u32,
    ) -> Result<(), AppError> {
        let mut sprint = self
            .sprint_repo
            .get_sprint(sprint_id)
            .await?
            .ok_or(AppError::NotFound("Sprint not found".to_string()))?;

        sprint.complete_story_points(points)?;
        self.sprint_repo.update_sprint(&sprint).await
    }
}
