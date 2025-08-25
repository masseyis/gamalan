use crate::application::usecases::UserUsecases;
use crate::domain::user::User;
use axum::{
    Extension,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use common::AppError;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ClerkWebhook {
    pub data: UserData,
    pub object: String,
    pub r#type: String,
}

#[derive(Deserialize)]
pub struct UserData {
    pub id: String,
    pub email_addresses: Vec<EmailAddress>,
}

#[derive(Deserialize)]
pub struct EmailAddress {
    pub email_address: String,
}

pub async fn clerk_webhooks(
    Extension(user_usecases): Extension<Arc<UserUsecases>>,
    Json(payload): Json<ClerkWebhook>,
) -> Result<Response, AppError> {
    if payload.object != "event" {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    }

    match payload.r#type.as_str() {
        "user.created" | "user.updated" => {
            let user = User {
                id: Uuid::new_v4(),
                external_id: payload.data.id,
                email: payload.data.email_addresses[0].email_address.clone(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            user_usecases.upsert_user(&user).await?;
        }
        _ => (),
    }

    Ok(StatusCode::OK.into_response())
}

pub async fn health() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

pub async fn ready() -> impl IntoResponse {
    (StatusCode::OK, "Ready")
}
