#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Master CI/CD Pipeline Setup${NC}"
echo -e "${BLUE}This script will configure your complete GitHub repository and deployment infrastructure.${NC}\n"

# Function to display banner
display_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
   ____  _____   _____ _____          _____  ______ _______ _    _ _____  
  / __ \|_   _| / ____|  __ \   /\   |_   _||  ____|__   __| |  | |  __ \ 
 | |  | | | |  | |    | |  | | /  \    | |  | |__     | |  | |  | | |__) |
 | |  | | | |  | |    | |  | |/ /\ \   | |  |  __|    | |  | |  | |  ___/ 
 | |__| |_| |_ | |____| |__| / ____ \ _| |_ | |____   | |  | |__| | |     
  \____/|_____| \_____|_____/_/    \_\_____|______|  |_|   \____/|_|     
                                                                          
                   Salunga AI Agile Platform                              
EOF
    echo -e "${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    local missing_tools=()
    
    # Check required tools
    command -v git >/dev/null 2>&1 || missing_tools+=("git")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo -e "${RED}Missing required tools: ${missing_tools[*]}${NC}"
        echo -e "${YELLOW}Please install missing tools and run again.${NC}"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}This script must be run from within a Git repository.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Function to display setup menu
display_menu() {
    echo -e "${BLUE}Setup Options:${NC}"
    echo -e "  ${GREEN}1.${NC} Full Setup (Recommended) - Run all setup scripts"
    echo -e "  ${GREEN}2.${NC} GitHub Configuration Only - Secrets, branch protection, workflows"
    echo -e "  ${GREEN}3.${NC} Deployment Infrastructure Only - Shuttle and Vercel setup"
    echo -e "  ${GREEN}4.${NC} Testing Infrastructure Only - Docker and database setup"
    echo -e "  ${GREEN}5.${NC} Individual Component Setup - Choose specific components"
    echo -e "  ${GREEN}6.${NC} Validation Only - Run validation checks without setup"
    echo -e "  ${GREEN}q.${NC} Quit"
    echo ""
}

# Function to run full setup
run_full_setup() {
    echo -e "${BLUE}Running full CI/CD pipeline setup...${NC}"
    
    local setup_steps=(
        "GitHub secrets documentation:./scripts/setup-secrets-guide.sh"
        "Branch protection rules:./scripts/setup-branch-protection.sh"
        "Shuttle projects:./scripts/setup-shuttle-projects.sh"
        "Vercel project:./scripts/setup-vercel-project.sh"
        "Docker test environment:docker-compose -f docker-compose.test.yml config"
        "Validation:./scripts/validate-setup.sh"
    )
    
    for step in "${setup_steps[@]}"; do
        local name="${step%%:*}"
        local command="${step##*:}"
        
        echo -e "\n${YELLOW}Setting up: ${name}${NC}"
        
        if [[ "$command" == *".sh" ]] && [[ -f "$command" ]]; then
            if bash "$command"; then
                echo -e "${GREEN}✓ Completed: ${name}${NC}"
            else
                echo -e "${RED}✗ Failed: ${name}${NC}"
                echo -e "${YELLOW}Continue anyway? (y/n): ${NC}"
                read -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            fi
        elif eval "$command" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Completed: ${name}${NC}"
        else
            echo -e "${YELLOW}⚠ Skipped: ${name} (command not available)${NC}"
        fi
    done
    
    echo -e "\n${GREEN}✅ Full setup completed!${NC}"
}

# Function to run GitHub configuration only
run_github_setup() {
    echo -e "${BLUE}Setting up GitHub configuration...${NC}"
    
    echo -e "\n${YELLOW}Step 1: GitHub Secrets Setup${NC}"
    if [ -f "./scripts/setup-branch-protection.sh" ]; then
        echo -e "${BLUE}Please refer to .github/SECRETS_SETUP.md for detailed instructions.${NC}"
        echo -e "${YELLOW}Press any key to continue after setting up secrets...${NC}"
        read -n 1 -r
    fi
    
    echo -e "\n${YELLOW}Step 2: Branch Protection Rules${NC}"
    if [ -f "./scripts/setup-branch-protection.sh" ]; then
        bash ./scripts/setup-branch-protection.sh
    fi
    
    echo -e "${GREEN}✅ GitHub configuration completed!${NC}"
}

# Function to run deployment infrastructure setup
run_deployment_setup() {
    echo -e "${BLUE}Setting up deployment infrastructure...${NC}"
    
    echo -e "\n${YELLOW}Step 1: Shuttle Projects${NC}"
    if [ -f "./scripts/setup-shuttle-projects.sh" ]; then
        bash ./scripts/setup-shuttle-projects.sh
    fi
    
    echo -e "\n${YELLOW}Step 2: Vercel Project${NC}"
    if [ -f "./scripts/setup-vercel-project.sh" ]; then
        bash ./scripts/setup-vercel-project.sh
    fi
    
    echo -e "${GREEN}✅ Deployment infrastructure setup completed!${NC}"
}

# Function to run testing infrastructure setup
run_testing_setup() {
    echo -e "${BLUE}Setting up testing infrastructure...${NC}"
    
    echo -e "\n${YELLOW}Step 1: Docker Test Environment${NC}"
    if [ -f "docker-compose.test.yml" ]; then
        echo -e "${BLUE}Validating test Docker Compose configuration...${NC}"
        docker-compose -f docker-compose.test.yml config >/dev/null 2>&1 && \
            echo -e "${GREEN}✓ Test environment configuration is valid${NC}" || \
            echo -e "${RED}✗ Test environment configuration has errors${NC}"
    fi
    
    echo -e "\n${YELLOW}Step 2: Test Database Initialization${NC}"
    if [ -f "./scripts/init-test-db.sh" ]; then
        echo -e "${GREEN}✓ Test database initialization script is ready${NC}"
        echo -e "${BLUE}To run tests: docker-compose -f docker-compose.test.yml up -d${NC}"
    fi
    
    echo -e "${GREEN}✅ Testing infrastructure setup completed!${NC}"
}

# Function to run individual component setup
run_individual_setup() {
    echo -e "${BLUE}Individual Component Setup${NC}"
    
    local components=(
        "GitHub Secrets Documentation:Display secrets setup guide"
        "Branch Protection Rules:./scripts/setup-branch-protection.sh"
        "Shuttle Projects:./scripts/setup-shuttle-projects.sh"
        "Vercel Project:./scripts/setup-vercel-project.sh"
        "Docker Test Environment:Validate docker-compose.test.yml"
        "Setup Validation:./scripts/validate-setup.sh"
    )
    
    echo -e "${YELLOW}Available components:${NC}"
    for i in "${!components[@]}"; do
        local name="${components[i]%%:*}"
        echo -e "  ${GREEN}$((i+1)).${NC} $name"
    done
    echo -e "  ${GREEN}0.${NC} Back to main menu"
    echo ""
    
    while true; do
        echo -e "${YELLOW}Select component to set up (0-${#components[@]}): ${NC}"
        read -n 1 -r selection
        echo
        
        if [[ "$selection" == "0" ]]; then
            return
        elif [[ "$selection" =~ ^[1-9]$ ]] && [ "$selection" -le "${#components[@]}" ]; then
            local component="${components[$((selection-1))]}"
            local name="${component%%:*}"
            local command="${component##*:}"
            
            echo -e "\n${YELLOW}Setting up: ${name}${NC}"
            
            if [[ "$command" == *".sh" ]] && [[ -f "$command" ]]; then
                bash "$command"
            elif [[ "$command" == "Display secrets setup guide" ]]; then
                if [ -f ".github/SECRETS_SETUP.md" ]; then
                    echo -e "${BLUE}Opening secrets setup guide...${NC}"
                    cat .github/SECRETS_SETUP.md | head -50
                    echo -e "\n${BLUE}Full guide available at: .github/SECRETS_SETUP.md${NC}"
                fi
            elif [[ "$command" == "Validate docker-compose.test.yml" ]]; then
                if docker-compose -f docker-compose.test.yml config >/dev/null 2>&1; then
                    echo -e "${GREEN}✓ Test environment configuration is valid${NC}"
                else
                    echo -e "${RED}✗ Test environment configuration has errors${NC}"
                fi
            fi
            
            echo -e "\n${YELLOW}Setup another component? (y/n): ${NC}"
            read -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return
            fi
        else
            echo -e "${RED}Invalid selection. Please try again.${NC}"
        fi
    done
}

# Function to run validation only
run_validation() {
    echo -e "${BLUE}Running setup validation...${NC}"
    
    if [ -f "./scripts/validate-setup.sh" ]; then
        bash ./scripts/validate-setup.sh
    else
        echo -e "${RED}Validation script not found. Please ensure all setup files are present.${NC}"
        exit 1
    fi
}

# Function to display final summary
display_summary() {
    echo -e "\n${BLUE}=== SETUP SUMMARY ===${NC}"
    echo -e "${GREEN}✅ CI/CD Pipeline configuration completed!${NC}"
    echo ""
    echo -e "${BLUE}What was set up:${NC}"
    echo -e "  • GitHub Actions secrets documentation"
    echo -e "  • Branch protection rules"
    echo -e "  • Shuttle project configurations"
    echo -e "  • Vercel project setup"
    echo -e "  • Docker test environment"
    echo -e "  • Comprehensive validation scripts"
    echo ""
    echo -e "${BLUE}Key files created:${NC}"
    echo -e "  • ${GREEN}.github/SECRETS_SETUP.md${NC} - GitHub Actions secrets guide"
    echo -e "  • ${GREEN}.github/ENVIRONMENT_SETUP.md${NC} - Environment configuration guide"
    echo -e "  • ${GREEN}docker-compose.test.yml${NC} - CI testing environment"
    echo -e "  • ${GREEN}scripts/setup-*.sh${NC} - Individual setup scripts"
    echo -e "  • ${GREEN}scripts/validate-setup.sh${NC} - Comprehensive validation"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "  1. Review and set GitHub repository secrets using:"
    echo -e "     ${YELLOW}.github/SECRETS_SETUP.md${NC}"
    echo -e "  2. Run validation to verify setup:"
    echo -e "     ${YELLOW}./scripts/validate-setup.sh${NC}"
    echo -e "  3. Test the CI/CD pipeline by creating a pull request"
    echo -e "  4. Deploy to staging environment first"
    echo -e "  5. After validation, deploy to production"
    echo ""
    echo -e "${YELLOW}Documentation:${NC}"
    echo -e "  • Environment Setup: .github/ENVIRONMENT_SETUP.md"
    echo -e "  • Secrets Setup: .github/SECRETS_SETUP.md"
    echo -e "  • Validation Guide: Run ./scripts/validate-setup.sh"
    echo ""
    echo -e "${GREEN}🚀 Your CI/CD pipeline is ready!${NC}"
}

# Main execution
display_banner
check_prerequisites

# Main menu loop
while true; do
    echo ""
    display_menu
    echo -e "${YELLOW}Choose an option: ${NC}"
    read -n 1 -r choice
    echo
    
    case $choice in
        1)
            run_full_setup
            display_summary
            break
            ;;
        2)
            run_github_setup
            echo -e "\n${YELLOW}Run validation? (y/n): ${NC}"
            read -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                run_validation
            fi
            ;;
        3)
            run_deployment_setup
            echo -e "\n${YELLOW}Run validation? (y/n): ${NC}"
            read -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                run_validation
            fi
            ;;
        4)
            run_testing_setup
            ;;
        5)
            run_individual_setup
            ;;
        6)
            run_validation
            ;;
        q|Q)
            echo -e "${BLUE}Setup cancelled by user.${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            ;;
    esac
done

echo -e "\n${GREEN}Setup completed successfully!${NC}"