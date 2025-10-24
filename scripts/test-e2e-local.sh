#!/bin/bash

# Local E2E Test Script - Mimics CI Environment
# This script replicates the exact same steps as the GitHub Actions E2E test job

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[E2E-LOCAL]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[E2E-LOCAL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[E2E-LOCAL]${NC} $1"
}

print_error() {
    echo -e "${RED}[E2E-LOCAL]${NC} $1"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up background processes..."

    # Kill backend processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_status "Killed backend process $BACKEND_PID"
    fi

    # Kill frontend processes
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_status "Killed frontend process $FRONTEND_PID"
    fi

    # Kill any remaining processes on ports 3000 and 8000
    pkill -f "target/release/api-gateway" 2>/dev/null || true
    pkill -f "next start" 2>/dev/null || true

    # Kill any postgres processes if we started them
    if [ "$START_POSTGRES" = "true" ] && [ ! -z "$POSTGRES_PID" ]; then
        kill $POSTGRES_PID 2>/dev/null || true
        print_status "Killed postgres process $POSTGRES_PID"
    fi

    print_success "Cleanup completed"
}

# Set up trap to cleanup on exit
trap cleanup EXIT

print_status "Starting Local E2E Test Environment (mimicking CI)"
print_status "==============================================="

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Check if postgres is running locally
if ! pg_isready -h localhost -p 5432 2>/dev/null; then
    print_warning "PostgreSQL is not running on localhost:5432"
    print_status "Starting PostgreSQL with Docker..."

    # Start postgres with docker
    docker run --name e2e-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_USER=postgres -e POSTGRES_DB=gamalan_test -p 5432:5432 -d postgres:16-alpine

    # Wait for postgres to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if pg_isready -h localhost -p 5432 2>/dev/null; then
            print_success "PostgreSQL is ready!"
            START_POSTGRES=true
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start within 60 seconds"
            exit 1
        fi
        sleep 2
    done
else
    print_success "PostgreSQL is already running"
    START_POSTGRES=false
fi

# Set environment variables
export DATABASE_URL="postgres://postgres:password@localhost:5432/gamalan_test"
export RUST_LOG=info

# Load environment variables for E2E tests
if [ -f "apps/web/.env.e2e.local" ]; then
    print_status "Loading E2E environment variables from apps/web/.env.e2e.local"
    set -a  # automatically export all variables
    source apps/web/.env.e2e.local
    set +a
elif [ -f "apps/web/.env.test" ]; then
    print_status "Loading test environment variables from apps/web/.env.test"
    set -a  # automatically export all variables
    source apps/web/.env.test
    set +a
else
    print_warning "No .env.e2e.local or .env.test file found, using default test values"
    export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ=="
    export CLERK_SECRET_KEY="sk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ=="
fi

export NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
export PLAYWRIGHT_BASE_URL="http://localhost:3000"
export CI=true
export NODE_ENV=test

print_status "Environment variables set:"
print_status "  DATABASE_URL: $DATABASE_URL"
print_status "  NEXT_PUBLIC_API_BASE_URL: $NEXT_PUBLIC_API_BASE_URL"
print_status "  PLAYWRIGHT_BASE_URL: $PLAYWRIGHT_BASE_URL"

# Step 1: Build Rust backend test binary
print_status "Building Rust backend test binary..."
cargo build --release --bin api-gateway-test

print_success "Backend build completed"

# Step 2: Run database migrations
print_status "Running database migrations..."
if ! command -v sqlx &> /dev/null; then
    print_status "Installing sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features "postgres,rustls"
fi

find services -name "migrations" -type d | while read -r migration_dir; do
    service=$(basename $(dirname $migration_dir))
    print_status "Running migrations for $service"
    sqlx migrate run --source "$migration_dir" --ignore-missing
done

print_success "Database migrations completed"

# Step 3: Start Rust backend test binary
print_status "Starting Rust backend test server on port 8000..."
./target/release/api-gateway-test &
BACKEND_PID=$!
print_status "Backend PID: $BACKEND_PID"

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:8000/health 2>/dev/null; then
        print_success "✅ Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "❌ Backend failed to start within 60 seconds"
        print_error "Backend logs:"
        jobs -p | xargs -I {} ps -p {} -o pid,ppid,cmd 2>/dev/null || true
        netstat -tulpn | grep :8000 2>/dev/null || true
        exit 1
    fi
    print_status "Attempt $i/30: Backend not ready, waiting 2 seconds..."
    sleep 2
done

# Step 4: Install frontend dependencies and build
print_status "Installing frontend dependencies..."
cd apps/web
pnpm install --frozen-lockfile

print_status "Installing Playwright browsers..."
pnpm playwright:install

print_status "Building Next.js application..."
pnpm build

# Step 5: Start Next.js frontend
print_status "Starting Next.js on port 3000..."
NODE_ENV=production pnpm start &
FRONTEND_PID=$!
print_status "Frontend PID: $FRONTEND_PID"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:3000 2>/dev/null; then
        print_success "✅ Frontend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "❌ Frontend failed to start within 60 seconds"
        exit 1
    fi
    print_status "Attempt $i/30: Frontend not ready, waiting 2 seconds..."
    sleep 2
done

# Step 6: Run E2E tests
print_status "Running E2E tests..."
print_status "Environment for tests:"
print_status "  PLAYWRIGHT_BASE_URL: $PLAYWRIGHT_BASE_URL"
print_status "  NEXT_PUBLIC_API_BASE_URL: $NEXT_PUBLIC_API_BASE_URL"

# Set test-specific environment variables
export PLAYWRIGHT_HEADLESS=true
export NODE_ENV=test

# Run the E2E tests
if pnpm test:e2e:ci; then
    print_success "🎉 All E2E tests passed!"
else
    print_error "❌ E2E tests failed!"
    exit 1
fi

print_success "Local E2E test environment completed successfully!"
print_status "This setup mimics exactly what runs in GitHub Actions CI"