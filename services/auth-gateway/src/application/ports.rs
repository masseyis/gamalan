use crate::domain::user::User;
use async_trait::async_trait;
use common::AppError;

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn upsert_user(&self, user: &User) -> Result<(), AppError>;
}
