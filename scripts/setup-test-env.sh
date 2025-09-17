#!/bin/bash
set -e

echo "🚀 Setting up test environment for Battra AI..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to prompt for input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local result

    read -p "$prompt [$default]: " result
    echo "${result:-$default}"
}

echo ""
echo "📋 Checking prerequisites..."

# Check for PostgreSQL
if command_exists psql; then
    echo "✅ PostgreSQL found"
else
    echo "❌ PostgreSQL not found"
    echo "   Install with: brew install postgresql@15"
    echo "   Then run: brew services start postgresql@15"
    exit 1
fi

# Check for pnpm
if command_exists pnpm; then
    echo "✅ pnpm found"
else
    echo "❌ pnpm not found"
    echo "   Install with: npm install -g pnpm"
    exit 1
fi

# Set up PostgreSQL PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

echo ""
echo "🗄️  Setting up test database..."

# Create test database if it doesn't exist
if psql -lqt | cut -d \| -f 1 | grep -qw gamalan_test; then
    echo "✅ Test database 'gamalan_test' already exists"
else
    echo "📝 Creating test database 'gamalan_test'..."
    createdb gamalan_test
    echo "✅ Test database created"
fi

# Create postgres user if it doesn't exist
if psql -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1; then
    echo "✅ PostgreSQL 'postgres' user already exists"
else
    echo "📝 Creating PostgreSQL 'postgres' user..."
    psql -d postgres -c "CREATE USER postgres WITH SUPERUSER;"
    echo "✅ PostgreSQL 'postgres' user created"
fi

echo ""
echo "🔧 Configuring E2E test environment..."

# Navigate to web app directory
cd "$(dirname "$0")/../apps/web"

# Check if .env.test.local exists
if [ -f ".env.test.local" ]; then
    echo "⚠️  .env.test.local already exists"
    if [ "$1" != "--force" ]; then
        read -p "Do you want to overwrite it? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "📋 Skipping .env.test.local configuration"
            echo "   Please manually update your .env.test.local file with Clerk credentials"
            echo ""
            echo "📚 Next steps:"
            echo "   1. Update .env.test.local with your Clerk development instance keys"
            echo "   2. Create a test user in your Clerk dashboard"
            echo "   3. Enable username/password authentication in Clerk"
            echo "   4. Run: make test-all-local"
            exit 0
        fi
    fi
fi

echo ""
echo "🔑 Clerk Configuration"
echo "   Please provide your Clerk development instance credentials"
echo "   You can find these at: https://dashboard.clerk.com -> API Keys"
echo ""

CLERK_PK=$(prompt_with_default "Clerk Publishable Key" "pk_test_REPLACE_WITH_YOUR_ACTUAL_DEV_KEY")
CLERK_SK=$(prompt_with_default "Clerk Secret Key" "sk_test_REPLACE_WITH_YOUR_ACTUAL_DEV_SECRET")

echo ""
echo "👤 Test User Configuration"
echo "   Create a test user in your Clerk dashboard with username/password authentication"
echo ""

TEST_USERNAME=$(prompt_with_default "Test user username" "testuser")
TEST_PASSWORD=$(prompt_with_default "Test user password" "TestPassword123!")

# Create .env.test.local
cat > .env.test.local << EOF
# Clerk Authentication for E2E Tests
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PK
CLERK_SECRET_KEY=$CLERK_SK

# Test User Credentials
E2E_CLERK_USER_USERNAME=$TEST_USERNAME
E2E_CLERK_USER_PASSWORD=$TEST_PASSWORD

# API URLs for testing
NEXT_PUBLIC_PROJECTS_API_URL=http://localhost:8001
NEXT_PUBLIC_BACKLOG_API_URL=http://localhost:8002
NEXT_PUBLIC_READINESS_API_URL=http://localhost:8003
NEXT_PUBLIC_PROMPT_BUILDER_API_URL=http://localhost:8004

# Feature flags for testing
NEXT_PUBLIC_ENABLE_AI_FEATURES=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=true

# Test environment marker
NODE_ENV=test
EOF

echo "✅ .env.test.local created"

echo ""
echo "🎉 Test environment setup complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Ensure your Clerk development instance has username/password auth enabled"
echo "   2. Create the test user ($TEST_USERNAME) in your Clerk dashboard"
echo "   3. Run backend integration tests: make test-int-local"
echo "   4. Run frontend E2E tests: cd apps/web && pnpm test:e2e"
echo "   5. Run all tests: make test-all-local"
echo ""
echo "🔧 Available test commands:"
echo "   make test-unit            # Unit tests only"
echo "   make test-int-local       # Integration tests with local DB"
echo "   make test-contract-local  # Contract tests with local DB"
echo "   make test-all-local       # All backend tests with local DB"
echo "   cd apps/web && pnpm test:e2e  # Frontend E2E tests"
echo ""
echo "Happy testing! 🚀"