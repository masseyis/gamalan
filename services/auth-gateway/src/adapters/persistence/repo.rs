use crate::application::ports::UserRepository;
use crate::domain::user::User;
use async_trait::async_trait;
use common::AppError;
use sqlx::PgPool;

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
        .bind(&user.id)
        .bind(&user.external_id)
        .bind(&user.email)
        .bind(&user.created_at)
        .bind(&user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|_| AppError::InternalServerError)?;

        Ok(())
    }
}
