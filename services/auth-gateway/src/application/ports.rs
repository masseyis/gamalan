use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, Organization, OrganizationMembership,
};
use crate::domain::user::User;
use async_trait::async_trait;
use common::AppError;
use uuid::Uuid;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn upsert_user(&self, user: &User) -> Result<(), AppError>;
    async fn get_user_by_external_id(&self, external_id: &str) -> Result<Option<User>, AppError>;
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
