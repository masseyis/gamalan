use crate::application::ports::UserRepository;
use crate::domain::user::User;
use common::AppError;
use std::sync::Arc;

pub struct UserUsecases {
    user_repo: Arc<dyn UserRepository>,
}

impl UserUsecases {
    pub fn new(user_repo: Arc<dyn UserRepository>) -> Self {
        Self { user_repo }
    }

    pub async fn upsert_user(&self, user: &User) -> Result<(), AppError> {
        self.user_repo.upsert_user(user).await
    }
}
