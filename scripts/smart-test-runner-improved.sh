#!/bin/bash

# Improved Smart Test Runner for Rust Monorepo
# Fixes identified issues:
# 1. Correct workspace metadata parsing
# 2. Robust error handling and fallback mechanisms
# 3. Better diagnostics and debugging output
# 4. Package name vs directory path handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Debug mode
DEBUG=${DEBUG:-false}

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

print_debug() {
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Enhanced error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    print_error "Error on line $line_number (exit code: $exit_code)"
    print_error "Command that failed: ${BASH_COMMAND}"
    
    # Provide helpful debugging information
    print_error ""
    print_error "=== DEBUGGING INFORMATION ==="
    print_error "Working directory: $(pwd)"
    print_error "Git status: $(git status --porcelain | head -5)"
    print_error "Cargo workspace check:"
    cargo metadata --format-version 1 --no-deps >/dev/null 2>&1 && print_error "  ✓ Workspace metadata accessible" || print_error "  ✗ Workspace metadata error"
    
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

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
        --debug)
            DEBUG=true
            shift
            ;;
        --help)
            echo "Improved Smart Test Runner for Rust Monorepo"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --base-ref REF    Compare against specific ref (default: origin/main)"
            echo "  --all            Force run all tests regardless of changes"
            echo "  --debug          Enable debug output"
            echo "  --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DEBUG=true       Enable debug mode"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run tests for changed components"
            echo "  $0 --all             # Run all tests"
            echo "  $0 --debug           # Run with debug output"
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

print_status "Starting improved smart test execution..."
print_status "Base reference: $BASE_REF"
[[ "$DEBUG" == "true" ]] && print_status "Debug mode: ENABLED"

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

# Function to validate prerequisites
validate_prerequisites() {
    print_debug "Validating prerequisites..."
    
    # Check if we're in a Cargo workspace
    if [[ ! -f "Cargo.toml" ]]; then
        print_error "No Cargo.toml found. This script requires a Cargo workspace."
        exit 1
    fi
    
    # Check if jq is available
    if ! command -v jq >/dev/null 2>&1; then
        print_error "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    # Check if cargo metadata works
    if ! cargo metadata --format-version 1 --no-deps >/dev/null 2>&1; then
        print_error "Unable to read cargo metadata. Check your Cargo.toml files."
        exit 1
    fi
    
    print_debug "Prerequisites validation passed"
}

# Function to get workspace packages (name:directory mapping)
get_workspace_packages() {
    print_debug "Getting workspace packages..."
    
    local packages
    packages=$(cargo metadata --format-version 1 --no-deps 2>/dev/null | \
        jq -r '.packages[] | select(.source == null) | "\(.name):\(.manifest_path | sub("/Cargo.toml$"; ""))"' | \
        sort)
    
    if [[ -z "$packages" ]]; then
        print_error "No workspace packages found"
        return 1
    fi
    
    print_debug "Found $(echo "$packages" | wc -l) workspace packages"
    if [[ "$DEBUG" == "true" ]]; then
        echo "$packages" | while IFS=':' read -r name path; do
            print_debug "  $name -> $path"
        done
    fi
    
    echo "$packages"
}

# Function to get changed files since base ref
get_changed_files() {
    local base_ref="$1"
    print_debug "Getting changed files since $base_ref..."
    
    # Check if base ref exists
    if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
        print_warning "Base ref '$base_ref' not found, falling back to staged files"
        git diff --cached --name-only 2>/dev/null || true
        return
    fi
    
    # Get changed files
    local changed_files
    changed_files=$(git diff --name-only "$base_ref"...HEAD 2>/dev/null || true)
    
    print_debug "Found $(echo "$changed_files" | grep -c . || echo 0) changed files"
    
    echo "$changed_files"
}

# Function to map changed files to affected packages
get_affected_packages() {
    local changed_files="$1"
    local affected_packages=""
    
    # Get all workspace packages (name:directory mapping)
    local workspace_packages
    workspace_packages=$(get_workspace_packages) || {
        print_error "Failed to get workspace packages"
        return 1
    }
    
    print_status "Analyzing changed files to determine affected packages..."
    
    # Check each changed file
    while IFS= read -r file; do
        if [[ -z "$file" ]]; then
            continue
        fi
        
        print_debug "  Analyzing: $file"
        
        # Check for workspace-level changes that affect everything
        if [[ "$file" == "Cargo.toml" ]] || [[ "$file" == "Cargo.lock" ]]; then
            print_warning "  -> Workspace-level change detected, will run all tests"
            return 1  # Signal to run all tests
        fi
        
        # Check for shared library changes
        if [[ "$file" == libs/* ]]; then
            print_warning "  -> Shared library change detected, will run all tests"
            return 1  # Signal to run all tests
        fi
        
        # Check if it's a file that affects package tests
        if [[ "$file" =~ \.(rs|toml)$ ]] || [[ "$file" =~ ^[^/]+/src/ ]] || [[ "$file" =~ ^[^/]+/tests/ ]]; then
            # Find which package this file belongs to
            local matched_package=""
            while IFS=':' read -r package_name package_path; do
                if [[ "$file" == "$package_path"/* ]]; then
                    matched_package="$package_name"
                    print_status "    -> Affects package: $package_name"
                    break
                fi
            done <<< "$workspace_packages"
            
            if [[ -n "$matched_package" ]]; then
                if [[ "$affected_packages" != *" $matched_package "* ]]; then
                    affected_packages="$affected_packages $matched_package "
                fi
            fi
        fi
        
    done <<< "$changed_files"
    
    # Clean up the packages list
    affected_packages=$(echo "$affected_packages" | tr ' ' '\n' | grep -v '^$' | sort | uniq | tr '\n' ' ')
    
    echo "$affected_packages"
    return 0
}

# Function to get dependent packages
get_dependent_packages() {
    local target_package="$1"
    print_debug "Getting dependents of package: $target_package"
    
    # Get dependency graph
    local metadata
    metadata=$(cargo metadata --format-version 1 --no-deps 2>/dev/null) || {
        print_debug "  Failed to get metadata for dependencies"
        return 0
    }
    
    # Find packages that depend on the target package
    local dependents=""
    if [[ -n "$target_package" ]]; then
        dependents=$(echo "$metadata" | jq -r ".packages[] | select(.source == null and (.dependencies[]?.name == \"$target_package\")) | .name" 2>/dev/null | sort | uniq | tr '\n' ' ')
    fi
    
    print_debug "  Found dependents: ${dependents:-none}"
    echo "$dependents"
}

# Function to run tests for specific packages
run_tests_for_packages() {
    local packages="$1"
    local test_count=0
    local failed_packages=""
    local tested_packages=""  # Track already tested packages
    
    print_status "Running tests for affected packages..."
    
    # Convert space-separated string to array for easier processing
    local packages_array=($packages)
    
    # Test each affected package
    for package_name in "${packages_array[@]}"; do
        if [[ -z "$package_name" ]]; then
            continue
        fi
        
        # Skip if already tested
        if [[ "$tested_packages" == *" $package_name "* ]]; then
            print_debug "Skipping $package_name (already tested)"
            continue
        fi
        
        print_status "Testing package: $package_name"
        ((test_count++))
        
        # Run unit tests for the specific package with better error handling
        local test_output
        test_output=$(mktemp)
        
        print_debug "Running: cargo test --lib --package \"$package_name\" --quiet"
        
        if timeout 300 cargo test --lib --package "$package_name" --quiet 2>&1 | tee "$test_output"; then
            print_success "Tests passed for package: $package_name"
            tested_packages="$tested_packages $package_name "
        else
            local exit_code=$?
            print_error "Tests failed for package: $package_name (exit code: $exit_code)"
            
            # Show relevant error output
            if [[ -s "$test_output" ]]; then
                print_error "Test output (last 30 lines):"
                tail -30 "$test_output" | sed 's/^/  /'
            fi
            
            failed_packages="$failed_packages $package_name"
        fi
        
        rm -f "$test_output"
        
        # Also run tests for dependent packages (but be selective to avoid infinite loops)
        local dependents
        dependents=$(get_dependent_packages "$package_name")
        
        if [[ -n "$dependents" ]]; then
            print_status "Running tests for packages that depend on $package_name..."
            
            local dependents_array=($dependents)
            for dependent in "${dependents_array[@]}"; do
                if [[ -n "$dependent" ]] && [[ "$tested_packages" != *" $dependent "* ]]; then
                    print_status "Testing dependent package: $dependent"
                    ((test_count++))
                    
                    local dep_test_output
                    dep_test_output=$(mktemp)
                    
                    print_debug "Running: cargo test --lib --package \"$dependent\" --quiet"
                    
                    if timeout 300 cargo test --lib --package "$dependent" --quiet 2>&1 | tee "$dep_test_output"; then
                        print_success "Tests passed for dependent package: $dependent"
                        tested_packages="$tested_packages $dependent "
                    else
                        local dep_exit_code=$?
                        print_error "Tests failed for dependent package: $dependent (exit code: $dep_exit_code)"
                        
                        if [[ -s "$dep_test_output" ]]; then
                            print_error "Test output (last 30 lines):"
                            tail -30 "$dep_test_output" | sed 's/^/  /'
                        fi
                        
                        failed_packages="$failed_packages $dependent"
                    fi
                    
                    rm -f "$dep_test_output"
                fi
            done
        fi
        
    done
    
    # Report results
    if [[ -n "$failed_packages" ]]; then
        print_error ""
        print_error "=== TEST FAILURES SUMMARY ==="
        print_error "Tests failed for the following packages:"
        echo "$failed_packages" | tr ' ' '\n' | grep -v '^$' | sort | uniq | sed 's/^/  - /'
        print_error ""
        print_error "To debug individual failures, run:"
        echo "$failed_packages" | tr ' ' '\n' | grep -v '^$' | sort | uniq | sed 's/^/  cargo test --lib --package /' | sed 's/$/ --verbose/'
        return 1
    fi
    
    print_success "All tests passed! ($test_count test suites executed)"
    return 0
}

# Function to run all tests with comprehensive error handling
run_all_tests() {
    print_status "Running all unit tests..."
    
    local test_output
    test_output=$(mktemp)
    
    print_debug "Running: cargo test --lib --workspace --quiet"
    
    if timeout 600 cargo test --lib --workspace --quiet 2>&1 | tee "$test_output"; then
        print_success "All unit tests passed!"
        rm -f "$test_output"
        return 0
    else
        local exit_code=$?
        print_error "Some tests failed! (exit code: $exit_code)"
        
        if [[ -s "$test_output" ]]; then
            print_error ""
            print_error "=== TEST FAILURE SUMMARY ==="
            # Try to extract failed test information
            if grep -q "test result:" "$test_output"; then
                grep "test result:" "$test_output" | tail -5 | sed 's/^/  /'
            fi
            
            # Show the last chunk of output which usually contains useful info
            print_error "Last 50 lines of test output:"
            tail -50 "$test_output" | sed 's/^/  /'
        fi
        
        print_error ""
        print_error "To debug, run: cargo test --lib --workspace --verbose"
        rm -f "$test_output"
        return 1
    fi
}

# Function to run smoke test
run_smoke_test() {
    print_status "Running compilation and smoke test..."
    
    local check_output
    check_output=$(mktemp)
    
    print_debug "Running: cargo check --workspace --quiet"
    
    if cargo check --workspace --quiet 2>&1 | tee "$check_output"; then
        print_success "Compilation check passed!"
        
        # Also test critical packages
        print_status "Testing critical shared packages..."
        local critical_packages="common auth_clerk"
        
        if run_tests_for_packages "$critical_packages"; then
            print_success "Smoke test completed successfully!"
            rm -f "$check_output"
            return 0
        else
            print_error "Critical package tests failed!"
            rm -f "$check_output"
            return 1
        fi
    else
        local exit_code=$?
        print_error "Compilation check failed! (exit code: $exit_code)"
        
        if [[ -s "$check_output" ]]; then
            print_error "Compilation errors:"
            cat "$check_output" | sed 's/^/  /'
        fi
        
        rm -f "$check_output"
        return 1
    fi
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

print_status "Validating environment..."
validate_prerequisites

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
    print_status "Running smoke test..."
    run_smoke_test
    exit $?
fi

print_status "Changed files ($(echo "$changed_files" | wc -l)):"
echo "$changed_files" | head -10 | sed 's/^/  - /'
if [[ $(echo "$changed_files" | wc -l) -gt 10 ]]; then
    print_status "  ... and $(($(echo "$changed_files" | wc -l) - 10)) more files"
fi

# Get affected packages
print_status "Analyzing impact of changes..."
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

# Clean up the packages list and show what we're testing
affected_packages=$(echo "$affected_packages" | tr ' ' '\n' | grep -v '^$' | sort | uniq | tr '\n' ' ')
print_status "Affected packages ($(echo "$affected_packages" | wc -w)):"
echo "$affected_packages" | tr ' ' '\n' | sed 's/^/  - /'

# Run tests for affected packages
run_tests_for_packages "$affected_packages"
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
    print_success "✅ Smart test execution completed successfully!"
    print_status "Tested only affected components, saving time while maintaining safety."
else
    print_error "❌ Smart test execution failed!"
    print_error "Consider running 'cargo test --lib --workspace --verbose' for detailed output."
fi

exit $exit_code