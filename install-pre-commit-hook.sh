#!/bin/bash

# Install pre-commit hook for the ai-agile Rust workspace
# This script sets up the git pre-commit hook for all team members

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[SETUP]${NC} $1"
}

print_error() {
    echo -e "${RED}[SETUP]${NC} $1"
}

print_status "Installing pre-commit hook for ai-agile workspace..."

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ] || [ ! -f "CLAUDE.md" ]; then
    print_error "Please run this script from the root of the ai-agile repository."
    exit 1
fi

# Check if .git directory exists
if [ ! -d ".git" ]; then
    print_error "This doesn't appear to be a git repository."
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Check if pre-commit hook already exists
if [ -f ".git/hooks/pre-commit" ]; then
    print_warning "Pre-commit hook already exists. Backing it up..."
    cp .git/hooks/pre-commit .git/hooks/pre-commit.backup.$(date +%Y%m%d_%H%M%S)
    print_status "Backup created as: .git/hooks/pre-commit.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Install the pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Pre-commit hook for Rust workspace
# Runs cargo fmt (auto-fix + stage) and clippy (quality gate)
# Based on CLAUDE.md requirements for the ai-agile project

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[PRE-COMMIT]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PRE-COMMIT]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[PRE-COMMIT]${NC} $1"
}

print_error() {
    echo -e "${RED}[PRE-COMMIT]${NC} $1"
}

# Check if we're in a Rust workspace
if [ ! -f "Cargo.toml" ]; then
    print_error "No Cargo.toml found. This hook is designed for Rust workspaces."
    exit 1
fi

print_status "Starting pre-commit checks for Rust workspace..."

# ==============================================================================
# STEP 1: CARGO FMT (Auto-fix and stage changes)
# ==============================================================================

print_status "Running cargo fmt --all (auto-fixing formatting)..."

# Run cargo fmt and capture any changes
if ! cargo fmt --all 2>/dev/null; then
    print_error "cargo fmt failed to run. Please check your Rust installation."
    exit 1
fi

# Check if fmt made any changes and stage them
FORMATTED_FILES=$(git diff --name-only --diff-filter=M | grep -E '\.(rs)$' || true)

if [ -n "$FORMATTED_FILES" ]; then
    print_warning "Auto-formatted the following files:"
    echo "$FORMATTED_FILES" | sed 's/^/  - /'
    
    # Stage the formatted files
    echo "$FORMATTED_FILES" | xargs git add
    
    print_success "Formatted files have been staged automatically."
else
    print_success "No formatting changes needed."
fi

# ==============================================================================
# STEP 2: CARGO CLIPPY (Quality gate - fail on warnings/errors)
# ==============================================================================

print_status "Running cargo clippy --lib --bins --examples --all-features -- -D warnings..."

# Run clippy with strict warning enforcement
CLIPPY_OUTPUT=$(mktemp)
CLIPPY_EXIT_CODE=0

if ! cargo clippy --lib --bins --examples --all-features --color=always -- -D warnings 2>&1 | tee "$CLIPPY_OUTPUT"; then
    CLIPPY_EXIT_CODE=1
fi

# Check results
if [ $CLIPPY_EXIT_CODE -eq 0 ]; then
    print_success "All clippy checks passed!"
else
    print_error "Clippy found issues that must be fixed before committing:"
    echo
    cat "$CLIPPY_OUTPUT"
    echo
    print_error "Please fix the compilation errors/clippy warnings above and try committing again."
    print_error "Note: Compilation errors prevent clippy from running properly."
    rm -f "$CLIPPY_OUTPUT"
    exit 1
fi

rm -f "$CLIPPY_OUTPUT"

# ==============================================================================
# COMPLETION
# ==============================================================================

print_success "All pre-commit checks passed!"
print_status "Commit will proceed..."

exit 0
EOF

# Make the hook executable
chmod +x .git/hooks/pre-commit

print_success "Pre-commit hook installed successfully!"
echo
print_status "The hook will:"
print_status "  1. Run 'cargo fmt --all' and auto-stage any formatting changes"
print_status "  2. Run 'cargo clippy --lib --bins --examples' with -D warnings and fail on any issues"
print_status "  3. Provide clear feedback about what's happening"
echo
print_status "To test the hook, you can run: .git/hooks/pre-commit"
print_status "Or make a test commit to see it in action."
echo
print_success "Setup complete! The pre-commit hook is now active for this repository."
