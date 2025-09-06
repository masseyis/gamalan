#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up Shuttle projects for consolidated API Gateway...${NC}"
echo -e "${YELLOW}Note: Using single API Gateway deployment model (all services consolidated)${NC}"

# Check if Shuttle CLI is installed
if ! command -v shuttle &> /dev/null; then
    echo -e "${RED}Shuttle CLI is not installed. Please install it first:${NC}"
    echo "  curl -sSfL https://www.shuttle.rs/install | bash"
    echo "  Or visit: https://docs.shuttle.rs/getting-started/installation"
    exit 1
fi

# Check if user is authenticated
if ! shuttle auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with Shuttle. Please run: shuttle auth login${NC}"
    exit 1
fi

# Define deployment environments for consolidated API Gateway
# Only api-gateway needs Shuttle projects (contains all services)
PROJECT_NAME="salunga-ai"
ENVIRONMENTS=(
    "staging"
    "production" 
    "canary"
)

# Function to create or update Shuttle project
create_shuttle_project() {
    local environment=$1
    local project_name="${PROJECT_NAME}-${environment}"
    
    echo -e "${YELLOW}Setting up Shuttle project: ${project_name}${NC}"
    echo -e "${BLUE}Environment: ${environment} (Consolidated API Gateway)${NC}"
    
    cd "services/api-gateway" || {
        echo -e "${RED}API Gateway directory not found: services/api-gateway${NC}"
        return 1
    }
    
    # Create Shuttle.toml for the specific environment if it doesn't exist
    local shuttle_config="Shuttle.${environment}.toml"
    
    if [ ! -f "$shuttle_config" ]; then
        echo -e "${BLUE}Creating ${shuttle_config}...${NC}"
        cat > "$shuttle_config" <<EOF
name = "${project_name}"
version = "0.1.0"

[environment]
# Consolidated API Gateway Environment Variables
DATABASE_URL = "\${{ secrets.DATABASE_URL_${environment^^} }}"
CLERK_WEBHOOK_SECRET = "\${{ secrets.CLERK_WEBHOOK_SECRET }}"
CLERK_PUBLISHABLE_KEY = "\${{ secrets.CLERK_PUBLISHABLE_KEY }}"
CLERK_SECRET_KEY = "\${{ secrets.CLERK_SECRET_KEY }}"
CLERK_JWKS_URL = "\${{ secrets.CLERK_JWKS_URL }}"
RUST_LOG = "$( [ "$environment" = "production" ] && echo "info" || echo "debug" )"
LOG_LEVEL = "$( [ "$environment" = "production" ] && echo "info" || echo "debug" )"
ENVIRONMENT = "${environment}"
API_BASE_URL = "$( [ "$environment" = "production" ] && echo "https://api.salunga.com" || echo "https://api-staging.salunga.com" )"
# All services run within single API Gateway process
FEATURE_FLAG_CONSOLIDATED_SERVICES = "true"
EOF
        echo -e "${GREEN}✓ Created ${shuttle_config}${NC}"
    fi
    
    # Try to create the project (will succeed if it doesn't exist, fail gracefully if it does)
    if shuttle project new --name "$project_name" 2>/dev/null; then
        echo -e "${GREEN}✓ Created new Shuttle project: ${project_name}${NC}"
    else
        echo -e "${YELLOW}⚠ Project ${project_name} already exists, skipping creation${NC}"
    fi
    
    # Set up environment-specific secrets for this project
    setup_project_secrets "$environment" "$project_name"
    
    cd - > /dev/null
}

# Function to set up secrets for a specific project
setup_project_secrets() {
    local environment=$1
    local project_name=$2
    
    echo -e "${BLUE}Setting up secrets for ${project_name} (Consolidated API Gateway)...${NC}"
    
    # Note: Actual secret values should be set via GitHub Actions or manually
    # These are placeholder commands that would be run with actual values
    cat <<EOF > "services/api-gateway/secrets-${environment}.env.example"
# Shuttle project secrets for ${project_name} (Consolidated API Gateway)
# Set these using: shuttle resource add --name secret_name --value "secret_value"
# Single database for all services within consolidated API Gateway

DATABASE_URL=postgresql://user:pass@host:5432/salunga_ai_${environment}
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_[YOUR_CLERK_SECRET_KEY]
CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
RUST_LOG=$( [ "$environment" = "production" ] && echo "info" || echo "debug" )
LOG_LEVEL=$( [ "$environment" = "production" ] && echo "info" || echo "debug" )
ENVIRONMENT=${environment}
API_BASE_URL=$( [ "$environment" = "production" ] && echo "https://api.salunga.com" || echo "https://api-staging.salunga.com" )
# Consolidated services feature flag
FEATURE_FLAG_CONSOLIDATED_SERVICES=true
EOF
    
    echo -e "${GREEN}✓ Created secrets template: services/api-gateway/secrets-${environment}.env.example${NC}"
}

# Function to verify project status
verify_project_status() {
    local environment=$1
    local project_name="${PROJECT_NAME}-${environment}"
    
    echo -e "${BLUE}Verifying project status: ${project_name}${NC}"
    
    if shuttle project status --name "$project_name" &> /dev/null; then
        echo -e "${GREEN}✓ Project ${project_name} is accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Project ${project_name} is not accessible${NC}"
        return 1
    fi
}

# Main execution
echo -e "${BLUE}Starting Shuttle project setup...${NC}"
echo -e "${YELLOW}Creating consolidated API Gateway projects for all environments${NC}"

# Create projects for all environments (staging, production, canary)
for environment in "${ENVIRONMENTS[@]}"; do
    echo -e "${YELLOW}Processing environment: ${environment}${NC}"
    
    # Create project for this environment
    create_shuttle_project "$environment"
    
    echo -e "${GREEN}✓ Completed setup for environment: ${environment}${NC}"
    echo ""
done

# List all created projects
echo -e "${BLUE}Listing all Shuttle projects...${NC}"
shuttle project list

# Verify project access
echo -e "${BLUE}Verifying project access...${NC}"
failed_projects=()

for environment in "${ENVIRONMENTS[@]}"; do
    if ! verify_project_status "$environment"; then
        failed_projects+=("${PROJECT_NAME}-${environment}")
    fi
done

if [ ${#failed_projects[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All Shuttle projects are set up and accessible!${NC}"
else
    echo -e "${RED}❌ Some projects failed verification:${NC}"
    printf '%s\n' "${failed_projects[@]}"
fi

echo -e "${BLUE}Shuttle project setup summary:${NC}"
echo -e "  • ${GREEN}✓${NC} Created ${#ENVIRONMENTS[@]} projects for consolidated API Gateway"
echo -e "  • ${GREEN}✓${NC} All environments: staging, production, and canary"
echo -e "  • ${GREEN}✓${NC} Single deployment architecture (all services in api-gateway)"
echo -e "  • ${GREEN}✓${NC} Environment-specific configuration files"
echo -e "  • ${GREEN}✓${NC} Secret templates for each environment"

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Set actual secret values using GitHub Actions or manually:"
echo -e "     ${BLUE}shuttle resource add --name DATABASE_URL --value \"your-db-url\"${NC}"
echo -e "  2. Deploy services using the deployment workflow:"
echo -e "     ${BLUE}shuttle deploy --name project-name${NC}"
echo -e "  3. Monitor deployments in the Shuttle dashboard"

echo -e "${BLUE}Configuration files created:${NC}"
for environment in "${ENVIRONMENTS[@]}"; do
    echo -e "  • services/api-gateway/Shuttle.${environment}.toml"
    echo -e "  • services/api-gateway/secrets-${environment}.env.example"
done
echo -e "${YELLOW}Note: All services (projects, backlog, readiness, prompt-builder, context-orchestrator) are consolidated into the single api-gateway deployment${NC}"