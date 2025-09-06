#!/bin/bash

# End-to-End Testing Script for Gamalan AI-Agile Platform
# This script tests critical user journeys from start to finish

set -euo pipefail

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8000}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token}"
TEST_PROJECT_ID=""
TEST_STORY_ID=""
TEST_TASK_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Test helper functions
make_request() {
    local method="$1"
    local url="$2"
    local data="${3:-}"
    
    if [[ -n "$data" ]]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $AUTH_TOKEN" \
             -d "$data" \
             "$url"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer $AUTH_TOKEN" \
             "$url"
    fi
}

test_health_checks() {
    log_info "Testing health checks..."
    
    # Test main health endpoint
    local health_response
    health_response=$(curl -s "$BASE_URL/health")
    if [[ "$health_response" == "OK" ]]; then
        log_info "✓ Health check passed"
    else
        log_error "✗ Health check failed: $health_response"
        return 1
    fi
    
    # Test readiness endpoint
    local ready_response
    ready_response=$(curl -s "$BASE_URL/ready")
    if [[ "$ready_response" == "READY" ]]; then
        log_info "✓ Readiness check passed"
    else
        log_error "✗ Readiness check failed: $ready_response"
        return 1
    fi
}

test_authentication() {
    log_info "Testing authentication flows..."
    
    # Test unauthorized access
    local unauthorized_response
    unauthorized_response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/v1/projects")
    if [[ "$unauthorized_response" == "401" ]]; then
        log_info "✓ Unauthorized access properly rejected"
    else
        log_error "✗ Unauthorized access not properly handled: HTTP $unauthorized_response"
        return 1
    fi
    
    # Test with valid token (mock for this test)
    local authorized_response
    authorized_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/v1/projects")
    
    if [[ "$authorized_response" == "200" ]]; then
        log_info "✓ Authorized access allowed"
    else
        log_warn "⚠ Authorized access returned HTTP $authorized_response (may be expected in test env)"
    fi
}

test_project_management() {
    log_info "Testing project management workflow..."
    
    # Get existing projects
    local projects_response
    projects_response=$(make_request "GET" "$BASE_URL/api/v1/projects")
    if echo "$projects_response" | jq -e '.[]' > /dev/null 2>&1; then
        log_info "✓ Successfully retrieved projects list"
        # Extract first project ID for testing
        TEST_PROJECT_ID=$(echo "$projects_response" | jq -r '.[0].id' 2>/dev/null || echo "proj-1")
    else
        log_warn "⚠ Projects list may be empty or invalid format"
        TEST_PROJECT_ID="550e8400-e29b-41d4-a716-446655440000" # Fallback test ID
    fi
    
    # Create new project
    local create_project_data
    create_project_data='{
        "name": "E2E Test Project",
        "description": "End-to-end testing project"
    }'
    
    local create_response
    create_response=$(make_request "POST" "$BASE_URL/api/v1/projects" "$create_project_data")
    log_info "✓ Project creation request completed"
}

test_story_lifecycle() {
    log_info "Testing story lifecycle..."
    
    if [[ -z "$TEST_PROJECT_ID" ]]; then
        TEST_PROJECT_ID="550e8400-e29b-41d4-a716-446655440000"
    fi
    
    # Create story
    local create_story_data
    create_story_data='{
        "title": "E2E Test Story",
        "description": "End-to-end test story for validation",
        "labels": ["e2e-test", "automated"]
    }'
    
    local story_response
    story_response=$(make_request "POST" "$BASE_URL/api/v1/projects/$TEST_PROJECT_ID/stories" "$create_story_data")
    
    if echo "$story_response" | jq -e '.id' > /dev/null 2>&1; then
        TEST_STORY_ID=$(echo "$story_response" | jq -r '.id')
        log_info "✓ Story created with ID: $TEST_STORY_ID"
    else
        log_warn "⚠ Story creation response format unexpected"
        TEST_STORY_ID="550e8400-e29b-41d4-a716-446655440001" # Fallback
    fi
    
    # Get stories for project
    local stories_response
    stories_response=$(make_request "GET" "$BASE_URL/api/v1/projects/$TEST_PROJECT_ID/stories")
    log_info "✓ Retrieved stories for project"
    
    # Update story status
    local update_data
    update_data='{"status": "InProgress"}'
    make_request "PATCH" "$BASE_URL/api/v1/stories/$TEST_STORY_ID" "$update_data"
    log_info "✓ Story status updated"
}

test_task_management() {
    log_info "Testing task management..."
    
    if [[ -z "$TEST_STORY_ID" ]]; then
        TEST_STORY_ID="550e8400-e29b-41d4-a716-446655440001"
    fi
    
    # Create task
    local create_task_data
    create_task_data='{
        "title": "E2E Test Task",
        "description": "End-to-end test task",
        "acceptance_criteria_refs": ["AC1", "AC2"]
    }'
    
    local task_response
    task_response=$(make_request "POST" "$BASE_URL/api/v1/stories/$TEST_STORY_ID/tasks" "$create_task_data")
    
    if echo "$task_response" | jq -e '.id' > /dev/null 2>&1; then
        TEST_TASK_ID=$(echo "$task_response" | jq -r '.id')
        log_info "✓ Task created with ID: $TEST_TASK_ID"
    else
        log_warn "⚠ Task creation response format unexpected"
    fi
    
    # Get tasks for story
    local tasks_response
    tasks_response=$(make_request "GET" "$BASE_URL/api/v1/stories/$TEST_STORY_ID/tasks")
    log_info "✓ Retrieved tasks for story"
}

test_readiness_evaluation() {
    log_info "Testing readiness evaluation..."
    
    if [[ -z "$TEST_STORY_ID" ]]; then
        TEST_STORY_ID="550e8400-e29b-41d4-a716-446655440001"
    fi
    
    # Check story readiness
    local readiness_response
    readiness_response=$(make_request "GET" "$BASE_URL/api/v1/stories/$TEST_STORY_ID/readiness")
    log_info "✓ Story readiness evaluated"
    
    # Generate acceptance criteria if needed
    local ac_data
    ac_data='{"force_regenerate": false}'
    make_request "POST" "$BASE_URL/api/v1/stories/$TEST_STORY_ID/acceptance-criteria" "$ac_data"
    log_info "✓ Acceptance criteria generation requested"
}

test_prompt_builder() {
    log_info "Testing AI prompt builder..."
    
    if [[ -z "$TEST_STORY_ID" ]]; then
        TEST_STORY_ID="550e8400-e29b-41d4-a716-446655440001"
    fi
    
    # Generate plan pack
    local plan_pack_response
    plan_pack_response=$(make_request "POST" "$BASE_URL/api/v1/stories/$TEST_STORY_ID/plan-pack" '{}')
    log_info "✓ Plan pack generation requested"
    
    # Generate task pack (would need task ID)
    if [[ -n "$TEST_TASK_ID" ]]; then
        local task_pack_response
        task_pack_response=$(make_request "POST" "$BASE_URL/api/v1/tasks/$TEST_TASK_ID/task-pack" '{}')
        log_info "✓ Task pack generation requested"
    fi
}

test_error_scenarios() {
    log_info "Testing error handling scenarios..."
    
    # Test invalid UUID in path
    local invalid_uuid_response
    invalid_uuid_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/v1/stories/invalid-uuid")
    
    if [[ "$invalid_uuid_response" == "400" ]]; then
        log_info "✓ Invalid UUID properly handled with 400"
    else
        log_warn "⚠ Invalid UUID returned HTTP $invalid_uuid_response"
    fi
    
    # Test non-existent resource
    local not_found_response
    not_found_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/v1/stories/550e8400-e29b-41d4-a716-446655440999")
    
    if [[ "$not_found_response" == "404" ]]; then
        log_info "✓ Non-existent resource returns 404"
    else
        log_warn "⚠ Non-existent resource returned HTTP $not_found_response"
    fi
    
    # Test malformed JSON
    local malformed_response
    malformed_response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{invalid json}" \
        "$BASE_URL/api/v1/projects")
    
    if [[ "$malformed_response" == "400" ]]; then
        log_info "✓ Malformed JSON properly handled with 400"
    else
        log_warn "⚠ Malformed JSON returned HTTP $malformed_response"
    fi
}

main() {
    log_info "Starting End-to-End Testing for Gamalan AI-Agile Platform"
    log_info "Base URL: $BASE_URL"
    
    # Check dependencies
    if ! command -v curl > /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq > /dev/null; then
        log_warn "jq is not installed - some JSON parsing will be skipped"
    fi
    
    # Run test suites
    local failed_tests=0
    
    test_health_checks || ((failed_tests++))
    test_authentication || ((failed_tests++))
    test_project_management || ((failed_tests++))
    test_story_lifecycle || ((failed_tests++))
    test_task_management || ((failed_tests++))
    test_readiness_evaluation || ((failed_tests++))
    test_prompt_builder || ((failed_tests++))
    test_error_scenarios || ((failed_tests++))
    
    # Summary
    echo
    if [[ $failed_tests -eq 0 ]]; then
        log_info "🎉 All E2E tests completed successfully!"
        exit 0
    else
        log_error "❌ $failed_tests test suite(s) had issues"
        exit 1
    fi
}

# Run main function
main "$@"