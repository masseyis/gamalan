# Testing Infrastructure for Consolidated API Gateway

## Overview

This document describes the comprehensive testing infrastructure designed for our consolidated API Gateway deployment. All services (projects, backlog, readiness, prompt-builder, context-orchestrator) now run through a single unified gateway, requiring updated testing strategies.

## Architecture Changes

### Before: Individual Service Testing
- Each service deployed separately
- Independent test suites
- Service-specific databases
- Individual health checks

### After: Consolidated Gateway Testing
- Single binary deployment (api-gateway)
- Unified test infrastructure
- Shared database resources
- Cross-service integration validation

## Testing Strategy

### 1. Test Pyramid for Consolidated Services

```
    E2E Tests (Web + API)
    ────────────────────
   Contract Tests (OpenAPI)
   ─────────────────────────
  Integration Tests (Gateway)
  ──────────────────────────────
Unit Tests (Domain + Application)
──────────────────────────────────
```

#### Unit Tests (Base Layer)
- **Location**: `services/*/tests/unit/`
- **Target**: Domain logic, business rules
- **Coverage**: ≥85% for all domain/application layers
- **Isolation**: No I/O, no async, pure functions

#### Integration Tests (Middle Layer)
- **Location**: `services/api-gateway/tests/integration/`
- **Target**: HTTP handlers, database interactions, service boundaries
- **Coverage**: All API endpoints through gateway
- **Database**: Shared PostgreSQL instance

#### Contract Tests (API Layer)
- **Location**: `services/api-gateway/tests/contract/`
- **Target**: OpenAPI compliance, schema validation
- **Coverage**: All service endpoints through gateway paths
- **Validation**: Request/response schemas, HTTP status codes

#### End-to-End Tests (Top Layer)
- **Location**: `apps/web/tests/e2e/`
- **Target**: Critical user journeys
- **Coverage**: Complete workflows through web interface

## Test Infrastructure Components

### 1. Docker Compose Test Environment

**File**: `docker-compose.test.yml`

```yaml
services:
  postgres:          # Shared database for all services
  mock-clerk:        # Authentication mock
  api-gateway-test:  # Unified gateway for testing
  test-runner:       # Container for running tests
```

### 2. Test Dockerfiles

#### `Dockerfile.test`
- Builds unified API Gateway for testing
- Includes all service migrations
- Health check endpoints

#### `Dockerfile.test-runner`
- Test execution environment
- Coverage tools (cargo-tarpaulin)
- Database utilities (sqlx-cli)

### 3. Updated Makefile Targets

```makefile
# Consolidated Gateway Testing
test-gateway-full:         # Complete test suite
test-gateway-unit:         # Unit tests only
test-gateway-integration:  # Integration tests
test-gateway-contract:     # Contract validation
test-gateway-performance:  # Load/performance tests
test-cross-service:        # Service interaction tests

# Quality Gates
check-pr:                  # PR validation
quality-gate:              # Coverage + security
coverage:                  # Test coverage analysis
```

## Service Endpoints Through Gateway

### Unified Routing Structure

```
/health                                    # Gateway health
/ready                                     # Gateway readiness
/auth/*                                    # Authentication service
/api/v1/projects/*                         # Project management
/api/v1/backlog/*                          # Story/task management
/api/v1/readiness/*                        # Story readiness validation
/api/v1/prompt-builder/*                   # AI prompt generation
/api/v1/context/*                          # Context orchestration
```

### Health Check Endpoints

All services accessible through gateway:
- `/api/v1/projects/health`
- `/api/v1/backlog/health`
- `/api/v1/readiness/health`
- `/api/v1/prompt-builder/health`
- `/api/v1/context/health`

## Running Tests

### Quick Start

```bash
# Run all tests for consolidated gateway
make test-gateway-full

# Run specific test types
make test-gateway-unit
make test-gateway-integration  
make test-gateway-contract
make test-cross-service
```

### Manual Test Execution

```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d postgres mock-clerk

# Set environment variables
export TEST_DATABASE_URL="postgres://testuser:testpass123@localhost:5433/gamalan_test"
export GATEWAY_BASE_URL="http://localhost:8000"

# Run tests
cargo test --workspace --test integration
cargo test --workspace --test contract

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### Test Validation Script

```bash
# Comprehensive infrastructure validation
./scripts/test-gateway-consolidation.sh
```

## Test Categories

### 1. Gateway Integration Tests

**File**: `services/api-gateway/tests/integration/test_gateway.rs`

- ✅ Health check endpoints
- ✅ Service routing validation
- ✅ CORS handling
- ✅ Error responses
- ✅ Cross-service workflows
- ✅ Concurrent request handling
- ✅ Database sharing validation
- ✅ Performance benchmarking

### 2. Contract Compliance Tests

**File**: `services/api-gateway/tests/contract/test_unified_gateway_compliance.rs`

- ✅ OpenAPI specification compliance
- ✅ Path prefix validation
- ✅ HTTP status code compliance
- ✅ Content-Type handling
- ✅ Error schema validation
- ✅ UUID parameter validation
- ✅ Request size limits
- ✅ Security headers

### 3. Cross-Service Integration Tests

- ✅ Project → Backlog workflows
- ✅ Backlog → Readiness validation
- ✅ Backlog → Prompt Builder integration
- ✅ Context Orchestrator interactions
- ✅ Authentication flow across services

### 4. Performance and Load Tests

- ✅ Response time validation (<500ms for API calls)
- ✅ Concurrent request handling (50+ simultaneous)
- ✅ Database connection pooling
- ✅ Memory usage under load
- ✅ Service isolation verification

## Quality Gates

### Coverage Requirements
- **Minimum**: 85% code coverage
- **Target**: 90%+ for critical paths
- **Validation**: Automated in CI/CD pipeline

### Performance Requirements
- **Health checks**: <100ms response time
- **API endpoints**: <500ms response time
- **Concurrent users**: Support 50+ simultaneous
- **Database queries**: <200ms average

### Security Requirements
- **Authentication**: JWT validation on protected endpoints
- **Authorization**: Role-based access control
- **Headers**: Security headers present
- **Input validation**: All inputs sanitized

## CI/CD Integration

### GitHub Actions Integration

```yaml
name: Test Consolidated Gateway
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
      - name: Run PR Checks
        run: make check-pr
      - name: Quality Gate
        run: make quality-gate
```

### Pre-commit Hooks

```bash
# Install pre-commit hook
echo "make pre-push" > .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

## Monitoring and Observability

### Test Metrics Tracked
- ✅ Test execution time
- ✅ Coverage percentage
- ✅ Success/failure rates
- ✅ Performance benchmarks
- ✅ Error patterns

### Logging in Tests
- Structured logging with correlation IDs
- Test-specific log levels
- Performance timing logs
- Error context preservation

## Troubleshooting

### Common Issues

#### Database Connection Failures
```bash
# Check PostgreSQL status
docker-compose -f docker-compose.test.yml ps postgres

# View database logs
docker-compose -f docker-compose.test.yml logs postgres

# Reset database
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d postgres
```

#### Test Infrastructure Startup Issues
```bash
# Check all services
docker-compose -f docker-compose.test.yml ps

# View service logs
docker-compose -f docker-compose.test.yml logs api-gateway-test

# Rebuild containers
docker-compose -f docker-compose.test.yml up -d --build
```

#### Port Conflicts
```bash
# Check port usage
lsof -i :5433  # PostgreSQL test port
lsof -i :8000  # Gateway test port
lsof -i :8081  # Mock Clerk port
```

### Test Environment Variables

```bash
# Required for integration tests
TEST_DATABASE_URL="postgres://testuser:testpass123@localhost:5433/gamalan_test"
GATEWAY_BASE_URL="http://localhost:8000"
MOCK_CLERK_URL="http://localhost:8081"

# Optional feature flags
FEATURE_FLAG_ENABLE_AI_FEATURES="true"
FEATURE_FLAG_ENABLE_CONTEXT_ORCHESTRATOR="true"
RUST_LOG="debug"
```

## Migration from Individual Service Tests

### Steps to Update Existing Tests

1. **Update test imports**: Change from individual service clients to gateway endpoints
2. **Modify URLs**: Add appropriate path prefixes (`/api/v1/service`)
3. **Shared database**: Update connection strings to use shared test database
4. **Authentication**: Update JWT mocks to work with unified verifier
5. **Health checks**: Update to use gateway health endpoints

### Backward Compatibility

During transition period:
- ✅ Both individual and gateway tests can run
- ✅ Gradual migration of test suites
- ✅ Feature flags for new vs old behavior
- ✅ Comprehensive validation before switch

## Future Enhancements

### Planned Improvements
- 🔄 Property-based testing with `proptest`
- 🔄 Chaos engineering tests
- 🔄 Multi-region deployment testing  
- 🔄 Advanced performance profiling
- 🔄 Security penetration testing

### Scalability Considerations
- Load balancer testing
- Database replication validation
- Cache layer testing
- CDN integration tests

## Resources

- [CLAUDE.md](../CLAUDE.md) - Architecture guidelines
- [ADR-0001](adr/ADR-0001-architecture.md) - Architecture decision record
- [OpenAPI Specifications](../services/*/docs/openapi.yaml)
- [Test Coverage Reports](../target/tarpaulin/tarpaulin-report.html)