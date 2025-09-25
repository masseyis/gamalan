#!/bin/bash

# Script to run migrations for test database
# This ensures test database has the same schema as production

set -e

# Get database URL from environment or use default
TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:password@localhost:5432/gamalan_test}"

echo "Running migrations for test database: $TEST_DATABASE_URL"

# Run migrations for each service
cd "$(dirname "$0")/.."

echo "Running auth-gateway migrations..."
DATABASE_URL="$TEST_DATABASE_URL" sqlx migrate run --source services/auth-gateway/migrations --ignore-missing

echo "Running projects migrations..."
DATABASE_URL="$TEST_DATABASE_URL" sqlx migrate run --source services/projects/migrations --ignore-missing

echo "Running backlog migrations..."
DATABASE_URL="$TEST_DATABASE_URL" sqlx migrate run --source services/backlog/migrations --ignore-missing

echo "Running readiness migrations..."
DATABASE_URL="$TEST_DATABASE_URL" sqlx migrate run --source services/readiness/migrations --ignore-missing

echo "Running prompt-builder migrations..."
DATABASE_URL="$TEST_DATABASE_URL" sqlx migrate run --source services/prompt-builder/migrations --ignore-missing

echo "All test migrations completed successfully!"