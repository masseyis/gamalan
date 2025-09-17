use crate::application::ports::{OrganizationRepository, UserRepository};
use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, Organization, OrganizationMembership,
};
use crate::domain::user::User;
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
            .get_user_by_external_id(&request.owner_user_id.to_string())
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
}
