use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Organization {
    pub id: Uuid,
    pub external_id: String, // Clerk organization ID
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OrganizationMembership {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: MembershipRole,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MembershipRole {
    Owner,
    Admin,
    Member,
}

impl MembershipRole {
    #[allow(dead_code)]
    pub fn can_manage_organization(&self) -> bool {
        matches!(self, MembershipRole::Owner | MembershipRole::Admin)
    }

    #[allow(dead_code)]
    pub fn can_invite_members(&self) -> bool {
        matches!(self, MembershipRole::Owner | MembershipRole::Admin)
    }

    #[allow(dead_code)]
    pub fn can_remove_members(&self) -> bool {
        matches!(self, MembershipRole::Owner | MembershipRole::Admin)
    }

    #[allow(dead_code)]
    pub fn can_manage_projects(&self) -> bool {
        true // All members can manage projects for now
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrganizationRequest {
    pub external_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub owner_user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct UpdateOrganizationRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
    pub role: MembershipRole,
}
