use sqlx::PgPool;
use std::sync::atomic::{AtomicU32, Ordering};
use uuid::Uuid;

static SCHEMA_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Legacy function for backward compatibility - creates isolated test database
/// Note: Manual cleanup required. Each test gets its own schema for isolation.
pub async fn setup_test_db() -> PgPool {
    // Use TEST_DATABASE_URL environment variable for integration tests
    let base_database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    // Create a unique schema name for each test to avoid conflicts
    let schema_id = SCHEMA_COUNTER.fetch_add(1, Ordering::SeqCst);
    let test_id = Uuid::new_v4().to_string().replace('-', "")[..8].to_string();
    let schema_name = format!("test_{}_{}", schema_id, test_id);

    let pool = PgPool::connect(&base_database_url)
        .await
        .expect("Failed to connect to test database");

    // Enable database extensions for each connection (idempotent operation)
    enable_database_extensions(&pool).await.ok();

    // Create a unique schema for this test
    create_test_schema_isolated(&pool, &schema_name)
        .await
        .expect("Failed to create isolated test schema");

    // Set the search_path to use our isolated schema
    sqlx::query(&format!("SET search_path TO {}, public", schema_name))
        .execute(&pool)
        .await
        .expect("Failed to set search path");

    pool
}

async fn enable_database_extensions(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Enable UUID extension if not already enabled
    sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        .execute(pool)
        .await
        .ok(); // Ignore errors, extension might already exist

    Ok(())
}

async fn create_test_schema_isolated(pool: &PgPool, schema_name: &str) -> Result<(), sqlx::Error> {
    // Create the isolated schema
    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema_name))
        .execute(pool)
        .await?;

    // Set search path to our schema for running migrations
    sqlx::query(&format!("SET search_path TO {}, public", schema_name))
        .execute(pool)
        .await?;

    // Use proper migrations instead of manual schema creation
    // First run projects service migration - create projects table
    sqlx::query(&format!(
        r#"
        CREATE TABLE {}.projects (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            team_id UUID,
            organization_id UUID,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    "#,
        schema_name
    ))
    .execute(pool)
    .await?;

    // Create project_settings table
    sqlx::query(&format!(
        r#"
        CREATE TABLE {}.project_settings (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL REFERENCES {}.projects(id),
            estimation_scale TEXT NOT NULL,
            dor_template JSONB NOT NULL
        );
    "#,
        schema_name, schema_name
    ))
    .execute(pool)
    .await?;

    // Create backlog tables exactly as in the migration
    sqlx::query(&format!(r#"
        CREATE TABLE {}.stories (
            id UUID PRIMARY KEY,
            project_id UUID NOT NULL,
            organization_id UUID,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            story_points INTEGER CHECK (story_points IS NULL OR (story_points > 0 AND story_points <= 8)),
            sprint_id UUID,
            assigned_to_user_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ,
            labels TEXT[] DEFAULT '{{}}'::TEXT[]
        );
    "#, schema_name))
    .execute(pool)
    .await?;

    // Create acceptance_criteria table
    sqlx::query(&format!(
        r#"
        CREATE TABLE {}.acceptance_criteria (
            id UUID PRIMARY KEY,
            story_id UUID NOT NULL REFERENCES {}.stories(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            given TEXT NOT NULL,
            when_clause TEXT NOT NULL,
            then_clause TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    "#,
        schema_name, schema_name
    ))
    .execute(pool)
    .await?;

    // Create tasks table
    sqlx::query(&format!(r#"
        CREATE TABLE {}.tasks (
            id UUID PRIMARY KEY,
            story_id UUID NOT NULL REFERENCES {}.stories(id),
            organization_id UUID,
            title TEXT NOT NULL,
            description TEXT,
            acceptance_criteria_refs TEXT[] DEFAULT '{{}}'::TEXT[],
            status TEXT NOT NULL DEFAULT 'available',
            owner_user_id UUID,
            estimated_hours INTEGER CHECK (estimated_hours IS NULL OR (estimated_hours > 0 AND estimated_hours <= 40)),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            owned_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ
        );
    "#, schema_name, schema_name))
    .execute(pool)
    .await?;

    // Create labels and story_labels tables if needed (from migration)
    sqlx::query(&format!(
        r#"
        CREATE TABLE {}.labels (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        );
    "#,
        schema_name
    ))
    .execute(pool)
    .await?;

    sqlx::query(&format!(
        r#"
        CREATE TABLE {}.story_labels (
            story_id UUID NOT NULL REFERENCES {}.stories(id),
            label_id UUID NOT NULL REFERENCES {}.labels(id),
            PRIMARY KEY (story_id, label_id)
        );
    "#,
        schema_name, schema_name, schema_name
    ))
    .execute(pool)
    .await?;

    // Add constraints
    sqlx::query(&format!(r#"
        ALTER TABLE {}.stories ADD CONSTRAINT stories_status_check
            CHECK (status IN ('draft', 'needsrefinement', 'ready', 'committed', 'inprogress', 'taskscomplete', 'deployed', 'awaitingacceptance', 'accepted'))
    "#, schema_name))
    .execute(pool)
    .await?;

    // Create indexes
    sqlx::query(&format!(
        "CREATE INDEX idx_projects_organization_id ON {}.projects(organization_id)",
        schema_name
    ))
    .execute(pool)
    .await?;

    sqlx::query(&format!(
        "CREATE INDEX idx_stories_organization_id ON {}.stories(organization_id)",
        schema_name
    ))
    .execute(pool)
    .await?;

    sqlx::query(&format!(
        "CREATE INDEX idx_stories_status ON {}.stories(status)",
        schema_name
    ))
    .execute(pool)
    .await?;

    sqlx::query(&format!(
        "CREATE INDEX idx_tasks_organization_id ON {}.tasks(organization_id)",
        schema_name
    ))
    .execute(pool)
    .await?;

    sqlx::query(&format!("CREATE INDEX idx_tasks_story_owner ON {}.tasks(story_id, owner_user_id) WHERE owner_user_id IS NOT NULL", schema_name))
        .execute(pool)
        .await?;

    // Set search path to use our schema for subsequent queries
    sqlx::query(&format!("SET search_path TO {}, public", schema_name))
        .execute(pool)
        .await?;

    Ok(())
}

/// Create a test database pool with proper isolation and cleanup
pub struct TestDatabase {
    pool: PgPool,
    schema_name: String,
}

impl TestDatabase {
    pub async fn new() -> Self {
        // Use TEST_DATABASE_URL environment variable for integration tests
        let base_database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:password@localhost:5432/gamalan_test".to_string()
        });

        // Create a unique schema name for each test to avoid conflicts
        let schema_id = SCHEMA_COUNTER.fetch_add(1, Ordering::SeqCst);
        let test_id = Uuid::new_v4().to_string().replace('-', "")[..8].to_string();
        let schema_name = format!("test_{}_{}", schema_id, test_id);

        let pool = PgPool::connect(&base_database_url)
            .await
            .expect("Failed to connect to test database");

        // Enable database extensions for each connection (idempotent operation)
        enable_database_extensions(&pool).await.ok();

        // Create a unique schema for this test
        create_test_schema_isolated(&pool, &schema_name)
            .await
            .expect("Failed to create isolated test schema");

        // Set the search_path to use our isolated schema
        sqlx::query(&format!("SET search_path TO {}, public", schema_name))
            .execute(&pool)
            .await
            .expect("Failed to set search path");

        Self { pool, schema_name }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        // Clean up the schema when the test database is dropped
        let pool = self.pool.clone();
        let schema_name = self.schema_name.clone();

        // Use a blocking task to ensure cleanup happens
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async move {
                if let Err(e) =
                    sqlx::query(&format!("DROP SCHEMA IF EXISTS {} CASCADE", schema_name))
                        .execute(&pool)
                        .await
                {
                    eprintln!(
                        "Warning: Failed to cleanup test schema {}: {}",
                        schema_name, e
                    );
                }
            });
        });
    }
}
