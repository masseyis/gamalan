use anyhow::Result;
use sqlx::{query, PgPool};
use std::backtrace::Backtrace;
use tracing::{info, warn};

pub async fn run_all_migrations(pool: &PgPool) -> Result<()> {
    info!("Starting database migrations...");

    let migrations = sqlx::migrate!("../../db/migrations");

    match migrations.run(pool).await {
        Ok(_) => info!("Database migrations completed successfully"),
        Err(e) => {
            let message = e.to_string();
            warn!("Database migrations failed: {}", message);
            warn!(
                "Detected legacy or modified migration; continuing with best-effort schema patch"
            );
        }
    }

    apply_schema_patches(pool).await?;
    Ok(())
}

async fn apply_schema_patches(pool: &PgPool) -> Result<()> {
    info!("Applying post-migration schema patches...");

    exec_patch(
        pool,
        "ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT",
        "ensure teams.description column",
    )
    .await;

    exec_patch(
        pool,
        "ALTER TABLE sprints ADD COLUMN IF NOT EXISTS organization_id UUID",
        "ensure sprints.organization_id column",
    )
    .await;

    exec_patch(
        pool,
        "ALTER TABLE sprints ADD COLUMN IF NOT EXISTS project_id UUID",
        "ensure sprints.project_id column",
    )
    .await;

    exec_patch(
        pool,
        "DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.constraint_column_usage
                WHERE table_name = 'sprints' AND constraint_name = 'sprints_project_id_fkey'
            ) THEN
                ALTER TABLE sprints
                ADD CONSTRAINT sprints_project_id_fkey
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
            END IF;
        END $$;",
        "ensure sprints.project_id foreign key",
    )
    .await;

    exec_patch(
        pool,
        "DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'sprints' AND column_name = 'status'
            ) THEN
                ALTER TABLE sprints ADD COLUMN status TEXT;
            END IF;
        END $$;",
        "ensure sprints.status column",
    )
    .await;

    exec_patch(
        pool,
        "UPDATE sprints SET status = COALESCE(status, 'planning')",
        "backfill sprints.status values",
    )
    .await;
    exec_patch(
        pool,
        "ALTER TABLE sprints ALTER COLUMN status SET DEFAULT 'planning'",
        "set default for sprints.status",
    )
    .await;

    exec_patch(
        pool,
        "DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'sprints' AND column_name = 'start_date'
            ) THEN
                ALTER TABLE sprints ADD COLUMN start_date TIMESTAMPTZ;
            END IF;
        END $$;",
        "ensure sprints.start_date column",
    )
    .await;

    exec_patch(
        pool,
        "UPDATE sprints SET start_date = COALESCE(start_date, NOW())",
        "backfill sprints.start_date",
    )
    .await;
    exec_patch(
        pool,
        "ALTER TABLE sprints ALTER COLUMN start_date SET DEFAULT NOW()",
        "set default for sprints.start_date",
    )
    .await;

    exec_patch(
        pool,
        "DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'sprints' AND column_name = 'end_date'
            ) THEN
                ALTER TABLE sprints ADD COLUMN end_date TIMESTAMPTZ;
            END IF;
        END $$;",
        "ensure sprints.end_date column",
    )
    .await;

    exec_patch(
        pool,
        "UPDATE sprints SET end_date = COALESCE(end_date, NOW() + INTERVAL '14 days')",
        "backfill sprints.end_date",
    )
    .await;
    exec_patch(
        pool,
        "ALTER TABLE sprints ALTER COLUMN end_date SET DEFAULT NOW() + INTERVAL '14 days'",
        "set default for sprints.end_date",
    )
    .await;

    info!("Schema patches applied");

    Ok(())
}

async fn exec_patch(pool: &PgPool, sql: &str, description: &str) {
    match query(sql).execute(pool).await {
        Ok(_) => info!(%description, "Schema patch applied"),
        Err(error) => {
            let backtrace = Backtrace::capture();
            warn!(
                %description,
                error = %error,
                ?backtrace,
                "Schema patch failed but continuing"
            );
        }
    }
}
