use crate::domain::Sprint;
use common::AppError;
use sqlx::PgPool;
use tracing::error;
use uuid::Uuid;

pub async fn get_active_sprint(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Sprint>, AppError> {
    let sprint = sqlx::query_as::<_, Sprint>(
        "SELECT * FROM sprints WHERE project_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        error!(error = %e, "SQL error fetching active sprint");
        AppError::InternalServerError
    })?;

    Ok(sprint)
}
