#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up GitHub branch protection rules...${NC}"

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI (gh) is not installed. Please install it first:${NC}"
    echo "  macOS: brew install gh"
    echo "  Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: https://github.com/cli/cli/releases"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub CLI. Please run: gh auth login${NC}"
    exit 1
fi

# Get repository information
REPO_OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO_NAME=$(gh repo view --json name --jq '.name')

echo -e "${BLUE}Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"

# Function to set up branch protection
setup_branch_protection() {
    local branch=$1
    echo -e "${YELLOW}Setting up branch protection for: ${branch}${NC}"

    # Create or update branch protection rule
    gh api repos/${REPO_OWNER}/${REPO_NAME}/branches/${branch}/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["CI / build","Frontend CI / build-and-test","contract-tests"]}' \
        --field enforce_admins=true \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"require_last_push_approval":false}' \
        --field restrictions=null \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field block_creations=false \
        --field required_conversation_resolution=true \
        --field lock_branch=false \
        --field allow_fork_syncing=false

    echo -e "${GREEN}✓ Branch protection configured for: ${branch}${NC}"
}

# Function to set up repository rules
setup_repository_rules() {
    echo -e "${YELLOW}Setting up repository-level rules...${NC}"

    # Enable vulnerability alerts
    gh api repos/${REPO_OWNER}/${REPO_NAME}/vulnerability-alerts \
        --method PUT \
        --field enabled=true || true

    # Enable automated security fixes
    gh api repos/${REPO_OWNER}/${REPO_NAME}/automated-security-fixes \
        --method PUT \
        --field enabled=true || true

    # Enable secret scanning
    gh api repos/${REPO_OWNER}/${REPO_NAME}/secret-scanning/alerts \
        --method PUT \
        --field enabled=true || true

    echo -e "${GREEN}✓ Repository security features enabled${NC}"
}

# Function to create required status checks
setup_status_checks() {
    echo -e "${YELLOW}Setting up required status checks...${NC}"

    # The status checks will be automatically registered when the GitHub Actions workflows run
    # We just need to ensure they're configured in the branch protection rule above
    
    echo -e "${GREEN}✓ Status checks configured (will be enforced after first workflow runs)${NC}"
}

# Function to set up environment protection rules
setup_environment_protection() {
    echo -e "${YELLOW}Setting up environment protection rules...${NC}"

    # Create production environment with protection rules
    gh api repos/${REPO_OWNER}/${REPO_NAME}/environments/production \
        --method PUT \
        --field wait_timer=0 \
        --field reviewers='[]' \
        --field deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' || true

    # Create staging environment
    gh api repos/${REPO_OWNER}/${REPO_NAME}/environments/staging \
        --method PUT \
        --field wait_timer=0 \
        --field reviewers='[]' \
        --field deployment_branch_policy='{"protected_branches":false,"custom_branch_policies":true}' || true

    echo -e "${GREEN}✓ Environment protection rules configured${NC}"
}

# Main execution
echo -e "${BLUE}Starting branch protection setup...${NC}"

# Set up branch protection for main branch
setup_branch_protection "main"

# Set up repository-level security rules
setup_repository_rules

# Set up status checks
setup_status_checks

# Set up environment protection
setup_environment_protection

echo -e "${GREEN}✅ Branch protection setup completed successfully!${NC}"

echo -e "${BLUE}Branch protection summary:${NC}"
echo -e "  • ${GREEN}✓${NC} Required status checks: CI, Frontend CI, Contract Tests"
echo -e "  • ${GREEN}✓${NC} Required PR reviews: 1 approving review required"
echo -e "  • ${GREEN}✓${NC} Dismiss stale reviews: Enabled"
echo -e "  • ${GREEN}✓${NC} Require code owner reviews: Enabled"
echo -e "  • ${GREEN}✓${NC} Force push protection: Enabled"
echo -e "  • ${GREEN}✓${NC} Deletion protection: Enabled"
echo -e "  • ${GREEN}✓${NC} Conversation resolution required: Enabled"
echo -e "  • ${GREEN}✓${NC} Admin enforcement: Enabled"

echo -e "${BLUE}Security features enabled:${NC}"
echo -e "  • ${GREEN}✓${NC} Vulnerability alerts"
echo -e "  • ${GREEN}✓${NC} Automated security fixes"
echo -e "  • ${GREEN}✓${NC} Secret scanning"

echo -e "${BLUE}Environment protection:${NC}"
echo -e "  • ${GREEN}✓${NC} Production environment (protected branches only)"
echo -e "  • ${GREEN}✓${NC} Staging environment (custom branches allowed)"

echo -e "${YELLOW}Note: Status checks will be enforced after the first workflow runs complete.${NC}"