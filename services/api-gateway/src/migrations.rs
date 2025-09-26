use anyhow::Result;
use sqlx::PgPool;
use tracing::{info, warn};

/// Run all migrations for all services
pub async fn run_all_migrations(pool: &PgPool) -> Result<()> {
    info!("Starting database migrations for all services...");

    // Run migrations in dependency order
    run_auth_gateway_migrations(pool).await?;
    run_projects_migrations(pool).await?;
    run_backlog_migrations(pool).await?;
    run_readiness_migrations(pool).await?;
    run_prompt_builder_migrations(pool).await?;
    run_context_orchestrator_migrations(pool).await?;

    info!("All database migrations completed successfully");
    Ok(())
}

/// Run auth-gateway migrations
async fn run_auth_gateway_migrations(pool: &PgPool) -> Result<()> {
    info!("Running auth-gateway migrations...");

    // Embed migrations at compile time from the auth-gateway service
    let migrations = sqlx::migrate!("../auth-gateway/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Auth-gateway migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Auth-gateway migrations failed: {}", e);
            // Don't fail if migrations already applied or missing
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Auth-gateway migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}

/// Run projects migrations
async fn run_projects_migrations(pool: &PgPool) -> Result<()> {
    info!("Running projects migrations...");

    let migrations = sqlx::migrate!("../projects/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Projects migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Projects migrations failed: {}", e);
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Projects migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}

/// Run backlog migrations
async fn run_backlog_migrations(pool: &PgPool) -> Result<()> {
    info!("Running backlog migrations...");

    let migrations = sqlx::migrate!("../backlog/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Backlog migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Backlog migrations failed: {}", e);
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Backlog migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}

/// Run readiness migrations
async fn run_readiness_migrations(pool: &PgPool) -> Result<()> {
    info!("Running readiness migrations...");

    let migrations = sqlx::migrate!("../readiness/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Readiness migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Readiness migrations failed: {}", e);
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Readiness migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}

/// Run prompt-builder migrations
async fn run_prompt_builder_migrations(pool: &PgPool) -> Result<()> {
    info!("Running prompt-builder migrations...");

    let migrations = sqlx::migrate!("../prompt-builder/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Prompt-builder migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Prompt-builder migrations failed: {}", e);
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Prompt-builder migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}

/// Run context-orchestrator migrations
async fn run_context_orchestrator_migrations(pool: &PgPool) -> Result<()> {
    info!("Running context-orchestrator migrations...");

    let migrations = sqlx::migrate!("../context-orchestrator/migrations");

    match migrations.run(pool).await {
        Ok(_) => {
            info!("Context-orchestrator migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Context-orchestrator migrations failed: {}", e);
            if e.to_string().contains("already applied")
                || e.to_string().contains("missing in the resolved migrations")
            {
                info!("Context-orchestrator migrations already applied or have missing resolved migrations, continuing...");
                Ok(())
            } else {
                Err(e.into())
            }
        }
    }
}
