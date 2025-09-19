use crate::application::usecases::{OrganizationUsecases, UserUsecases};
use crate::domain::organization::{AddMemberRequest, CreateOrganizationRequest, MembershipRole};
use crate::domain::user::User;
use axum::{
    extract::Path,
    http::StatusCode,
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::Utc;
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
            let user = User {
                id: Uuid::new_v4(),
                external_id: user_data.id,
                email: user_data.email_addresses[0].email_address.clone(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
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
