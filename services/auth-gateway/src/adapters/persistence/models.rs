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
