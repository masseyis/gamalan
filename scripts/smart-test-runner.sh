#!/bin/bash

# Robust Smart Test Runner for Rust Monorepo
# Production-ready version that fixes all identified issues

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[SMART-TEST]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[SMART-TEST]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[SMART-TEST]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[SMART-TEST]${NC} $1" >&2
}

# Configuration
DEFAULT_BASE_REF="origin/main"
FORCE_ALL_TESTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --base-ref)
            BASE_REF="$2"
            shift 2
            ;;
        --all)
            FORCE_ALL_TESTS=true
            shift
            ;;
        --help)
            echo "Robust Smart Test Runner for Rust Monorepo"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --base-ref REF    Compare against specific ref (default: origin/main)"
            echo "  --all            Force run all tests regardless of changes"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run tests for changed components"
            echo "  $0 --all             # Run all tests"
            echo "  $0 --base-ref HEAD~1  # Compare against previous commit"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

BASE_REF=${BASE_REF:-$DEFAULT_BASE_REF}

print_status "Starting robust smart test execution..."
print_status "Base reference: $BASE_REF"

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

# Function to run all tests with proper error handling
run_all_tests() {
    print_status "Running all unit tests..."
    
    local test_output
    test_output=$(mktemp)
    
    # Capture both stdout and stderr, but only show test output on failure
    if cargo test --lib --workspace 2>&1 | tee "$test_output" | grep -E "(test result:|running|error:|failed)" >/dev/null; then
        # Check the actual exit status from cargo test
        local exit_code=${PIPESTATUS[0]}
        if [[ $exit_code -eq 0 ]]; then
            print_success "All unit tests passed!"
            rm -f "$test_output"
            return 0
        else
            print_error "Some tests failed! (exit code: $exit_code)"
            print_error ""
            print_error "Full test output:"
            cat "$test_output" >&2
            rm -f "$test_output"
            return 1
        fi
    else
        print_error "Failed to run tests!"
        rm -f "$test_output"
        return 1
    fi
}

# Function to get changed files since base ref
get_changed_files() {
    local base_ref="$1"
    
    # Check if base ref exists
    if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
        print_warning "Base ref '$base_ref' not found, falling back to staged files"
        git diff --cached --name-only 2>/dev/null || echo ""
        return
    fi
    
    # Get changed files
    git diff --name-only "$base_ref"...HEAD 2>/dev/null || echo ""
}

# Function to map service directory to package name
map_service_to_package() {
    local file="$1"
    
    case "$file" in
        services/context-orchestrator/*)
            echo "context-orchestrator"
            ;;
        services/backlog/*)
            echo "backlog"
            ;;
        services/projects/*)
            echo "projects"
            ;;
        services/readiness/*)
            echo "readiness"
            ;;
        services/prompt-builder/*)
            echo "prompt-builder"
            ;;
        services/api-gateway/*)
            echo "api-gateway"
            ;;
        services/auth-gateway/*)
            echo "auth-gateway"
            ;;
        libs/common/*)
            echo "SHARED_LIBS"  # Special marker for shared libraries
            ;;
        libs/auth_clerk/*)
            echo "SHARED_LIBS"  # Special marker for shared libraries
            ;;
        Cargo.toml|Cargo.lock)
            echo "WORKSPACE_LEVEL"  # Special marker for workspace changes
            ;;
        *)
            echo ""  # No package mapping
            ;;
    esac
}

# Function to determine affected packages from changed files
get_affected_packages() {
    local changed_files="$1"
    local affected_packages=()
    local has_shared_changes=false
    local has_workspace_changes=false
    
    print_status "Analyzing changed files to determine affected packages..."
    
    # Process each changed file
    while IFS= read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi
        
        local package
        package=$(map_service_to_package "$file")
        
        case "$package" in
            "WORKSPACE_LEVEL")
                print_warning "Workspace-level change detected: $file"
                has_workspace_changes=true
                ;;
            "SHARED_LIBS")
                print_warning "Shared library change detected: $file"
                has_shared_changes=true
                ;;
            "")
                # No specific package mapping, skip
                ;;
            *)
                # Add to affected packages if not already present
                local found=false
                if [[ ${#affected_packages[@]} -gt 0 ]]; then
                    for existing in "${affected_packages[@]}"; do
                        if [[ "$existing" == "$package" ]]; then
                            found=true
                            break
                        fi
                    done
                fi
                if [[ "$found" == "false" ]]; then
                    affected_packages+=("$package")
                    print_status "Detected change affecting: $package"
                fi
                ;;
        esac
    done <<< "$changed_files"
    
    # Determine final strategy
    if [[ "$has_workspace_changes" == "true" ]] || [[ "$has_shared_changes" == "true" ]]; then
        echo "ALL_TESTS"
        return 1  # Signal to run all tests
    elif [[ ${#affected_packages[@]} -eq 0 ]]; then
        echo ""
        return 0
    else
        # Return unique sorted packages
        printf '%s\n' "${affected_packages[@]}" | sort -u | tr '\n' ' '
        return 0
    fi
}

# Function to run tests for specific packages
run_tests_for_packages() {
    local packages="$1"
    local test_count=0
    local failed_packages=()
    
    print_status "Running tests for affected packages..."
    
    # Convert space-separated string to array
    local packages_array
    IFS=' ' read -ra packages_array <<< "$packages"
    
    # Test each affected package
    for package_name in "${packages_array[@]}"; do
        if [[ -z "$package_name" ]]; then
            continue
        fi
        
        print_status "Testing package: $package_name"
        ((test_count++))
        
        local test_output
        test_output=$(mktemp)
        
        # Run unit tests for the specific package
        if cargo test --lib --package "$package_name" 2>&1 | tee "$test_output" | grep -E "(test result:|running|error:|failed)" >/dev/null; then
            local exit_code=${PIPESTATUS[0]}
            if [[ $exit_code -eq 0 ]]; then
                print_success "Tests passed for package: $package_name"
            else
                print_error "Tests failed for package: $package_name (exit code: $exit_code)"
                failed_packages+=("$package_name")
                
                # Show relevant error output
                print_error "Error details:"
                grep -E "(test.*FAILED|error:|failed|panic)" "$test_output" | head -10 | sed 's/^/  /' >&2
            fi
        else
            print_error "Failed to run tests for package: $package_name"
            failed_packages+=("$package_name")
        fi
        
        rm -f "$test_output"
    done
    
    # Report results
    if [[ ${#failed_packages[@]} -gt 0 ]]; then
        print_error ""
        print_error "Tests failed for the following packages:"
        printf '  - %s\n' "${failed_packages[@]}" >&2
        print_error ""
        print_error "To debug failures, run:"
        printf '  cargo test --lib --package %s --verbose\n' "${failed_packages[@]}" >&2
        return 1
    fi
    
    print_success "All tests passed! ($test_count test suites executed)"
    return 0
}

# Function to run smoke test
run_smoke_test() {
    print_status "No specific package changes detected, running smoke test..."
    
    # First check compilation
    print_status "Checking workspace compilation..."
    if ! cargo check --workspace --quiet; then
        print_error "Compilation check failed!"
        print_error "Run 'cargo check --workspace' for details."
        return 1
    fi
    
    print_success "Compilation check passed!"
    
    # Test critical shared packages
    print_status "Testing critical shared packages..."
    if run_tests_for_packages "common auth_clerk"; then
        print_success "Smoke test completed successfully!"
        return 0
    else
        print_error "Critical package tests failed!"
        return 1
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

# Force all tests if requested
if [[ "$FORCE_ALL_TESTS" == "true" ]]; then
    print_status "Running all tests (forced by --all flag)"
    run_all_tests
    exit $?
fi

# Get changed files
print_status "Detecting changed files since $BASE_REF..."
changed_files=$(get_changed_files "$BASE_REF")

if [[ -z "$changed_files" ]]; then
    print_warning "No changed files detected."
    run_smoke_test
    exit $?
fi

# Count and display changed files
file_count=$(echo "$changed_files" | wc -l)
print_status "Found $file_count changed files"

# Show sample of changed files
if [[ $file_count -le 10 ]]; then
    while IFS= read -r file; do
        echo "  - $file" >&2
    done <<< "$changed_files"
else
    echo "$changed_files" | head -10 | sed 's/^/  - /' >&2
    print_status "  ... and $((file_count - 10)) more files"
fi

# Get affected packages
affected_packages=$(get_affected_packages "$changed_files")
affected_exit_code=$?

if [[ $affected_exit_code -ne 0 ]] || [[ "$affected_packages" == "ALL_TESTS" ]]; then
    print_warning "Running all tests due to workspace-level or shared library changes"
    run_all_tests
    exit $?
fi

if [[ -z "$affected_packages" ]]; then
    print_warning "No Rust packages appear to be directly affected by changes."
    run_smoke_test
    exit $?
fi

# Clean up and show affected packages
affected_packages=$(echo "$affected_packages" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
package_count=$(echo "$affected_packages" | wc -w)

print_status "Detected $package_count affected packages:"
echo "$affected_packages" | tr ' ' '\n' | sed 's/^/  - /' >&2

# Run tests for affected packages
run_tests_for_packages "$affected_packages"
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
    print_success "✅ Smart test execution completed successfully!"
    print_status "Tested only affected components, saving time while maintaining safety."
else
    print_error "❌ Smart test execution failed!"
fi

exit $exit_code