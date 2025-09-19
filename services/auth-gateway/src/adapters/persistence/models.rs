use crate::domain::organization::{MembershipRole, Organization, OrganizationMembership};
use crate::domain::user::User;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
pub struct UserDb {
    pub id: Uuid,
    pub external_id: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<UserDb> for User {
    fn from(user_db: UserDb) -> Self {
        Self {
            id: user_db.id,
            external_id: user_db.external_id,
            email: user_db.email,
            created_at: user_db.created_at,
            updated_at: user_db.updated_at,
        }
    }
}

#[derive(FromRow)]
pub struct OrganizationDb {
    pub id: Uuid,
    pub external_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<OrganizationDb> for Organization {
    fn from(org_db: OrganizationDb) -> Self {
        Self {
            id: org_db.id,
            external_id: org_db.external_id,
            name: org_db.name,
            slug: org_db.slug,
            description: org_db.description,
            image_url: org_db.image_url,
            created_at: org_db.created_at,
            updated_at: org_db.updated_at,
        }
    }
}

#[derive(FromRow)]
pub struct OrganizationMembershipDb {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<OrganizationMembershipDb> for OrganizationMembership {
    fn from(membership_db: OrganizationMembershipDb) -> Self {
        let role = match membership_db.role.as_str() {
            "owner" => MembershipRole::Owner,
            "admin" => MembershipRole::Admin,
            "member" => MembershipRole::Member,
            _ => MembershipRole::Member, // default fallback
        };

        Self {
            id: membership_db.id,
            organization_id: membership_db.organization_id,
            user_id: membership_db.user_id,
            role,
            created_at: membership_db.created_at,
            updated_at: membership_db.updated_at,
        }
    }
}
