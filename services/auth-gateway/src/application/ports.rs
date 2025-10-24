use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, Organization, OrganizationMembership,
};
use crate::domain::sprint::{CreateSprintRequest, Sprint};
use crate::domain::team::{AddTeamMemberRequest, CreateTeamRequest, Team, TeamMembership};
use crate::domain::user::User;
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn upsert_user(&self, user: &User) -> Result<(), AppError>;
    async fn get_user_by_external_id(&self, external_id: &str) -> Result<Option<User>, AppError>;
    async fn get_user_by_id(&self, id: &Uuid) -> Result<Option<User>, AppError>;
    async fn search_users(&self, query: &str, limit: usize) -> Result<Vec<User>, AppError>;
}

#[async_trait]
pub trait OrganizationRepository: Send + Sync {
    async fn create_organization(
        &self,
        request: &CreateOrganizationRequest,
    ) -> Result<Organization, AppError>;
    async fn get_organization_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<Organization>, AppError>;
    async fn get_organization_by_id(&self, id: &Uuid) -> Result<Option<Organization>, AppError>;
    async fn get_user_organizations(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<(Organization, OrganizationMembership)>, AppError>;
    async fn add_member(
        &self,
        organization_id: &Uuid,
        request: &AddMemberRequest,
    ) -> Result<OrganizationMembership, AppError>;
    #[allow(dead_code)]
    async fn get_membership(
        &self,
        organization_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<OrganizationMembership>, AppError>;
    #[allow(dead_code)]
    async fn remove_member(&self, organization_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
}

#[async_trait]
pub trait TeamRepository: Send + Sync {
    async fn create_team(&self, request: &CreateTeamRequest) -> Result<Team, AppError>;
    async fn get_team(&self, id: &Uuid) -> Result<Option<Team>, AppError>;
    async fn get_teams_by_organization(
        &self,
        organization_id: &Uuid,
    ) -> Result<Vec<Team>, AppError>;
    async fn update_team(&self, team: &Team) -> Result<(), AppError>;
    async fn delete_team(&self, id: &Uuid) -> Result<(), AppError>;

    // Team membership management
    async fn add_team_member(
        &self,
        team_id: &Uuid,
        request: &AddTeamMemberRequest,
    ) -> Result<TeamMembership, AppError>;
    async fn get_team_members(
        &self,
        team_id: &Uuid,
    ) -> Result<Vec<(User, TeamMembership)>, AppError>;
    async fn get_user_teams(&self, user_id: &Uuid)
        -> Result<Vec<(Team, TeamMembership)>, AppError>;
    async fn remove_team_member(&self, team_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
    async fn update_team_member(&self, membership: &TeamMembership) -> Result<(), AppError>;
}

#[async_trait]
pub trait SprintRepository: Send + Sync {
    async fn create_sprint(&self, request: &CreateSprintRequest) -> Result<Sprint, AppError>;
    async fn get_sprint(&self, id: &Uuid) -> Result<Option<Sprint>, AppError>;
    async fn get_sprints_by_team(&self, team_id: &Uuid) -> Result<Vec<Sprint>, AppError>;
    async fn get_active_sprint_by_team(&self, team_id: &Uuid) -> Result<Option<Sprint>, AppError>;
    async fn update_sprint(&self, sprint: &Sprint) -> Result<(), AppError>;
    async fn delete_sprint(&self, id: &Uuid) -> Result<(), AppError>;
}
