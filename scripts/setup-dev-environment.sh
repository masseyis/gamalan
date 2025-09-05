#!/bin/bash

# Development Environment Setup Script for ai-agile Rust workspace
# This script sets up all necessary git hooks, tools, and configurations
# for optimized CI/CD development workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BOLD}${BLUE}================================================================${NC}"
    echo -e "${BOLD}${BLUE}$1${NC}"
    echo -e "${BOLD}${BLUE}================================================================${NC}"
}

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SETUP]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[SETUP]${NC} ⚠️  $1"
}

print_error() {
    echo -e "${RED}[SETUP]${NC} ❌ $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} 💡 $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if we're in the right repository
check_repository() {
    if [ ! -f "Cargo.toml" ] || [ ! -f "CLAUDE.md" ]; then
        print_error "Please run this script from the root of the ai-agile repository."
        exit 1
    fi
    
    if [ ! -d ".git" ]; then
        print_error "This doesn't appear to be a git repository."
        exit 1
    fi
    
    print_success "Repository validation passed"
}

# Function to install git hooks
install_git_hooks() {
    print_header "INSTALLING GIT HOOKS"
    
    # Create hooks directory if it doesn't exist
    mkdir -p .git/hooks
    
    # Install pre-commit hook using existing installer
    if [ -f "./install-pre-commit-hook.sh" ]; then
        print_status "Installing pre-commit hook..."
        chmod +x ./install-pre-commit-hook.sh
        ./install-pre-commit-hook.sh
        print_success "Pre-commit hook installed"
    else
        print_error "Pre-commit hook installer not found!"
        exit 1
    fi
    
    # Ensure pre-push hook is executable
    if [ -f ".git/hooks/pre-push" ]; then
        chmod +x .git/hooks/pre-push
        print_success "Pre-push hook configured"
    else
        print_error "Pre-push hook not found! Expected at .git/hooks/pre-push"
        exit 1
    fi
    
    # Verify hooks are working
    print_status "Verifying git hooks..."
    if [ -x ".git/hooks/pre-commit" ] && [ -x ".git/hooks/pre-push" ]; then
        print_success "All git hooks are executable and ready"
    else
        print_error "Some git hooks are not properly configured"
        exit 1
    fi
}

# Function to install required tools
install_tools() {
    print_header "INSTALLING REQUIRED TOOLS"
    
    # Check Rust installation
    if ! command_exists cargo; then
        print_error "Rust/Cargo not found! Please install Rust first: https://rustup.rs/"
        exit 1
    fi
    print_success "Rust/Cargo found"
    
    # Install Rust components
    print_status "Installing Rust components..."
    rustup component add rustfmt clippy || print_warning "Components may already be installed"
    print_success "Rust components installed"
    
    # Install cargo tools
    print_status "Installing cargo tools..."
    
    # sqlx-cli for database migrations
    if ! command_exists sqlx; then
        print_status "Installing sqlx-cli..."
        cargo install sqlx-cli --no-default-features --features "postgres,uuid,tls-rustls" || print_warning "sqlx-cli installation may have failed"
    else
        print_success "sqlx-cli already installed"
    fi
    
    # cargo-tarpaulin for coverage
    if ! cargo tarpaulin --version >/dev/null 2>&1; then
        print_status "Installing cargo-tarpaulin..."
        cargo install cargo-tarpaulin --version 0.13.3 || print_warning "tarpaulin installation may have failed"
    else
        print_success "cargo-tarpaulin already installed"
    fi
    
    # Check for jq (needed by smart test runner)
    if ! command_exists jq; then
        print_warning "jq not found - smart test runner may not work optimally"
        print_info "Install jq: brew install jq (macOS) or apt-get install jq (Linux)"
    else
        print_success "jq found"
    fi
}

# Function to make scripts executable
setup_scripts() {
    print_header "SETTING UP SCRIPTS"
    
    # Smart test runner
    if [ -f "scripts/smart-test-runner.sh" ]; then
        chmod +x scripts/smart-test-runner.sh
        print_success "Smart test runner configured"
    else
        print_error "Smart test runner script not found!"
        exit 1
    fi
    
    # Make this script executable (if not already)
    chmod +x "$0" 2>/dev/null || true
    
    print_success "All scripts are executable"
}

# Function to test the setup
test_setup() {
    print_header "TESTING SETUP"
    
    print_status "Testing formatting..."
    if cargo fmt --all --check >/dev/null 2>&1; then
        print_success "Code formatting check passed"
    else
        print_warning "Code needs formatting - run 'cargo fmt --all'"
    fi
    
    print_status "Testing clippy..."
    if cargo clippy --all-targets --all-features --quiet -- -D warnings >/dev/null 2>&1; then
        print_success "Clippy checks passed"
    else
        print_warning "Clippy found issues - fix before committing"
    fi
    
    print_status "Testing build..."
    if cargo build --workspace --quiet; then
        print_success "Build test passed"
    else
        print_error "Build failed - please fix compilation errors"
        exit 1
    fi
    
    print_status "Testing git hooks..."
    if [ -x ".git/hooks/pre-commit" ] && [ -x ".git/hooks/pre-push" ]; then
        print_success "Git hooks are properly configured"
    else
        print_error "Git hooks are not properly configured"
        exit 1
    fi
    
    print_success "Setup testing completed successfully"
}

# Function to show usage information
show_usage() {
    print_header "DEVELOPMENT WORKFLOW COMMANDS"
    
    echo -e "${BOLD}Git Hooks:${NC}"
    echo "  pre-commit: Automatic formatting (cargo fmt) + clippy checks"
    echo "  pre-push:   Unit tests + build verification before push"
    echo ""
    
    echo -e "${BOLD}Makefile Commands:${NC}"
    echo "  make fmt          - Format all code"
    echo "  make lint         - Run clippy linting"
    echo "  make build        - Build all crates"
    echo "  make test-unit    - Run all unit tests"
    echo "  make smart-test   - Run tests for changed components only"
    echo "  make test-changed - Run tests for components changed since last commit"
    echo "  make dev-up       - Start local development services"
    echo "  make coverage     - Generate test coverage report"
    echo "  make check-pr     - Run all PR validation checks"
    echo ""
    
    echo -e "${BOLD}Direct Commands:${NC}"
    echo "  ./scripts/smart-test-runner.sh            - Smart test execution"
    echo "  ./scripts/smart-test-runner.sh --all      - Force run all tests"
    echo "  ./scripts/smart-test-runner.sh --help     - Show smart test runner help"
    echo ""
    
    echo -e "${BOLD}Quality Gates (matching CI):${NC}"
    echo "  1. Format check:  cargo fmt --all --check"
    echo "  2. Lint check:    cargo clippy --all-targets --all-features -- -D warnings"
    echo "  3. Build check:   cargo build --workspace"
    echo "  4. Unit tests:    cargo test --lib --workspace"
    echo "  5. Coverage:      ≥85% required for merge"
    echo ""
    
    echo -e "${BOLD}CI/CD Integration:${NC}"
    echo "  • Pre-commit hooks prevent bad commits"
    echo "  • Pre-push hooks prevent broken pushes"
    echo "  • Smart test runner optimizes CI time"
    echo "  • Coverage gates enforce quality standards"
    echo "  • All hooks match CI pipeline exactly"
}

# Main execution
main() {
    print_header "AI-AGILE DEVELOPMENT ENVIRONMENT SETUP"
    print_info "This script will set up git hooks, tools, and workflow optimizations"
    echo
    
    # Validate repository
    check_repository
    
    # Install components
    install_git_hooks
    install_tools
    setup_scripts
    
    # Test everything
    test_setup
    
    # Show usage
    show_usage
    
    print_header "SETUP COMPLETE"
    print_success "Development environment is ready!"
    print_info "You can now commit and push with confidence - hooks will ensure quality"
    print_info "Use 'make smart-test' for fast feedback during development"
    
    echo -e "\n${BOLD}Next Steps:${NC}"
    echo "  1. Try: make fmt lint"
    echo "  2. Try: make smart-test"
    echo "  3. Make a test commit to see hooks in action"
    echo "  4. Push to see the optimized CI pipeline"
}

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# Run main function
main