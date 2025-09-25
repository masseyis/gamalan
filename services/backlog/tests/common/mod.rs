use sqlx::PgPool;
use std::sync::atomic::{AtomicBool, Ordering};

/// Setup test database with targeted data cleanup
/// This function connects to the TEST_DATABASE_URL and ensures clean test state without being too aggressive
pub async fn setup_test_db() -> PgPool {
    // Use TEST_DATABASE_URL environment variable for integration tests
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:password@localhost:5432/gamalan_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Ensure database extensions are enabled (only once per test run)
    static EXTENSIONS_ENABLED: AtomicBool = AtomicBool::new(false);
    if !EXTENSIONS_ENABLED.load(Ordering::Relaxed) {
        enable_database_extensions(&pool).await.ok();
        EXTENSIONS_ENABLED.store(true, Ordering::Relaxed);
    }

    // Use full cleanup to ensure test isolation - each test must set up its own data
    clean_test_data(&pool)
        .await
        .expect("Failed to clean test data");

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

async fn clean_test_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Clean all test data in dependency order
    // This approach ensures complete test isolation

    // First disable triggers to avoid constraint issues during cleanup
    sqlx::query("SET session_replication_role = replica;")
        .execute(pool)
        .await?;

    // Clean backlog tables in dependency order
    sqlx::query("TRUNCATE TABLE story_labels CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE acceptance_criteria CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE tasks CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE stories CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE labels CASCADE")
        .execute(pool)
        .await
        .ok();

    // Clean projects tables if they exist
    sqlx::query("TRUNCATE TABLE project_settings CASCADE")
        .execute(pool)
        .await
        .ok();

    sqlx::query("TRUNCATE TABLE projects CASCADE")
        .execute(pool)
        .await
        .ok();

    // Re-enable triggers
    sqlx::query("SET session_replication_role = DEFAULT;")
        .execute(pool)
        .await?;

    Ok(())
}

/// Create a test database pool with proper cleanup
pub struct TestDatabase {
    pool: PgPool,
}

impl TestDatabase {
    pub async fn new() -> Self {
        let pool = setup_test_db().await;
        Self { pool }
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        // Cleanup is handled by clean_test_data in setup_test_db
        // No special cleanup needed for shared database approach
    }
}
