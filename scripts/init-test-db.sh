#!/bin/bash
set -e

echo "Initializing test databases..."

# Create separate test databases for each service
psql -v ON_ERROR_STOP=1 --username "$PGUSER" --dbname "$PGDATABASE" <<-EOSQL
    -- Create separate databases for each service
    CREATE DATABASE salunga_projects_test;
    CREATE DATABASE salunga_backlog_test;
    CREATE DATABASE salunga_auth_test;
    CREATE DATABASE salunga_readiness_test;
    CREATE DATABASE salunga_prompt_builder_test;
    CREATE DATABASE salunga_context_orchestrator_test;

    -- Create test user with appropriate permissions
    CREATE USER test_service_user WITH PASSWORD 'test_service_password';
    
    -- Grant permissions to all test databases
    GRANT ALL PRIVILEGES ON DATABASE salunga_projects_test TO test_service_user;
    GRANT ALL PRIVILEGES ON DATABASE salunga_backlog_test TO test_service_user;
    GRANT ALL PRIVILEGES ON DATABASE salunga_auth_test TO test_service_user;
    GRANT ALL PRIVILEGES ON DATABASE salunga_readiness_test TO test_service_user;
    GRANT ALL PRIVILEGES ON DATABASE salunga_prompt_builder_test TO test_service_user;
    GRANT ALL PRIVILEGES ON DATABASE salunga_context_orchestrator_test TO test_service_user;

    -- Enable extensions that services might need
    \c salunga_projects_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    \c salunga_backlog_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    \c salunga_auth_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    \c salunga_readiness_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    \c salunga_prompt_builder_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    \c salunga_context_orchestrator_test;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOSQL

echo "Test databases initialized successfully!"

# Set up test environment variables for services
cat > /tmp/test-env-vars.sh <<EOF
export DATABASE_URL_PROJECTS="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_projects_test"
export DATABASE_URL_BACKLOG="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_backlog_test"
export DATABASE_URL_AUTH_GATEWAY="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_auth_test"
export DATABASE_URL_READINESS="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_readiness_test"
export DATABASE_URL_PROMPT_BUILDER="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_prompt_builder_test"
export DATABASE_URL_CONTEXT_ORCHESTRATOR="postgresql://test_service_user:test_service_password@postgres-test:5432/salunga_context_orchestrator_test"
export REDIS_URL="redis://redis-test:6379"
export RUST_LOG="debug"
export LOG_LEVEL="debug"
export ENVIRONMENT="test"
EOF

echo "Test environment variables written to /tmp/test-env-vars.sh"