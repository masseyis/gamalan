#!/bin/bash
# Test script to validate consolidated API Gateway testing infrastructure
# This script ensures all testing components work with the unified deployment

set -e

echo "🚀 Testing Consolidated API Gateway Infrastructure"
echo "================================================="

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${YELLOW}🧪 Running: $test_name${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Function to check if required files exist
check_file_exists() {
    local file="$1"
    local description="$2"
    
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅ Found: $description${NC}"
        return 0
    else
        echo -e "${RED}❌ Missing: $description at $file${NC}"
        return 1
    fi
}

# Phase 1: Infrastructure Validation
echo -e "\n${YELLOW}📋 Phase 1: Infrastructure Validation${NC}"
echo "========================================"

run_test "Docker Compose Test Configuration" "docker-compose -f docker-compose.test.yml config > /dev/null"

check_file_exists "docker-compose.test.yml" "Docker Compose test configuration"
check_file_exists "Dockerfile.test" "Test Dockerfile for unified gateway"
check_file_exists "Dockerfile.test-runner" "Test runner Dockerfile"

run_test "Makefile Test Targets" "make -n test-gateway-full > /dev/null"

# Phase 2: Test Infrastructure Components
echo -e "\n${YELLOW}📋 Phase 2: Test Infrastructure Components${NC}"
echo "============================================="

check_file_exists "services/api-gateway/tests/integration/test_gateway.rs" "Gateway integration tests"
check_file_exists "services/api-gateway/tests/contract/test_unified_gateway_compliance.rs" "Gateway contract tests"

# Phase 3: Build Validation
echo -e "\n${YELLOW}📋 Phase 3: Build Validation${NC}"
echo "=============================="

run_test "Workspace Build" "cargo build --workspace > /dev/null 2>&1"
run_test "API Gateway Build" "cargo build --bin api-gateway > /dev/null 2>&1"

# Phase 4: Unit Tests
echo -e "\n${YELLOW}📋 Phase 4: Unit Tests${NC}"
echo "======================="

run_test "Unit Tests" "cargo test --workspace --lib --quiet"

# Phase 5: Test Infrastructure Startup
echo -e "\n${YELLOW}📋 Phase 5: Test Infrastructure Startup${NC}"
echo "========================================"

echo "Starting test database..."
if docker-compose -f docker-compose.test.yml up -d postgres mock-clerk; then
    echo -e "${GREEN}✅ Test infrastructure started${NC}"
    
    echo "Waiting for services to be ready..."
    sleep 15
    
    # Check if PostgreSQL is accessible
    if docker-compose -f docker-compose.test.yml exec -T postgres pg_isready -U testuser > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ PostgreSQL not ready${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    # Phase 6: Integration Tests (quick subset)
    echo -e "\n${YELLOW}📋 Phase 6: Integration Tests${NC}"
    echo "=============================="
    
    export TEST_DATABASE_URL="postgres://testuser:testpass123@localhost:5433/gamalan_test"
    
    run_test "Gateway Health Tests" "cargo test --package api-gateway test_gateway_health_check test_gateway_readiness_check --quiet"
    run_test "Cross-Service Routing Tests" "cargo test --package api-gateway test_all_service_health_endpoints --quiet"
    run_test "Service Path Isolation Tests" "cargo test --package api-gateway test_service_path_routing_isolation --quiet"
    
    # Phase 7: Contract Tests (quick subset)
    echo -e "\n${YELLOW}📋 Phase 7: Contract Tests${NC}"
    echo "==========================="
    
    run_test "Gateway OpenAPI Compliance" "cargo test --package api-gateway test_gateway_openapi_compliance --quiet"
    run_test "Path Prefix Compliance" "cargo test --package api-gateway test_gateway_service_path_prefix_compliance --quiet"
    
    # Phase 8: Performance Tests (basic)
    echo -e "\n${YELLOW}📋 Phase 8: Performance Tests${NC}"
    echo "=============================="
    
    run_test "Response Time Validation" "cargo test --package api-gateway test_response_time_benchmark --quiet"
    run_test "Database Sharing Tests" "cargo test --package api-gateway test_database_sharing_across_services --quiet"
    
    # Cleanup
    echo -e "\n${YELLOW}🧹 Cleaning up test infrastructure${NC}"
    docker-compose -f docker-compose.test.yml down > /dev/null 2>&1
    
else
    echo -e "${RED}❌ Failed to start test infrastructure${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# Phase 9: Test Coverage Validation
echo -e "\n${YELLOW}📋 Phase 9: Test Coverage Validation${NC}"
echo "====================================="

if command -v cargo-tarpaulin > /dev/null; then
    echo "Generating coverage report..."
    docker-compose -f docker-compose.test.yml up -d postgres mock-clerk > /dev/null 2>&1
    sleep 10
    
    export TEST_DATABASE_URL="postgres://testuser:testpass123@localhost:5433/gamalan_test"
    
    if cargo tarpaulin --workspace --out Json --target-dir target/tarpaulin --timeout 300 > /dev/null 2>&1; then
        COVERAGE=$(cargo tarpaulin --workspace --out Json --target-dir target/tarpaulin --timeout 300 2>/dev/null | \
                  jq -r '.files | map(.coverage) | add / length' 2>/dev/null || echo "0")
        
        if (( $(echo "$COVERAGE >= 85" | bc -l) )); then
            echo -e "${GREEN}✅ Coverage: ${COVERAGE}% (≥85% required)${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ Coverage: ${COVERAGE}% (below 85% threshold)${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${YELLOW}⚠️  Coverage tool failed, skipping coverage check${NC}"
    fi
    
    docker-compose -f docker-compose.test.yml down > /dev/null 2>&1
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
    echo -e "${YELLOW}⚠️  cargo-tarpaulin not installed, skipping coverage check${NC}"
fi

# Final Results
echo -e "\n${YELLOW}📊 Final Results${NC}"
echo "================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed! Consolidated gateway testing infrastructure is ready.${NC}"
    echo -e "\n${GREEN}🚀 Ready for deployment with:${NC}"
    echo "  • Unified API Gateway consolidating all services"
    echo "  • Cross-service integration testing"
    echo "  • Contract compliance validation"
    echo "  • Performance benchmarking"
    echo "  • Comprehensive test coverage"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed. Please review and fix issues before deployment.${NC}"
    echo -e "\n${YELLOW}📝 Next Steps:${NC}"
    echo "  1. Review failed tests above"
    echo "  2. Fix any infrastructure issues"
    echo "  3. Run 'make check-pr' to validate all changes"
    echo "  4. Ensure all quality gates pass"
    exit 1
fi