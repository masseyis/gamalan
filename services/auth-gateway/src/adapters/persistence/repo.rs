use crate::adapters::persistence::models::{OrganizationDb, OrganizationMembershipDb, UserDb};
use crate::application::ports::{
    OrganizationRepository, SprintRepository, TeamRepository, UserRepository,
};
use crate::domain::organization::{
    AddMemberRequest, CreateOrganizationRequest, MembershipRole, Organization,
    OrganizationMembership,
};
use crate::domain::sprint::{CreateSprintRequest, Sprint};
use crate::domain::team::{AddTeamMemberRequest, CreateTeamRequest, Team, TeamMembership};
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
        let role_str = match user.role {
            crate::domain::user::UserRole::Sponsor => "sponsor",
            crate::domain::user::UserRole::ProductOwner => "product_owner",
            crate::domain::user::UserRole::ManagingContributor => "managing_contributor",
            crate::domain::user::UserRole::Contributor => "contributor",
        };

        let specialty_str = user.specialty.as_ref().map(|s| match s {
            crate::domain::user::ContributorSpecialty::Frontend => "frontend",
            crate::domain::user::ContributorSpecialty::Backend => "backend",
            crate::domain::user::ContributorSpecialty::Fullstack => "fullstack",
            crate::domain::user::ContributorSpecialty::QA => "qa",
            crate::domain::user::ContributorSpecialty::DevOps => "devops",
            crate::domain::user::ContributorSpecialty::UXDesigner => "ux_designer",
        });

        sqlx::query(
            r#"
            INSERT INTO users (id, external_id, email, role, specialty, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (external_id)
            DO UPDATE SET
                email = $3,
                role = $4,
                specialty = $5,
                updated_at = $7
            "#,
        )
        .bind(user.id)
        .bind(&user.external_id)
        .bind(&user.email)
        .bind(role_str)
        .bind(specialty_str)
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

pub struct TeamRepositoryImpl {
    pool: PgPool,
}

impl TeamRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TeamRepository for TeamRepositoryImpl {
    async fn create_team(&self, request: &CreateTeamRequest) -> Result<Team, AppError> {
        let team_id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO teams (id, name, organization_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(team_id)
        .bind(&request.name)
        .bind(&request.organization_id)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(Team {
            id: team_id,
            name: request.name.clone(),
            organization_id: request.organization_id,
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_team(&self, team_id: &Uuid) -> Result<Option<Team>, AppError> {
        let team = sqlx::query_as!(
            Team,
            "SELECT id, name, organization_id, created_at, updated_at FROM teams WHERE id = $1",
            team_id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(team)
    }

    async fn get_teams_by_organization(&self, org_id: &Uuid) -> Result<Vec<Team>, AppError> {
        let teams = sqlx::query_as!(
            Team,
            "SELECT id, name, organization_id, created_at, updated_at FROM teams WHERE organization_id = $1 ORDER BY name",
            org_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(teams)
    }

    async fn add_team_member(
        &self,
        request: &AddTeamMemberRequest,
    ) -> Result<TeamMembership, AppError> {
        let membership_id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO team_memberships (id, team_id, user_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(membership_id)
        .bind(&request.team_id)
        .bind(&request.user_id)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(TeamMembership {
            id: membership_id,
            team_id: request.team_id,
            user_id: request.user_id,
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_team_members(&self, team_id: &Uuid) -> Result<Vec<TeamMembership>, AppError> {
        let memberships = sqlx::query_as!(
            TeamMembership,
            "SELECT id, team_id, user_id, created_at, updated_at FROM team_memberships WHERE team_id = $1",
            team_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(memberships)
    }

    async fn get_user_teams(&self, user_id: &Uuid) -> Result<Vec<Team>, AppError> {
        let teams = sqlx::query_as!(
            Team,
            r#"
            SELECT t.id, t.name, t.organization_id, t.created_at, t.updated_at
            FROM teams t
            INNER JOIN team_memberships tm ON t.id = tm.team_id
            WHERE tm.user_id = $1
            ORDER BY t.name
            "#,
            user_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(teams)
    }
}

pub struct SprintRepositoryImpl {
    pool: PgPool,
}

impl SprintRepositoryImpl {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SprintRepository for SprintRepositoryImpl {
    async fn create_sprint(&self, request: &CreateSprintRequest) -> Result<Sprint, AppError> {
        let sprint_id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO sprints (id, name, team_id, start_date, end_date, status,
                               committed_story_points, completed_story_points, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(sprint_id)
        .bind(&request.name)
        .bind(&request.team_id)
        .bind(&request.start_date)
        .bind(&request.end_date)
        .bind("planning")
        .bind(0i32)
        .bind(0i32)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(Sprint {
            id: sprint_id,
            name: request.name.clone(),
            team_id: request.team_id,
            goal: "".to_string(), // TODO: Add goal field to database
            start_date: request.start_date,
            end_date: request.end_date,
            status: crate::domain::sprint::SprintStatus::Planning,
            committed_story_points: 0,
            completed_story_points: 0,
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_sprint(&self, sprint_id: &Uuid) -> Result<Option<Sprint>, AppError> {
        #[derive(sqlx::FromRow)]
        struct SprintRow {
            id: Uuid,
            name: String,
            team_id: Uuid,
            start_date: chrono::DateTime<chrono::Utc>,
            end_date: chrono::DateTime<chrono::Utc>,
            status: String,
            committed_story_points: i32,
            completed_story_points: i32,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let sprint_row = sqlx::query_as::<_, SprintRow>(
            "SELECT id, name, team_id, start_date, end_date, status, committed_story_points, completed_story_points, created_at, updated_at FROM sprints WHERE id = $1"
        )
        .bind(sprint_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        if let Some(row) = sprint_row {
            let status = match row.status.as_str() {
                "planning" => crate::domain::sprint::SprintStatus::Planning,
                "active" => crate::domain::sprint::SprintStatus::Active,
                "review" => crate::domain::sprint::SprintStatus::Review,
                "completed" => crate::domain::sprint::SprintStatus::Completed,
                _ => crate::domain::sprint::SprintStatus::Planning,
            };

            Ok(Some(Sprint {
                id: row.id,
                name: row.name,
                team_id: row.team_id,
                goal: "".to_string(), // TODO: Add goal field to database
                start_date: row.start_date,
                end_date: row.end_date,
                status,
                committed_story_points: row.committed_story_points as u32,
                completed_story_points: row.completed_story_points as u32,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn get_sprints_by_team(&self, team_id: &Uuid) -> Result<Vec<Sprint>, AppError> {
        #[derive(sqlx::FromRow)]
        struct SprintRow {
            id: Uuid,
            name: String,
            team_id: Uuid,
            start_date: chrono::DateTime<chrono::Utc>,
            end_date: chrono::DateTime<chrono::Utc>,
            status: String,
            committed_story_points: i32,
            completed_story_points: i32,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let sprint_rows = sqlx::query_as::<_, SprintRow>(
            "SELECT id, name, team_id, start_date, end_date, status, committed_story_points, completed_story_points, created_at, updated_at FROM sprints WHERE team_id = $1 ORDER BY start_date DESC"
        )
        .bind(team_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        let sprints = sprint_rows
            .into_iter()
            .map(|row| {
                let status = match row.status.as_str() {
                    "planning" => crate::domain::sprint::SprintStatus::Planning,
                    "active" => crate::domain::sprint::SprintStatus::Active,
                    "review" => crate::domain::sprint::SprintStatus::Review,
                    "completed" => crate::domain::sprint::SprintStatus::Completed,
                    _ => crate::domain::sprint::SprintStatus::Planning,
                };

                Sprint {
                    id: row.id,
                    name: row.name,
                    team_id: row.team_id,
                    goal: "".to_string(), // TODO: Add goal field to database
                    start_date: row.start_date,
                    end_date: row.end_date,
                    status,
                    committed_story_points: row.committed_story_points as u32,
                    completed_story_points: row.completed_story_points as u32,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                }
            })
            .collect();

        Ok(sprints)
    }

    async fn get_active_sprint_by_team(&self, team_id: &Uuid) -> Result<Option<Sprint>, AppError> {
        #[derive(sqlx::FromRow)]
        struct SprintRow {
            id: Uuid,
            name: String,
            team_id: Uuid,
            start_date: chrono::DateTime<chrono::Utc>,
            end_date: chrono::DateTime<chrono::Utc>,
            status: String,
            committed_story_points: i32,
            completed_story_points: i32,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let sprint_row = sqlx::query_as::<_, SprintRow>(
            "SELECT id, name, team_id, start_date, end_date, status, committed_story_points, completed_story_points, created_at, updated_at FROM sprints WHERE team_id = $1 AND status = 'active' LIMIT 1"
        )
        .bind(team_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        if let Some(row) = sprint_row {
            Ok(Some(Sprint {
                id: row.id,
                name: row.name,
                team_id: row.team_id,
                goal: "".to_string(), // TODO: Add goal field to database
                start_date: row.start_date,
                end_date: row.end_date,
                status: crate::domain::sprint::SprintStatus::Active,
                committed_story_points: row.committed_story_points as u32,
                completed_story_points: row.completed_story_points as u32,
                created_at: row.created_at,
                updated_at: row.updated_at,
            }))
        } else {
            Ok(None)
        }
    }

    async fn update_sprint(&self, sprint: &Sprint) -> Result<(), AppError> {
        let status_str = match sprint.status {
            crate::domain::sprint::SprintStatus::Planning => "planning",
            crate::domain::sprint::SprintStatus::Active => "active",
            crate::domain::sprint::SprintStatus::Review => "review",
            crate::domain::sprint::SprintStatus::Completed => "completed",
        };

        sqlx::query(
            r#"
            UPDATE sprints
            SET name = $2, start_date = $3, end_date = $4, status = $5,
                committed_story_points = $6, completed_story_points = $7, updated_at = $8
            WHERE id = $1
            "#,
        )
        .bind(&sprint.id)
        .bind(&sprint.name)
        .bind(&sprint.start_date)
        .bind(&sprint.end_date)
        .bind(status_str)
        .bind(sprint.committed_story_points as i32)
        .bind(sprint.completed_story_points as i32)
        .bind(Utc::now())
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }
}
