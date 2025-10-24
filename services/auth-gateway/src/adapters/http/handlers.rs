use crate::application::usecases::{
    OrganizationUsecases, SprintUsecases, TeamUsecases, UserUsecases,
};
use crate::domain::organization::{AddMemberRequest, CreateOrganizationRequest, MembershipRole};
use crate::domain::sprint::{CreateSprintRequest, Sprint};
use crate::domain::team::{AddTeamMemberRequest, CreateTeamRequest, Team, TeamMembership};
use crate::domain::user::{ContributorSpecialty, User, UserRole};
use auth_clerk::AuthenticatedWithOrg;
use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::{IntoResponse, Response},
    Extension, Json,
};
use common::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ClerkWebhook {
    pub data: serde_json::Value,
    pub object: String,
    pub r#type: String,
}

#[derive(Deserialize)]
pub struct UserData {
    pub id: String,
    pub email_addresses: Vec<EmailAddress>,
}

#[derive(Deserialize)]
pub struct OrganizationData {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub image_url: Option<String>,
    pub created_by: String,
}

#[derive(Deserialize)]
pub struct EmailAddress {
    pub email_address: String,
}

#[derive(Deserialize)]
pub struct CreateOrganizationDto {
    pub external_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub owner_user_id: Uuid,
}

#[derive(Deserialize)]
pub struct AddMemberDto {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Serialize)]
pub struct OrganizationResponse {
    pub id: Uuid,
    pub external_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Serialize)]
pub struct UserOrganizationsResponse {
    pub organizations: Vec<OrganizationWithMembership>,
}

#[derive(Serialize)]
pub struct OrganizationWithMembership {
    pub id: Uuid,
    pub external_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub role: String,
}

// Team DTOs
#[derive(Deserialize)]
pub struct CreateTeamDto {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct AddTeamMemberDto {
    pub user_id: Uuid,
    pub role: String,
    pub specialty: Option<crate::domain::user::ContributorSpecialty>,
}

#[derive(Deserialize)]
pub struct UpdateTeamDto {
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct TeamResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub organization_id: Uuid,
    pub active_sprint_id: Option<Uuid>,
    pub velocity_history: Vec<u32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Team> for TeamResponse {
    fn from(team: Team) -> Self {
        Self {
            id: team.id,
            name: team.name,
            description: team.description,
            organization_id: team.organization_id,
            active_sprint_id: team.active_sprint_id,
            velocity_history: team.velocity_history,
            created_at: team.created_at,
            updated_at: team.updated_at,
        }
    }
}

#[derive(Serialize)]
pub struct TeamWithMembersResponse {
    #[serde(flatten)]
    pub team: TeamResponse,
    pub members: Vec<TeamMemberSummaryResponse>,
}

impl TeamWithMembersResponse {
    fn from_team(team: Team, members: Vec<TeamMemberSummaryResponse>) -> Self {
        Self {
            team: TeamResponse::from(team),
            members,
        }
    }
}

#[derive(Serialize)]
pub struct TeamMemberResponse {
    pub user: UserResponse,
    pub membership: TeamMembershipResponse,
}

#[derive(Serialize)]
pub struct TeamMemberSummaryResponse {
    #[serde(flatten)]
    pub membership: TeamMembershipResponse,
    #[serde(rename = "userEmail")]
    pub user_email: Option<String>,
    #[serde(rename = "userName")]
    pub user_name: Option<String>,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub external_id: String,
    pub email: String,
    pub role: String,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            external_id: user.external_id,
            email: user.email,
            role: user.role.to_string(),
        }
    }
}

#[derive(Serialize)]
pub struct CurrentUserResponse {
    pub id: Uuid,
    #[serde(rename = "externalId")]
    pub external_id: String,
    pub email: String,
    pub role: String,
    pub specialty: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<User> for CurrentUserResponse {
    fn from(user: User) -> Self {
        let specialty = user.specialty.map(|s| match s {
            ContributorSpecialty::Frontend => "frontend".to_string(),
            ContributorSpecialty::Backend => "backend".to_string(),
            ContributorSpecialty::Fullstack => "fullstack".to_string(),
            ContributorSpecialty::QA => "qa".to_string(),
            ContributorSpecialty::DevOps => "devops".to_string(),
            ContributorSpecialty::UXDesigner => "ux_designer".to_string(),
        });

        Self {
            id: user.id,
            external_id: user.external_id,
            email: user.email,
            role: user.role.to_string(),
            specialty,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateUserRoleRequest {
    pub role: String,
    pub specialty: Option<String>,
}

fn parse_user_role(value: &str) -> Result<UserRole, AppError> {
    UserRole::from_str(value).ok_or_else(|| {
        AppError::BadRequest(format!(
            "Invalid role '{}'. Expected sponsor, product_owner, managing_contributor, or contributor",
            value
        ))
    })
}

fn parse_specialty(value: &str) -> Result<ContributorSpecialty, AppError> {
    match value {
        "frontend" => Ok(ContributorSpecialty::Frontend),
        "backend" => Ok(ContributorSpecialty::Backend),
        "fullstack" => Ok(ContributorSpecialty::Fullstack),
        "qa" => Ok(ContributorSpecialty::QA),
        "devops" => Ok(ContributorSpecialty::DevOps),
        "ux_designer" => Ok(ContributorSpecialty::UXDesigner),
        other => Err(AppError::BadRequest(format!(
            "Invalid specialty '{}'. Expected frontend, backend, fullstack, qa, devops, or ux_designer",
            other
        ))),
    }
}

#[derive(Serialize)]
pub struct TeamMembershipResponse {
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub is_active: bool,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

impl From<TeamMembership> for TeamMembershipResponse {
    fn from(membership: TeamMembership) -> Self {
        Self {
            team_id: membership.team_id,
            user_id: membership.user_id,
            role: membership.role.to_string(),
            is_active: membership.is_active,
            joined_at: membership.joined_at,
        }
    }
}

// Sprint DTOs
#[derive(Deserialize)]
pub struct CreateSprintDto {
    pub name: String,
    pub goal: Option<String>,
    pub capacity_points: Option<u32>,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
}

#[derive(Serialize)]
pub struct SprintResponse {
    pub id: Uuid,
    pub team_id: Uuid,
    pub name: String,
    pub goal: String,
    pub status: String,
    pub committed_story_points: u32,
    pub completed_story_points: u32,
    pub start_date: chrono::NaiveDate,
    pub end_date: chrono::NaiveDate,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<Sprint> for SprintResponse {
    fn from(sprint: Sprint) -> Self {
        Self {
            id: sprint.id,
            team_id: sprint.team_id,
            name: sprint.name,
            goal: sprint.goal,
            status: sprint.status.to_string(),
            committed_story_points: sprint.committed_points,
            completed_story_points: sprint.completed_points,
            start_date: sprint.start_date.date_naive(),
            end_date: sprint.end_date.date_naive(),
            created_at: sprint.created_at,
            updated_at: sprint.updated_at,
        }
    }
}

#[derive(Deserialize)]
pub struct CommitPointsDto {
    pub points: u32,
}

#[derive(Deserialize)]
pub struct CompletePointsDto {
    pub points: u32,
}

#[derive(Serialize)]
pub struct ActionResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Deserialize)]
pub struct SearchUsersQuery {
    pub q: Option<String>,
}

#[derive(Serialize)]
pub struct SearchUserResponse {
    pub id: Uuid,
    #[serde(rename = "externalId")]
    pub external_id: String,
    pub email: String,
    pub role: String,
    #[serde(rename = "specialty")]
    pub specialty: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

pub async fn search_users(
    Extension(user_usecases): Extension<Arc<UserUsecases>>,
    Query(query): Query<SearchUsersQuery>,
) -> Result<Json<Vec<SearchUserResponse>>, AppError> {
    let Some(ref q) = query.q else {
        return Ok(Json(Vec::new()));
    };

    if q.trim().len() < 2 {
        return Ok(Json(Vec::new()));
    }

    let users = user_usecases.search_users(q, 10).await?;

    let responses = users
        .into_iter()
        .map(|user| SearchUserResponse {
            id: user.id,
            external_id: user.external_id,
            email: user.email,
            role: user.role.to_string(),
            specialty: user.specialty.as_ref().map(|specialty| match specialty {
                crate::domain::user::ContributorSpecialty::Frontend => "frontend".to_string(),
                crate::domain::user::ContributorSpecialty::Backend => "backend".to_string(),
                crate::domain::user::ContributorSpecialty::Fullstack => "fullstack".to_string(),
                crate::domain::user::ContributorSpecialty::QA => "qa".to_string(),
                crate::domain::user::ContributorSpecialty::DevOps => "devops".to_string(),
                crate::domain::user::ContributorSpecialty::UXDesigner => "ux_designer".to_string(),
            }),
            created_at: user.created_at,
            updated_at: user.updated_at,
        })
        .collect();
    Ok(Json(responses))
}

pub async fn clerk_webhooks(
    Extension(user_usecases): Extension<Arc<UserUsecases>>,
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Json(payload): Json<ClerkWebhook>,
) -> Result<Response, AppError> {
    if payload.object != "event" {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    }

    match payload.r#type.as_str() {
        "user.created" | "user.updated" => {
            let user_data: UserData = serde_json::from_value(payload.data)
                .map_err(|_| AppError::BadRequest("Invalid user data".to_string()))?;
            let user = User::new(
                user_data.id,
                user_data.email_addresses[0].email_address.clone(),
                UserRole::Contributor, // Default role for new users
                None,                  // No specialty by default
            )
            .map_err(|e| AppError::BadRequest(e.to_string()))?;
            user_usecases.upsert_user(&user).await?;
        }
        "organization.created" => {
            let org_data: OrganizationData = serde_json::from_value(payload.data)
                .map_err(|_| AppError::BadRequest("Invalid organization data".to_string()))?;

            // Find the user who created the organization
            let owner_user = user_usecases
                .get_user_by_external_id(&org_data.created_by)
                .await?
                .ok_or(AppError::NotFound("Creator user not found".to_string()))?;

            let request = CreateOrganizationRequest {
                external_id: org_data.id,
                name: org_data.name,
                slug: org_data.slug,
                description: None,
                image_url: org_data.image_url,
                owner_user_id: owner_user.id,
            };

            org_usecases.create_organization(&request).await?;
        }
        _ => (),
    }

    Ok(StatusCode::OK.into_response())
}

pub async fn create_organization(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Json(dto): Json<CreateOrganizationDto>,
) -> Result<Json<OrganizationResponse>, AppError> {
    let request = CreateOrganizationRequest {
        external_id: dto.external_id,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        image_url: dto.image_url,
        owner_user_id: dto.owner_user_id,
    };

    let org = org_usecases.create_organization(&request).await?;

    Ok(Json(OrganizationResponse {
        id: org.id,
        external_id: org.external_id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        image_url: org.image_url,
    }))
}

pub async fn get_organization_by_external_id(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Path(external_id): Path<String>,
) -> Result<Json<OrganizationResponse>, AppError> {
    let org = org_usecases
        .get_organization_by_external_id(&external_id)
        .await?
        .ok_or(AppError::NotFound("Organization not found".to_string()))?;

    Ok(Json(OrganizationResponse {
        id: org.id,
        external_id: org.external_id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        image_url: org.image_url,
    }))
}

pub async fn get_current_user(
    AuthenticatedWithOrg { auth, .. }: AuthenticatedWithOrg,
    Extension(user_usecases): Extension<Arc<UserUsecases>>,
) -> Result<Json<CurrentUserResponse>, AppError> {
    let user = user_usecases
        .get_user_by_external_id(&auth.sub)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;
    Ok(Json(CurrentUserResponse::from(user)))
}

pub async fn update_current_user_role(
    AuthenticatedWithOrg { auth, .. }: AuthenticatedWithOrg,
    Extension(user_usecases): Extension<Arc<UserUsecases>>,
    Json(payload): Json<UpdateUserRoleRequest>,
) -> Result<impl IntoResponse, AppError> {
    let role = parse_user_role(&payload.role)?;
    let specialty = match payload.specialty {
        Some(ref value) if !value.trim().is_empty() => Some(parse_specialty(value.trim())?),
        _ => None,
    };

    user_usecases
        .update_user_role_by_external_id(&auth.sub, role, specialty)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_user_organizations(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserOrganizationsResponse>, AppError> {
    let orgs = org_usecases.get_user_organizations(&user_id).await?;

    let organizations = orgs
        .into_iter()
        .map(|(org, membership)| {
            let role = match membership.role {
                MembershipRole::Owner => "owner",
                MembershipRole::Admin => "admin",
                MembershipRole::Member => "member",
            };

            OrganizationWithMembership {
                id: org.id,
                external_id: org.external_id,
                name: org.name,
                slug: org.slug,
                description: org.description,
                image_url: org.image_url,
                role: role.to_string(),
            }
        })
        .collect();

    Ok(Json(UserOrganizationsResponse { organizations }))
}

pub async fn get_user_organizations_me(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    auth_with_org: AuthenticatedWithOrg,
) -> Result<Json<UserOrganizationsResponse>, AppError> {
    let user_id = resolve_authenticated_user_uuid(&auth_with_org)?;
    let orgs = org_usecases.get_user_organizations(&user_id).await?;

    let organizations = orgs
        .into_iter()
        .map(|(org, membership)| {
            let role = match membership.role {
                MembershipRole::Owner => "owner",
                MembershipRole::Admin => "admin",
                MembershipRole::Member => "member",
            };

            OrganizationWithMembership {
                id: org.id,
                external_id: org.external_id,
                name: org.name,
                slug: org.slug,
                description: org.description,
                image_url: org.image_url,
                role: role.to_string(),
            }
        })
        .collect();

    Ok(Json(UserOrganizationsResponse { organizations }))
}

pub async fn add_member_to_organization(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Path(org_id): Path<Uuid>,
    Json(dto): Json<AddMemberDto>,
) -> Result<StatusCode, AppError> {
    let role = match dto.role.as_str() {
        "owner" => MembershipRole::Owner,
        "admin" => MembershipRole::Admin,
        "member" => MembershipRole::Member,
        _ => return Err(AppError::BadRequest("Invalid role".to_string())),
    };

    let request = AddMemberRequest {
        user_id: dto.user_id,
        role,
    };

    org_usecases.add_member(&org_id, &request).await?;
    Ok(StatusCode::CREATED)
}

// Team handlers
pub async fn create_team(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(org_id): Path<Uuid>,
    Json(dto): Json<CreateTeamDto>,
) -> Result<impl IntoResponse, AppError> {
    let request = CreateTeamRequest {
        name: dto.name,
        description: dto.description,
        organization_id: org_id,
    };

    let team = team_usecases.create_team(&request).await?;
    Ok((StatusCode::CREATED, Json(TeamResponse::from(team))))
}

pub async fn create_team_with_context(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    auth_with_org: AuthenticatedWithOrg,
    Json(dto): Json<CreateTeamDto>,
) -> Result<impl IntoResponse, AppError> {
    let organization_id = resolve_organization_id(&auth_with_org, &org_usecases).await?;

    let request = CreateTeamRequest {
        name: dto.name,
        description: dto.description,
        organization_id,
    };

    let team = team_usecases.create_team(&request).await?;
    let members = team_usecases
        .get_team_members(&team.id)
        .await?
        .into_iter()
        .map(|(user, membership)| TeamMemberSummaryResponse {
            membership: membership.into(),
            user_email: Some(user.email),
            user_name: None,
        })
        .collect();

    Ok((
        StatusCode::CREATED,
        Json(TeamWithMembersResponse::from_team(team, members)),
    ))
}

pub async fn get_teams_by_organization(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(org_id): Path<Uuid>,
) -> Result<Json<Vec<TeamResponse>>, AppError> {
    let teams = team_usecases.get_teams_by_organization(&org_id).await?;
    let team_responses: Vec<TeamResponse> = teams.into_iter().map(TeamResponse::from).collect();
    Ok(Json(team_responses))
}

pub async fn get_teams_for_context(
    Extension(org_usecases): Extension<Arc<OrganizationUsecases>>,
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    auth_with_org: AuthenticatedWithOrg,
) -> Result<Json<Vec<TeamWithMembersResponse>>, AppError> {
    if let Some(organization_id) =
        try_resolve_organization_id(&auth_with_org, &org_usecases).await?
    {
        let teams = team_usecases
            .get_teams_by_organization(&organization_id)
            .await?;

        let mut responses = Vec::with_capacity(teams.len());
        for team in teams {
            let members = team_usecases
                .get_team_members(&team.id)
                .await?
                .into_iter()
                .map(|(user, membership)| TeamMemberSummaryResponse {
                    membership: membership.into(),
                    user_email: Some(user.email),
                    user_name: None,
                })
                .collect();

            responses.push(TeamWithMembersResponse::from_team(team, members));
        }

        Ok(Json(responses))
    } else {
        // No explicit organization context; fall back to teams the user belongs to
        if let Some(user_uuid) = auth_with_org
            .org_context
            .user_uuid()
            .or_else(|| Uuid::parse_str(&auth_with_org.auth.sub).ok())
        {
            let user_teams = team_usecases.get_user_teams(&user_uuid).await?;
            let mut responses = Vec::with_capacity(user_teams.len());
            for (team, _membership) in user_teams {
                let members = team_usecases
                    .get_team_members(&team.id)
                    .await?
                    .into_iter()
                    .map(|(user, membership)| TeamMemberSummaryResponse {
                        membership: membership.into(),
                        user_email: Some(user.email),
                        user_name: None,
                    })
                    .collect();
                responses.push(TeamWithMembersResponse::from_team(team, members));
            }

            Ok(Json(responses))
        } else {
            // No way to resolve organization or user context; return empty list
            Ok(Json(Vec::new()))
        }
    }
}

async fn resolve_organization_id(
    auth_with_org: &AuthenticatedWithOrg,
    org_usecases: &OrganizationUsecases,
) -> Result<Uuid, AppError> {
    match try_resolve_organization_id(auth_with_org, org_usecases).await? {
        Some(id) => Ok(id),
        None => Err(AppError::BadRequest(
            "Organization context required to perform this action".to_string(),
        )),
    }
}

async fn try_resolve_organization_id(
    auth_with_org: &AuthenticatedWithOrg,
    org_usecases: &OrganizationUsecases,
) -> Result<Option<Uuid>, AppError> {
    let owner_user_id = resolve_authenticated_user_uuid(auth_with_org)?;
    let owner_email = auth_with_org.auth.email.as_deref();

    if let Some(ref identifier) = auth_with_org.org_context.organization_id {
        if let Some(resolved) = resolve_identifier(
            identifier,
            auth_with_org
                .org_context
                .organization_name
                .as_deref()
                .or(auth_with_org.auth.org_name.as_deref()),
            owner_user_id,
            owner_email,
            org_usecases,
        )
        .await?
        {
            return Ok(Some(resolved));
        }
    }

    if let Some(ref external_id) = auth_with_org.org_context.organization_external_id {
        if let Some(resolved) = resolve_identifier(
            external_id,
            auth_with_org
                .org_context
                .organization_name
                .as_deref()
                .or(auth_with_org.auth.org_name.as_deref()),
            owner_user_id,
            owner_email,
            org_usecases,
        )
        .await?
        {
            return Ok(Some(resolved));
        }
    }

    if let Some(ref claim_org_id) = auth_with_org.auth.org_id {
        if let Some(resolved) = resolve_identifier(
            claim_org_id,
            auth_with_org.auth.org_name.as_deref(),
            owner_user_id,
            owner_email,
            org_usecases,
        )
        .await?
        {
            return Ok(Some(resolved));
        }
    }

    if let Some(orgs) = &auth_with_org.auth.orgs {
        if orgs.len() == 1 {
            if let Some(resolved) = resolve_identifier(
                &orgs[0],
                auth_with_org.auth.org_name.as_deref(),
                owner_user_id,
                owner_email,
                org_usecases,
            )
            .await?
            {
                return Ok(Some(resolved));
            }
        } else if orgs.len() > 1 {
            return Err(AppError::BadRequest(
                "Multiple organizations detected; specify X-Organization-Id header".to_string(),
            ));
        }
    }

    Ok(None)
}

fn resolve_authenticated_user_uuid(auth_with_org: &AuthenticatedWithOrg) -> Result<Uuid, AppError> {
    if let Some(uuid) = auth_with_org.org_context.user_uuid() {
        return Ok(uuid);
    }

    if let Ok(uuid) = Uuid::parse_str(&auth_with_org.auth.sub) {
        return Ok(uuid);
    }

    Err(AppError::Unauthorized(
        "User context missing user identifier".to_string(),
    ))
}

async fn resolve_identifier(
    identifier: &str,
    fallback_name: Option<&str>,
    owner_user_id: Uuid,
    owner_email: Option<&str>,
    org_usecases: &OrganizationUsecases,
) -> Result<Option<Uuid>, AppError> {
    if let Ok(uuid) = Uuid::parse_str(identifier) {
        return Ok(Some(uuid));
    }

    let organization = org_usecases
        .ensure_organization_registered(identifier, fallback_name, owner_user_id, owner_email)
        .await?;

    Ok(Some(organization.id))
}

pub async fn get_team(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
) -> Result<Json<TeamResponse>, AppError> {
    let team = team_usecases
        .get_team(&team_id)
        .await?
        .ok_or(AppError::NotFound("Team not found".to_string()))?;
    Ok(Json(TeamResponse::from(team)))
}

pub async fn update_team(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
    Json(dto): Json<UpdateTeamDto>,
) -> Result<Json<TeamResponse>, AppError> {
    let updated_team = team_usecases
        .update_team_details(&team_id, dto.name, dto.description)
        .await?;

    Ok(Json(TeamResponse::from(updated_team)))
}

pub async fn delete_team(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    team_usecases.delete_team(&team_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_team_member(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
    Json(dto): Json<AddTeamMemberDto>,
) -> Result<impl IntoResponse, AppError> {
    let role = UserRole::from_str(&dto.role)
        .ok_or_else(|| AppError::BadRequest("Invalid user role".to_string()))?;

    let request = AddTeamMemberRequest {
        user_id: dto.user_id,
        role,
        specialty: dto.specialty,
    };

    // For now, use a placeholder for the requester user ID
    // In a real implementation, this would come from JWT authentication
    let requester_user_id = dto.user_id; // This would be extracted from auth context

    let membership = team_usecases
        .add_team_member(&team_id, &request, &requester_user_id)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(TeamMembershipResponse::from(membership)),
    ))
}

pub async fn get_team_members(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Vec<TeamMemberResponse>>, AppError> {
    let members = team_usecases.get_team_members(&team_id).await?;
    let member_responses: Vec<TeamMemberResponse> = members
        .into_iter()
        .map(|(user, membership)| TeamMemberResponse {
            user: UserResponse::from(user),
            membership: TeamMembershipResponse::from(membership),
        })
        .collect();
    Ok(Json(member_responses))
}

pub async fn get_user_teams(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<TeamResponse>>, AppError> {
    let user_teams = team_usecases.get_user_teams(&user_id).await?;
    let team_responses: Vec<TeamResponse> = user_teams
        .into_iter()
        .map(|(team, _membership)| TeamResponse::from(team))
        .collect();
    Ok(Json(team_responses))
}

// Sprint handlers
pub async fn create_sprint(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(team_id): Path<Uuid>,
    Json(dto): Json<CreateSprintDto>,
) -> Result<impl IntoResponse, AppError> {
    use chrono::{TimeZone, Utc};

    let request = CreateSprintRequest {
        team_id,
        name: dto.name,
        goal: dto.goal.unwrap_or_default(),
        capacity_points: dto.capacity_points.unwrap_or(40),
        start_date: Utc.from_utc_datetime(&dto.start_date.and_hms_opt(0, 0, 0).unwrap()),
        end_date: Utc.from_utc_datetime(&dto.end_date.and_hms_opt(23, 59, 59).unwrap()),
    };

    let sprint = sprint_usecases.create_sprint(&request).await?;
    Ok((StatusCode::CREATED, Json(SprintResponse::from(sprint))))
}

pub async fn get_sprint(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
) -> Result<Json<SprintResponse>, AppError> {
    let sprint = sprint_usecases
        .get_sprint(&sprint_id)
        .await?
        .ok_or(AppError::NotFound("Sprint not found".to_string()))?;
    Ok(Json(SprintResponse::from(sprint)))
}

pub async fn get_sprints_by_team(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Vec<SprintResponse>>, AppError> {
    let sprints = sprint_usecases.get_sprints_by_team(&team_id).await?;
    let sprint_responses: Vec<SprintResponse> =
        sprints.into_iter().map(SprintResponse::from).collect();
    Ok(Json(sprint_responses))
}

pub async fn get_active_sprint_by_team(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(team_id): Path<Uuid>,
) -> Result<Json<Option<SprintResponse>>, AppError> {
    let sprint = sprint_usecases.get_active_sprint_by_team(&team_id).await?;
    Ok(Json(sprint.map(SprintResponse::from)))
}

pub async fn start_sprint(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
) -> Result<Json<ActionResponse>, AppError> {
    sprint_usecases.start_sprint(&sprint_id).await?;
    Ok(Json(ActionResponse {
        success: true,
        message: "Sprint started successfully".to_string(),
    }))
}

pub async fn move_sprint_to_review(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
) -> Result<Json<ActionResponse>, AppError> {
    sprint_usecases.move_sprint_to_review(&sprint_id).await?;
    Ok(Json(ActionResponse {
        success: true,
        message: "Sprint moved to review successfully".to_string(),
    }))
}

pub async fn complete_sprint(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
) -> Result<Json<ActionResponse>, AppError> {
    sprint_usecases.complete_sprint(&sprint_id).await?;
    Ok(Json(ActionResponse {
        success: true,
        message: "Sprint completed successfully".to_string(),
    }))
}

pub async fn commit_story_points(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
    Json(dto): Json<CommitPointsDto>,
) -> Result<Json<ActionResponse>, AppError> {
    sprint_usecases
        .commit_story_points(&sprint_id, dto.points)
        .await?;
    Ok(Json(ActionResponse {
        success: true,
        message: "Story points committed successfully".to_string(),
    }))
}

pub async fn complete_story_points(
    Extension(sprint_usecases): Extension<Arc<SprintUsecases>>,
    Path(sprint_id): Path<Uuid>,
    Json(dto): Json<CompletePointsDto>,
) -> Result<Json<ActionResponse>, AppError> {
    sprint_usecases
        .complete_story_points(&sprint_id, dto.points)
        .await?;
    Ok(Json(ActionResponse {
        success: true,
        message: "Story points completed successfully".to_string(),
    }))
}
