use crate::domain::organization::{MembershipRole, Organization, OrganizationMembership};
use crate::domain::user::{ContributorSpecialty, User, UserRole};
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
pub struct UserDb {
    pub id: Uuid,
    pub external_id: String,
    pub email: String,
    pub role: String,
    pub specialty: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<UserDb> for User {
    fn from(user_db: UserDb) -> Self {
        let role = match user_db.role.as_str() {
            "sponsor" => UserRole::Sponsor,
            "product_owner" => UserRole::ProductOwner,
            "managing_contributor" => UserRole::ManagingContributor,
            "contributor" => UserRole::Contributor,
            _ => UserRole::Contributor, // default fallback
        };

        let specialty = user_db.specialty.and_then(|s| match s.as_str() {
            "frontend" => Some(ContributorSpecialty::Frontend),
            "backend" => Some(ContributorSpecialty::Backend),
            "fullstack" => Some(ContributorSpecialty::Fullstack),
            "qa" => Some(ContributorSpecialty::QA),
            "devops" => Some(ContributorSpecialty::DevOps),
            "ux_designer" => Some(ContributorSpecialty::UXDesigner),
            _ => None,
        });

        Self {
            id: user_db.id,
            external_id: user_db.external_id,
            email: user_db.email,
            role,
            specialty,
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
