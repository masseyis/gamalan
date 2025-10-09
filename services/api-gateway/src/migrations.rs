use anyhow::Result;
use sqlx::PgPool;
use tracing::{info, warn};

pub async fn run_all_migrations(pool: &PgPool) -> Result<()> {
    info!("Starting database migrations...");

    let migrations = sqlx::migrate!("../../db/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Database migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Database migrations failed: {}", e);
            if e.to_string().contains("already applied") {
                info!("Database migrations already applied, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}
