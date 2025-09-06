#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Validating CI/CD Pipeline Setup...${NC}"

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Function to run a check and track results
run_check() {
    local check_name=$1
    local check_command=$2
    local required=${3:-true}  # true by default
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${YELLOW}Checking: ${check_name}${NC}"
    
    if eval "$check_command" &>/dev/null; then
        echo -e "${GREEN}✓ PASSED: ${check_name}${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗ FAILED: ${check_name}${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
        else
            echo -e "${YELLOW}⚠ WARNING: ${check_name}${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

# Function to validate GitHub CLI setup
validate_github_cli() {
    echo -e "${BLUE}=== GitHub CLI Validation ===${NC}"
    
    run_check "GitHub CLI installed" "command -v gh"
    run_check "GitHub CLI authenticated" "gh auth status"
    
    if gh auth status &>/dev/null; then
        local repo_info=$(gh repo view --json owner,name 2>/dev/null)
        if [ $? -eq 0 ]; then
            local owner=$(echo "$repo_info" | jq -r '.owner.login')
            local name=$(echo "$repo_info" | jq -r '.name')
            echo -e "${BLUE}  Repository: ${owner}/${name}${NC}"
            run_check "Repository accessible" "true"
        else
            run_check "Repository accessible" "false"
        fi
    fi
}

# Function to validate GitHub Actions workflows
validate_github_workflows() {
    echo -e "${BLUE}=== GitHub Actions Workflows Validation ===${NC}"
    
    local required_workflows=(
        ".github/workflows/ci.yml"
        ".github/workflows/deploy.yml"
        ".github/workflows/pr.yml"
        ".github/workflows/vercel-deploy.yml"
        ".github/workflows/shuttle-deploy.yml"
    )
    
    for workflow in "${required_workflows[@]}"; do
        run_check "Workflow exists: $(basename "$workflow")" "[ -f \"$workflow\" ]"
    done
    
    # Check for proper workflow syntax
    if command -v actionlint &>/dev/null; then
        run_check "Workflow syntax validation" "actionlint .github/workflows/*.yml" false
    else
        echo -e "${YELLOW}⚠ actionlint not installed - skipping workflow syntax validation${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# Function to validate repository secrets
validate_github_secrets() {
    echo -e "${BLUE}=== GitHub Repository Secrets Validation ===${NC}"
    
    if gh auth status &>/dev/null; then
        local required_secrets=(
            "SHUTTLE_API_KEY"
            "CLERK_WEBHOOK_SECRET"
            "CLERK_PUBLISHABLE_KEY"
            "CLERK_SECRET_KEY"
            "DATABASE_URL_PROJECTS"
            "DATABASE_URL_BACKLOG"
            "DATABASE_URL_AUTH_GATEWAY"
            "DATABASE_URL_READINESS"
            "DATABASE_URL_PROMPT_BUILDER"
            "VERCEL_TOKEN"
            "VERCEL_PROJECT_ID"
        )
        
        local existing_secrets=$(gh secret list --json name | jq -r '.[].name' 2>/dev/null)
        
        for secret in "${required_secrets[@]}"; do
            if echo "$existing_secrets" | grep -q "^${secret}$"; then
                run_check "Secret exists: ${secret}" "true"
            else
                run_check "Secret exists: ${secret}" "false"
            fi
        done
    else
        echo -e "${YELLOW}⚠ Cannot validate secrets - GitHub CLI not authenticated${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# Function to validate branch protection
validate_branch_protection() {
    echo -e "${BLUE}=== Branch Protection Validation ===${NC}"
    
    if gh auth status &>/dev/null; then
        local repo_info=$(gh repo view --json owner,name 2>/dev/null)
        local owner=$(echo "$repo_info" | jq -r '.owner.login' 2>/dev/null)
        local name=$(echo "$repo_info" | jq -r '.name' 2>/dev/null)
        
        if [ "$owner" != "null" ] && [ "$name" != "null" ]; then
            run_check "Main branch protection enabled" "gh api repos/${owner}/${name}/branches/main/protection --silent"
            
            # Check specific protection rules
            local protection_info=$(gh api repos/${owner}/${name}/branches/main/protection 2>/dev/null || echo "{}")
            
            if [ "$protection_info" != "{}" ]; then
                local required_reviews=$(echo "$protection_info" | jq -r '.required_pull_request_reviews.required_approving_review_count // 0')
                local status_checks=$(echo "$protection_info" | jq -r '.required_status_checks.strict // false')
                
                run_check "Required PR reviews configured (≥1)" "[ $required_reviews -ge 1 ]"
                run_check "Strict status checks enabled" "[ \"$status_checks\" = \"true\" ]"
            fi
        else
            run_check "Branch protection validation" "false"
        fi
    else
        echo -e "${YELLOW}⚠ Cannot validate branch protection - GitHub CLI not authenticated${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# Function to validate Docker setup
validate_docker_setup() {
    echo -e "${BLUE}=== Docker Setup Validation ===${NC}"
    
    run_check "Docker installed" "command -v docker"
    run_check "Docker Compose installed" "command -v docker-compose || docker compose version"
    run_check "Docker daemon running" "docker info"
    
    # Validate test compose file
    run_check "Test Docker Compose file exists" "[ -f docker-compose.test.yml ]"
    
    if [ -f "docker-compose.test.yml" ]; then
        run_check "Test Docker Compose syntax" "docker-compose -f docker-compose.test.yml config"
    fi
    
    # Validate development compose file
    run_check "Development Docker Compose file exists" "[ -f docker-compose.yml ]"
    
    if [ -f "docker-compose.yml" ]; then
        run_check "Development Docker Compose syntax" "docker-compose config"
    fi
}

# Function to validate Rust toolchain
validate_rust_toolchain() {
    echo -e "${BLUE}=== Rust Toolchain Validation ===${NC}"
    
    run_check "Rust compiler installed" "command -v rustc"
    run_check "Cargo installed" "command -v cargo"
    run_check "Rust version 1.79+" "rustc --version | grep -E '1\.(7[9-9]|[8-9][0-9]|[0-9]{3})'"
    
    # Check required components
    run_check "rustfmt component installed" "rustup component list --installed | grep rustfmt"
    run_check "clippy component installed" "rustup component list --installed | grep clippy"
    
    # Validate workspace compilation
    run_check "Workspace compiles" "cargo check --workspace --all-targets --all-features"
    
    # Check for required tools
    run_check "sqlx-cli installed" "command -v sqlx" false
    run_check "cargo-tarpaulin installed" "command -v cargo-tarpaulin" false
}

# Function to validate Shuttle CLI
validate_shuttle_cli() {
    echo -e "${BLUE}=== Shuttle CLI Validation ===${NC}"
    
    run_check "Shuttle CLI installed" "command -v shuttle"
    
    if command -v shuttle &>/dev/null; then
        run_check "Shuttle authentication" "shuttle auth status" false
        
        if shuttle auth status &>/dev/null; then
            run_check "Shuttle project list accessible" "shuttle project list" false
        fi
    fi
}

# Function to validate Vercel CLI
validate_vercel_cli() {
    echo -e "${BLUE}=== Vercel CLI Validation ===${NC}"
    
    run_check "Vercel CLI installed" "command -v vercel"
    
    if command -v vercel &>/dev/null; then
        run_check "Vercel authentication" "vercel whoami" false
        
        # Check if project is linked
        if [ -f "apps/web/.vercel/project.json" ]; then
            run_check "Vercel project linked" "true"
        else
            run_check "Vercel project linked" "false" false
        fi
    fi
}

# Function to validate database setup
validate_database_setup() {
    echo -e "${BLUE}=== Database Setup Validation ===${NC}"
    
    run_check "PostgreSQL client installed" "command -v psql" false
    
    # Check if local development database is accessible
    if command -v docker &>/dev/null && docker ps --format 'table {{.Names}}' | grep -q postgres; then
        run_check "Development database container running" "true"
        run_check "Development database accessible" "docker exec -it \$(docker ps -q --filter name=postgres) psql -U postgres -d gamalan -c 'SELECT version();'" false
    else
        echo -e "${YELLOW}⚠ Development database container not running${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

# Function to validate service configurations
validate_service_configs() {
    echo -e "${BLUE}=== Service Configuration Validation ===${NC}"
    
    local services=(
        "api-gateway"
        "auth-gateway"
        "projects"
        "backlog"
        "readiness"
        "prompt-builder"
        "context-orchestrator"
    )
    
    for service in "${services[@]}"; do
        local service_path="services/${service}"
        
        run_check "Service directory exists: ${service}" "[ -d \"${service_path}\" ]"
        run_check "Service Cargo.toml exists: ${service}" "[ -f \"${service_path}/Cargo.toml\" ]"
        run_check "Service Shuttle.toml exists: ${service}" "[ -f \"${service_path}/Shuttle.toml\" ]"
        
        # Check for migrations directory
        run_check "Migrations directory exists: ${service}" "[ -d \"${service_path}/migrations\" ]" false
        
        # Check service-specific structure
        run_check "Domain module exists: ${service}" "[ -d \"${service_path}/src/domain\" ]" false
        run_check "Application module exists: ${service}" "[ -d \"${service_path}/src/application\" ]" false
        run_check "Adapters module exists: ${service}" "[ -d \"${service_path}/src/adapters\" ]" false
    done
}

# Function to validate frontend setup
validate_frontend_setup() {
    echo -e "${BLUE}=== Frontend Setup Validation ===${NC}"
    
    run_check "Node.js installed" "command -v node"
    run_check "npm installed" "command -v npm"
    run_check "Frontend package.json exists" "[ -f apps/web/package.json ]"
    
    if [ -f "apps/web/package.json" ]; then
        cd apps/web
        run_check "Frontend dependencies installed" "[ -d node_modules ]"
        run_check "Frontend builds successfully" "npm run build" false
        run_check "Frontend tests pass" "npm test" false
        cd - >/dev/null
    fi
}

# Function to validate security configurations
validate_security_configs() {
    echo -e "${BLUE}=== Security Configuration Validation ===${NC}"
    
    # Check for .env files that shouldn't be committed
    run_check "No .env files committed" "! find . -name '.env' -not -path './.git/*' | grep -q ."
    run_check "No .env.local files committed" "! find . -name '.env.local' -not -path './.git/*' | grep -q ."
    
    # Check for example env files
    run_check "Example env files exist" "find . -name '.env.example' | grep -q ."
    
    # Check for security-related files
    run_check "No hardcoded secrets in source" "! grep -r 'sk-[a-zA-Z0-9]' --include='*.rs' --include='*.ts' --include='*.js' ." false
    run_check "No database passwords in source" "! grep -ri 'password.*=' --include='*.rs' --include='*.ts' --include='*.js' . | grep -v example" false
}

# Function to generate validation report
generate_report() {
    echo -e "\n${BLUE}=== VALIDATION SUMMARY ===${NC}"
    echo -e "${BLUE}Total Checks: ${TOTAL_CHECKS}${NC}"
    echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
    echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"
    echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}"
    
    local pass_percentage=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo -e "${BLUE}Success Rate: ${pass_percentage}%${NC}"
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "\n${GREEN}✅ All critical checks passed! Your CI/CD pipeline is ready.${NC}"
        
        if [ $WARNINGS -gt 0 ]; then
            echo -e "${YELLOW}⚠ Note: There are ${WARNINGS} warnings that should be addressed for optimal setup.${NC}"
        fi
        
        return 0
    else
        echo -e "\n${RED}❌ ${FAILED_CHECKS} critical checks failed. Please address these issues before proceeding.${NC}"
        
        echo -e "\n${YELLOW}Next steps:${NC}"
        echo -e "1. Review failed checks above"
        echo -e "2. Run individual setup scripts as needed:"
        echo -e "   • ./scripts/setup-branch-protection.sh"
        echo -e "   • ./scripts/setup-shuttle-projects.sh"
        echo -e "   • ./scripts/setup-vercel-project.sh"
        echo -e "3. Set up missing secrets using the GitHub CLI:"
        echo -e "   • gh secret set SECRET_NAME"
        echo -e "4. Re-run this validation: ./scripts/validate-setup.sh"
        
        return 1
    fi
}

# Function to save detailed report
save_detailed_report() {
    local report_file="validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "CI/CD Pipeline Validation Report"
        echo "Generated: $(date)"
        echo "Repository: $(git remote get-url origin 2>/dev/null || 'Unknown')"
        echo "Branch: $(git branch --show-current 2>/dev/null || 'Unknown')"
        echo "Commit: $(git rev-parse --short HEAD 2>/dev/null || 'Unknown')"
        echo ""
        echo "Summary:"
        echo "  Total Checks: $TOTAL_CHECKS"
        echo "  Passed: $PASSED_CHECKS"
        echo "  Failed: $FAILED_CHECKS"
        echo "  Warnings: $WARNINGS"
        echo "  Success Rate: $((PASSED_CHECKS * 100 / TOTAL_CHECKS))%"
        echo ""
        echo "For detailed results, see the console output above."
    } > "$report_file"
    
    echo -e "${BLUE}Detailed report saved to: ${report_file}${NC}"
}

# Main execution
echo -e "${BLUE}Starting comprehensive validation...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}\n"

# Run all validation functions
validate_github_cli
validate_github_workflows
validate_github_secrets
validate_branch_protection
validate_docker_setup
validate_rust_toolchain
validate_shuttle_cli
validate_vercel_cli
validate_database_setup
validate_service_configs
validate_frontend_setup
validate_security_configs

# Generate and save report
echo -e "\n${BLUE}Generating validation report...${NC}"
generate_report
save_detailed_report

# Exit with appropriate code
if [ $FAILED_CHECKS -eq 0 ]; then
    exit 0
else
    exit 1
fi