use crate::adapters::persistence::models::{OrganizationDb, OrganizationMembershipDb, UserDb};
use crate::application::ports::{OrganizationRepository, UserRepository};
use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, MembershipRole, Organization,
    OrganizationMembership,
};
use crate::domain::user::User;
use async_trait::async_trait;
use chrono::Utc;
use common::AppError;
use sqlx::PgPool;
use uuid::Uuid;

pub struct UserRepositoryImpl {
    pool: PgPool,
}

impl UserRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for UserRepositoryImpl {
    async fn upsert_user(&self, user: &User) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO users (id, external_id, email, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (external_id)
            DO UPDATE SET
                email = $3,
                updated_at = $5
            "#,
        )
        .bind(user.id)
        .bind(&user.external_id)
        .bind(&user.email)
        .bind(user.created_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }

    async fn get_user_by_external_id(&self, external_id: &str) -> Result<Option<User>, AppError> {
        let user_db = sqlx::query_as::<_, UserDb>("SELECT * FROM users WHERE external_id = $1")
            .bind(external_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(user_db.map(Into::into))
    }
}

pub struct OrganizationRepositoryImpl {
    pool: PgPool,
}

impl OrganizationRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OrganizationRepository for OrganizationRepositoryImpl {
    async fn create_organization(
        &self,
        request: &CreateOrganizationRequest,
    ) -> Result<Organization, AppError> {
        let now = Utc::now();
        let org_id = Uuid::new_v4();

        // Start transaction
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        // Create organization
        sqlx::query(
            r#"
            INSERT INTO organizations (id, external_id, name, slug, description, image_url, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(org_id)
        .bind(&request.external_id)
        .bind(&request.name)
        .bind(&request.slug)
        .bind(&request.description)
        .bind(&request.image_url)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        // Add owner membership
        let membership_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO organization_memberships (id, organization_id, user_id, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(membership_id)
        .bind(org_id)
        .bind(request.owner_user_id)
        .bind("owner")
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        // Commit transaction
        tx.commit()
            .await
            .map_err(|_| AppError::InternalServerError)?;

        Ok(Organization {
            id: org_id,
            external_id: request.external_id.clone(),
            name: request.name.clone(),
            slug: request.slug.clone(),
            description: request.description.clone(),
            image_url: request.image_url.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_organization_by_external_id(
        &self,
        external_id: &str,
    ) -> Result<Option<Organization>, AppError> {
        let org_db = sqlx::query_as::<_, OrganizationDb>(
            "SELECT * FROM organizations WHERE external_id = $1",
        )
        .bind(external_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(org_db.map(Into::into))
    }

    async fn get_organization_by_id(&self, id: &Uuid) -> Result<Option<Organization>, AppError> {
        let org_db =
            sqlx::query_as::<_, OrganizationDb>("SELECT * FROM organizations WHERE id = $1")
                .bind(id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|_| AppError::InternalServerError)?;

        Ok(org_db.map(Into::into))
    }

    async fn get_user_organizations(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<(Organization, OrganizationMembership)>, AppError> {
        // Use regular query instead of sqlx::query! to avoid compile-time DB requirement
        #[derive(sqlx::FromRow)]
        struct UserOrgRow {
            org_id: Uuid,
            external_id: String,
            name: String,
            slug: String,
            description: Option<String>,
            image_url: Option<String>,
            org_created_at: chrono::DateTime<chrono::Utc>,
            org_updated_at: chrono::DateTime<chrono::Utc>,
            membership_id: Uuid,
            organization_id: Uuid,
            user_id: Uuid,
            role: String,
            membership_created_at: chrono::DateTime<chrono::Utc>,
            membership_updated_at: chrono::DateTime<chrono::Utc>,
        }

        let results = sqlx::query_as::<_, UserOrgRow>(
            r#"
            SELECT
                o.id as org_id, o.external_id, o.name, o.slug, o.description, o.image_url,
                o.created_at as org_created_at, o.updated_at as org_updated_at,
                m.id as membership_id, m.organization_id, m.user_id, m.role,
                m.created_at as membership_created_at, m.updated_at as membership_updated_at
            FROM organizations o
            INNER JOIN organization_memberships m ON o.id = m.organization_id
            WHERE m.user_id = $1
            ORDER BY o.name
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        let mut organizations = Vec::new();
        for row in results {
            let org = Organization {
                id: row.org_id,
                external_id: row.external_id,
                name: row.name,
                slug: row.slug,
                description: row.description,
                image_url: row.image_url,
                created_at: row.org_created_at,
                updated_at: row.org_updated_at,
            };

            let role = match row.role.as_str() {
                "owner" => MembershipRole::Owner,
                "admin" => MembershipRole::Admin,
                "member" => MembershipRole::Member,
                _ => MembershipRole::Member,
            };

            let membership = OrganizationMembership {
                id: row.membership_id,
                organization_id: row.organization_id,
                user_id: row.user_id,
                role,
                created_at: row.membership_created_at,
                updated_at: row.membership_updated_at,
            };

            organizations.push((org, membership));
        }

        Ok(organizations)
    }

    async fn add_member(
        &self,
        organization_id: &Uuid,
        request: &AddMemberRequest,
    ) -> Result<OrganizationMembership, AppError> {
        let now = Utc::now();
        let membership_id = Uuid::new_v4();
        let role_str = match request.role {
            MembershipRole::Owner => "owner",
            MembershipRole::Admin => "admin",
            MembershipRole::Member => "member",
        };

        sqlx::query(
            r#"
            INSERT INTO organization_memberships (id, organization_id, user_id, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(membership_id)
        .bind(organization_id)
        .bind(request.user_id)
        .bind(role_str)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(OrganizationMembership {
            id: membership_id,
            organization_id: *organization_id,
            user_id: request.user_id,
            role: request.role.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_membership(
        &self,
        organization_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<Option<OrganizationMembership>, AppError> {
        let membership_db = sqlx::query_as::<_, OrganizationMembershipDb>(
            "SELECT * FROM organization_memberships WHERE organization_id = $1 AND user_id = $2",
        )
        .bind(organization_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(membership_db.map(Into::into))
    }

    async fn remove_member(&self, organization_id: &Uuid, user_id: &Uuid) -> Result<(), AppError> {
        sqlx::query(
            "DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2",
        )
        .bind(organization_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }
}
