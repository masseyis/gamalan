use crate::application::usecases::{
    OrganizationUsecases, SprintUsecases, TeamUsecases, UserUsecases,
};
use crate::domain::organization::{AddMemberRequest, CreateOrganizationRequest, MembershipRole};
use crate::domain::sprint::{CreateSprintRequest, Sprint};
use crate::domain::team::{AddTeamMemberRequest, CreateTeamRequest, Team, TeamMembership};
use crate::domain::user::{User, UserRole};
use axum::{
    extract::Path,
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
}

#[derive(Deserialize)]
pub struct AddTeamMemberDto {
    pub user_id: Uuid,
    pub role: String,
    pub specialty: Option<crate::domain::user::ContributorSpecialty>,
}

#[derive(Serialize)]
pub struct TeamResponse {
    pub id: Uuid,
    pub name: String,
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
            organization_id: team.organization_id,
            active_sprint_id: team.active_sprint_id,
            velocity_history: team.velocity_history,
            created_at: team.created_at,
            updated_at: team.updated_at,
        }
    }
}

#[derive(Serialize)]
pub struct TeamMemberResponse {
    pub user: UserResponse,
    pub membership: TeamMembershipResponse,
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
            committed_story_points: sprint.committed_story_points,
            completed_story_points: sprint.completed_story_points,
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
        organization_id: org_id,
    };

    let team = team_usecases.create_team(&request).await?;
    Ok((StatusCode::CREATED, Json(TeamResponse::from(team))))
}

pub async fn get_teams_by_organization(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(org_id): Path<Uuid>,
) -> Result<Json<Vec<TeamResponse>>, AppError> {
    let teams = team_usecases.get_teams_by_organization(&org_id).await?;
    let team_responses: Vec<TeamResponse> = teams.into_iter().map(TeamResponse::from).collect();
    Ok(Json(team_responses))
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

pub async fn add_team_member(
    Extension(team_usecases): Extension<Arc<TeamUsecases>>,
    Path(team_id): Path<Uuid>,
    Json(dto): Json<AddTeamMemberDto>,
) -> Result<impl IntoResponse, AppError> {
    let role = UserRole::from_str(&dto.role)
        .ok_or_else(|| AppError::BadRequest("Invalid user role".to_string()))?;

    let request = AddTeamMemberRequest {
        team_id,
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
    use chrono::{DateTime, TimeZone, Utc};

    let request = CreateSprintRequest {
        team_id,
        name: dto.name,
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
