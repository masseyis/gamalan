#!/bin/bash

# Fixed Smart Test Runner for Rust Monorepo
# Simplified version that fixes the core issues identified

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[SMART-TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SMART-TEST]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[SMART-TEST]${NC} $1"
}

print_error() {
    echo -e "${RED}[SMART-TEST]${NC} $1"
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
            echo "Fixed Smart Test Runner for Rust Monorepo"
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

print_status "Starting smart test execution..."
print_status "Base reference: $BASE_REF"

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

# Function to run all tests
run_all_tests() {
    print_status "Running all unit tests..."
    
    if cargo test --lib --workspace --quiet; then
        print_success "All unit tests passed!"
        return 0
    else
        print_error "Some tests failed!"
        print_error "To debug, run: cargo test --lib --workspace --verbose"
        return 1
    fi
}

# Function to get changed files since base ref
get_changed_files() {
    local base_ref="$1"
    
    # Check if base ref exists
    if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
        print_warning "Base ref '$base_ref' not found, falling back to staged files"
        git diff --cached --name-only 2>/dev/null || true
        return
    fi
    
    # Get changed files
    git diff --name-only "$base_ref"...HEAD 2>/dev/null || true
}

# Function to determine affected packages from changed files
get_affected_packages() {
    local changed_files="$1"
    local affected_packages=""
    
    print_status "Analyzing changed files to determine affected packages..."
    
    # Check each changed file
    while IFS= read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi
        
        # Check for workspace-level changes that affect everything
        if [[ "$file" == "Cargo.toml" ]] || [[ "$file" == "Cargo.lock" ]]; then
            print_warning "Workspace-level change detected: $file"
            return 1  # Signal to run all tests
        fi
        
        # Check for shared library changes
        if [[ "$file" == libs/* ]]; then
            print_warning "Shared library change detected: $file"
            return 1  # Signal to run all tests
        fi
        
        # Map service directories to package names
        if [[ "$file" == services/context-orchestrator/* ]]; then
            if [[ "$affected_packages" != *"context-orchestrator"* ]]; then
                affected_packages="$affected_packages context-orchestrator"
                print_status "Detected change affecting: context-orchestrator"
            fi
        elif [[ "$file" == services/backlog/* ]]; then
            if [[ "$affected_packages" != *"backlog"* ]]; then
                affected_packages="$affected_packages backlog"
                print_status "Detected change affecting: backlog"
            fi
        elif [[ "$file" == services/projects/* ]]; then
            if [[ "$affected_packages" != *"projects"* ]]; then
                affected_packages="$affected_packages projects"
                print_status "Detected change affecting: projects"
            fi
        elif [[ "$file" == services/readiness/* ]]; then
            if [[ "$affected_packages" != *"readiness"* ]]; then
                affected_packages="$affected_packages readiness"
                print_status "Detected change affecting: readiness"
            fi
        elif [[ "$file" == services/prompt-builder/* ]]; then
            if [[ "$affected_packages" != *"prompt-builder"* ]]; then
                affected_packages="$affected_packages prompt-builder"
                print_status "Detected change affecting: prompt-builder"
            fi
        elif [[ "$file" == services/api-gateway/* ]]; then
            if [[ "$affected_packages" != *"api-gateway"* ]]; then
                affected_packages="$affected_packages api-gateway"
                print_status "Detected change affecting: api-gateway"
            fi
        elif [[ "$file" == services/auth-gateway/* ]]; then
            if [[ "$affected_packages" != *"auth-gateway"* ]]; then
                affected_packages="$affected_packages auth-gateway"
                print_status "Detected change affecting: auth-gateway"
            fi
        elif [[ "$file" == libs/common/* ]]; then
            print_warning "Common library change detected: $file"
            return 1  # Affects all packages
        elif [[ "$file" == libs/auth_clerk/* ]]; then
            print_warning "Auth library change detected: $file"
            return 1  # Affects all packages
        fi
        
    done <<< "$changed_files"
    
    # Clean up the packages list
    echo "$affected_packages" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' '
    return 0
}

# Function to run tests for specific packages
run_tests_for_packages() {
    local packages="$1"
    local test_count=0
    local failed_packages=""
    
    print_status "Running tests for affected packages..."
    
    # Convert to array for easier processing
    local packages_array=($packages)
    
    # Test each affected package
    for package_name in "${packages_array[@]}"; do
        if [[ -z "$package_name" ]]; then
            continue
        fi
        
        print_status "Testing package: $package_name"
        ((test_count++))
        
        # Run unit tests for the specific package
        if cargo test --lib --package "$package_name" --quiet; then
            print_success "Tests passed for package: $package_name"
        else
            print_error "Tests failed for package: $package_name"
            failed_packages="$failed_packages $package_name"
            
            # Show the specific failure for debugging
            print_error "To debug this failure, run:"
            print_error "  cargo test --lib --package $package_name --verbose"
        fi
    done
    
    # Also test packages that commonly depend on the changed ones
    if [[ "$packages" == *"common"* ]] || [[ "$packages" == *"auth_clerk"* ]]; then
        print_status "Testing additional packages that depend on shared libraries..."
        local additional_packages="context-orchestrator backlog projects readiness prompt-builder"
        
        for package_name in $additional_packages; do
            if [[ "$packages" != *"$package_name"* ]]; then
                print_status "Testing dependent package: $package_name"
                ((test_count++))
                
                if cargo test --lib --package "$package_name" --quiet; then
                    print_success "Tests passed for dependent package: $package_name"
                else
                    print_error "Tests failed for dependent package: $package_name"
                    failed_packages="$failed_packages $package_name"
                fi
            fi
        done
    fi
    
    # Report results
    if [[ -n "$failed_packages" ]]; then
        print_error ""
        print_error "Tests failed for the following packages:"
        echo "$failed_packages" | tr ' ' '\n' | grep -v '^$' | sort -u | sed 's/^/  - /'
        print_error ""
        print_error "To debug all failures, run:"
        echo "$failed_packages" | tr ' ' '\n' | grep -v '^$' | sort -u | sed 's/^/  cargo test --lib --package /' | sed 's/$/ --verbose/'
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

file_count=$(echo "$changed_files" | wc -l)
print_status "Found $file_count changed files"

# Show a sample of changed files
if [[ $file_count -le 10 ]]; then
    echo "$changed_files" | sed 's/^/  - /'
else
    echo "$changed_files" | head -10 | sed 's/^/  - /'
    print_status "  ... and $((file_count - 10)) more files"
fi

# Get affected packages
affected_packages=$(get_affected_packages "$changed_files")
affected_exit_code=$?

if [[ $affected_exit_code -ne 0 ]]; then
    print_warning "Workspace-level changes detected, running all tests for safety"
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
echo "$affected_packages" | tr ' ' '\n' | sed 's/^/  - /'

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