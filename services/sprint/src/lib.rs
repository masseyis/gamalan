pub mod adapters;
pub mod domain;

use common::AppError;
use domain::Sprint;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

pub struct SprintsUsecases {
    pool: Arc<PgPool>,
}

impl SprintsUsecases {
    pub fn new(pool: Arc<PgPool>) -> Self {
        Self { pool }
    }

    pub async fn get_active_sprint(&self, project_id: Uuid) -> Result<Option<Sprint>, AppError> {
        adapters::persistence::repo::get_active_sprint(&self.pool, project_id).await
    }
}
