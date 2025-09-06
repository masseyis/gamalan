.PHONY: fmt lint build test test-unit test-int test-contract test-e2e coverage \
		dev-up dev-down migrate deploy-all deploy-staging deploy-prod \
		check-pr pre-push quality-gate canary-deploy rollback \
		deploy-prompt-builder deploy-context-orchestrator install-hook \
		install-hooks smart-test test-smart test-changed setup-dev

fmt:
	@echo "Running rustfmt..."
	cargo fmt --all

lint:
	@echo "Running clippy..."
	cargo clippy --all-targets --all-features -- -D warnings

build:
	@echo "Building all crates..."
	cargo build --workspace

test:
	@echo "Running all tests..."
	cargo test --workspace

test-unit:
	@echo "Running unit tests..."
	cargo test --workspace --lib

test-int:
	@echo "Running integration tests with consolidated API Gateway..."
	@echo "Starting test infrastructure (PostgreSQL + Mock services)..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	@echo "Waiting for test infrastructure to be ready..."
	sleep 10
	@echo "Running integration tests against unified gateway..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo test --workspace --test '*integration*' -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

test-contract:
	@echo "Running API contract tests for unified gateway..."
	@echo "Starting test infrastructure..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	@echo "Waiting for test infrastructure to be ready..."
	sleep 10
	@echo "Running contract tests..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo test --workspace --test '*contract*' -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

test-e2e:
	@echo "Running end-to-end tests..."
	cd apps/web && pnpm test:e2e

# ==============================================================================
# CONSOLIDATED GATEWAY TESTING
# ==============================================================================

test-gateway-full:
	@echo "Running comprehensive gateway tests..."
	@echo "Starting full test infrastructure..."
	docker-compose -f docker-compose.test.yml up -d --build
	@echo "Waiting for services to be ready..."
	sleep 30
	@echo "Running all test suites against unified gateway..."
	docker-compose -f docker-compose.test.yml run --rm test-runner
	docker-compose -f docker-compose.test.yml down

test-gateway-unit:
	@echo "Running unit tests for gateway consolidation..."
	cargo test --workspace --lib -- --test-threads=1

test-gateway-integration:
	@echo "Running integration tests against consolidated gateway..."
	@echo "Starting test infrastructure..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	GATEWAY_BASE_URL=http://localhost:8000 \
	cargo test --workspace --test integration -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

test-gateway-contract:
	@echo "Running contract tests for consolidated gateway..."
	@echo "Starting test infrastructure..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	GATEWAY_BASE_URL=http://localhost:8000 \
	cargo test --workspace --test contract -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

test-gateway-performance:
	@echo "Running performance tests for consolidated gateway..."
	@echo "Starting test infrastructure..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	@echo "Running load tests..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	GATEWAY_BASE_URL=http://localhost:8000 \
	cargo test --workspace test_gateway_performance_under_load test_concurrent_cross_service_requests -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

test-cross-service:
	@echo "Running cross-service integration tests..."
	@echo "Testing service interactions through unified gateway..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	GATEWAY_BASE_URL=http://localhost:8000 \
	cargo test --workspace test_cross_service -- --test-threads=1
	docker-compose -f docker-compose.test.yml down

coverage:
	@echo "Generating test coverage report for consolidated gateway..."
	cargo install --version 0.13.3 cargo-tarpaulin || true
	@echo "Starting test infrastructure for coverage analysis..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	@echo "Running coverage analysis..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo tarpaulin --workspace --out Html --target-dir target/tarpaulin --exclude-files 'target/*' --timeout 300
	docker-compose -f docker-compose.test.yml down

coverage-gateway:
	@echo "Generating gateway-specific coverage report..."
	cargo install --version 0.13.3 cargo-tarpaulin || true
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo tarpaulin --workspace --packages api-gateway --out Html --target-dir target/tarpaulin-gateway
	docker-compose -f docker-compose.test.yml down

dev-up:
	@echo "Starting local development environment..."
	docker-compose up -d

dev-down:
	@echo "Stopping local development environment..."
	docker-compose down

migrate:
	@echo "Running database migrations for consolidated API Gateway..."
	cargo install sqlx-cli --no-default-features --features "postgres,uuid,tls-rustls"
	@echo "All services use single database through api-gateway"
	# Run all migrations in sequence against single database
	sqlx migrate run --source services/projects/migrations --database-url $$DATABASE_URL
	sqlx migrate run --source services/backlog/migrations --database-url $$DATABASE_URL
	sqlx migrate run --source services/readiness/migrations --database-url $$DATABASE_URL
	sqlx migrate run --source services/prompt-builder/migrations --database-url $$DATABASE_URL

deploy-all:
	@echo "Deploying consolidated API Gateway to Shuttle..."
	@echo "Single deployment contains: projects, backlog, readiness, prompt-builder, context-orchestrator"
	cargo install cargo-shuttle --locked
	cargo shuttle deploy -p services/api-gateway

deploy-prompt-builder:
	@echo "Deploying prompt-builder service to Shuttle..."
	cargo install cargo-shuttle --locked
	cargo shuttle deploy -p services/prompt-builder

deploy-context-orchestrator:
	@echo "Deploying context-orchestrator service to Shuttle..."
	cargo install cargo-shuttle --locked
	cargo shuttle deploy -p services/context-orchestrator

# ==============================================================================
# CI/CD PIPELINE COMMANDS
# ==============================================================================

check-pr:
	@echo "Running PR validation checks for consolidated gateway..."
	@echo "1. Format check..."
	cargo fmt --all --check
	@echo "2. Lint check..."
	cargo clippy --all-targets --all-features -- -D warnings
	@echo "3. Build check..."
	cargo build --workspace
	@echo "4. Unit tests..."
	$(MAKE) test-unit
	@echo "5. Gateway integration tests..."
	$(MAKE) test-gateway-integration
	@echo "6. Gateway contract tests..."
	$(MAKE) test-gateway-contract
	@echo "7. Cross-service tests..."
	$(MAKE) test-cross-service
	@echo "8. Coverage check..."
	$(MAKE) coverage
	@echo "✅ All PR checks passed for consolidated gateway!"

pre-push:
	@echo "Running pre-push hooks..."
	$(MAKE) check-pr
	@echo "✅ Ready to push!"

quality-gate:
	@echo "Running quality gate checks for consolidated gateway..."
	@echo "Starting test infrastructure for quality validation..."
	docker-compose -f docker-compose.test.yml up -d postgres mock-clerk
	sleep 10
	@echo "Checking code coverage threshold (85%)..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo tarpaulin --workspace --out Json --target-dir target/tarpaulin --timeout 300 | \
		jq -r '.files | map(.coverage) | add / length' | \
		awk '{ if ($$1 < 85.0) { print "❌ Coverage below 85%: " $$1 "%"; exit 1 } else { print "✅ Coverage: " $$1 "%" } }'
	@echo "Checking for security vulnerabilities..."
	cargo audit || (echo "❌ Security vulnerabilities found!" && exit 1)
	@echo "Running performance quality checks..."
	TEST_DATABASE_URL=postgres://testuser:testpass123@localhost:5433/gamalan_test \
	cargo test --workspace test_response_time_benchmark test_gateway_performance_under_load -- --test-threads=1
	docker-compose -f docker-compose.test.yml down
	@echo "✅ Quality gate passed for consolidated gateway!"

deploy-staging:
	@echo "Deploying consolidated API Gateway to staging environment..."
	@echo "Building consolidated API Gateway (contains all services)..."
	cargo build --release --package api-gateway
	@echo "Deploying consolidated backend to Shuttle..."
	cargo shuttle deploy -p services/api-gateway --name salunga-ai-staging
	@echo "Deploying frontend..."
	cd apps/web && pnpm build && vercel --env staging
	@echo "✅ Staging deployment complete!"
	@echo "All services available through unified API Gateway:"
	@echo "  - Projects: /api/v1/projects"
	@echo "  - Backlog: /api/v1/backlog"
	@echo "  - Readiness: /api/v1/readiness"
	@echo "  - Prompt Builder: /api/v1/prompt-builder"
	@echo "  - Context Orchestrator: /api/v1/context-orchestrator"

deploy-prod:
	@echo "Deploying consolidated API Gateway to production environment..."
	@echo "⚠️  This will trigger canary deployment with monitoring"
	@echo "Building consolidated production release..."
	cargo build --release --package api-gateway
	@echo "Triggering canary deployment workflow..."
	gh workflow run deploy.yml --field environment=production --field canary_percentage=5

canary-deploy:
	@echo "Managing canary deployment..."
	@echo "Current canary status:"
	gh run list --workflow=deploy.yml --limit=1 --json status,conclusion,url
	@echo "To promote canary: gh workflow run deploy.yml --field promote_canary=true"
	@echo "To abort canary: gh workflow run rollback.yml --field target=canary"

rollback:
	@echo "Emergency rollback procedures..."
	@echo "Available rollback targets:"
	@echo "  - staging: Rollback staging environment"
	@echo "  - canary: Abort canary deployment"  
	@echo "  - production: Full production rollback"
	@echo ""
	@echo "Usage: gh workflow run rollback.yml --field target=<target>"
	@echo "Manual rollback commands:"
	@echo "  Previous staging: make deploy-staging"
	@echo "  Kill all services: cargo shuttle project stop --name <service-name>"

# ==============================================================================
# MAINTENANCE COMMANDS
# ==============================================================================

clean:
	@echo "Cleaning build artifacts..."
	cargo clean
	rm -rf target/tarpaulin

reset-db:
	@echo "Resetting all databases..."
	docker-compose down -v
	docker-compose up -d
	sleep 10
	$(MAKE) migrate

health-check:
	@echo "Checking consolidated API Gateway health..."
	@echo "Consolidated API Gateway (all services):"
	curl -f http://localhost:8000/health || echo "API Gateway: DOWN"
	@echo "Individual service endpoints through gateway:"
	curl -f http://localhost:8000/api/v1/projects/health || echo "Projects service: DOWN"
	curl -f http://localhost:8000/api/v1/backlog/health || echo "Backlog service: DOWN"
	curl -f http://localhost:8000/api/v1/readiness/health || echo "Readiness service: DOWN"
	curl -f http://localhost:8000/api/v1/prompt-builder/health || echo "Prompt Builder service: DOWN"
	curl -f http://localhost:8000/api/v1/context/health || echo "Context Orchestrator service: DOWN"

feature-flags:
	@echo "Feature flag management..."
	@echo "Available flags:"
	@echo "  - FEATURE_FLAG_ENABLE_AI_FEATURES=true/false"
	@echo "  - FEATURE_FLAG_ENABLE_CONTEXT_ORCHESTRATOR=true/false"
	@echo "  - FEATURE_FLAG_ENABLE_CANARY_ROLLOUT=true/false"
	@echo "  - FEATURE_FLAG_ENABLE_DEBUG_LOGGING=true/false"
	@echo ""
	@echo "Set via environment variables for local development"
	@echo "Production flags managed via LaunchDarkly dashboard"

# ==============================================================================
# DEVELOPMENT TOOLS
# ==============================================================================

install-hook:
	@echo "Installing pre-commit hook for Rust workspace..."
	@./install-pre-commit-hook.sh
	@echo "✅ Pre-commit hook installed successfully!"
	@echo "The hook will:"
	@echo "  - Run 'cargo fmt --all' and auto-stage formatting changes"
	@echo "  - Run 'cargo clippy' with -D warnings and fail on issues"
	@echo "  - Provide clear feedback during the commit process"

# ==============================================================================
# ENHANCED DEVELOPER WORKFLOW COMMANDS
# ==============================================================================

install-hooks:
	@echo "Installing all git hooks for optimized workflow..."
	@echo "1. Installing pre-commit hook (format + clippy)..."
	@./install-pre-commit-hook.sh
	@echo "2. Installing pre-push hook (tests + quality gates)..."
	@chmod +x .git/hooks/pre-push
	@echo "3. Making smart test runner executable..."
	@chmod +x scripts/smart-test-runner.sh
	@echo "✅ All git hooks installed successfully!"
	@echo ""
	@echo "Git hooks installed:"
	@echo "  pre-commit: Format + clippy checks"
	@echo "  pre-push: Unit tests + build verification"
	@echo ""
	@echo "Available commands:"
	@echo "  make smart-test    - Run tests for changed components only"
	@echo "  make test-smart    - Alias for smart-test"
	@echo "  make test-changed  - Run tests with change detection"
	@echo "  make setup-dev     - Complete development environment setup"

smart-test:
	@echo "Running smart test execution (tests only changed components)..."
	@./scripts/smart-test-runner.sh

test-smart: smart-test
	# Alias for smart-test

test-changed:
	@echo "Running tests for components changed since last commit..."
	@./scripts/smart-test-runner.sh --base-ref HEAD~1

setup-dev:
	@echo "Setting up complete development environment..."
	@echo "1. Installing git hooks..."
	@$(MAKE) install-hooks
	@echo "2. Installing required tools..."
	@cargo install sqlx-cli --no-default-features --features "postgres,uuid,tls-rustls" || echo "sqlx-cli already installed"
	@cargo install cargo-tarpaulin --version 0.13.3 || echo "tarpaulin already installed"
	@echo "3. Checking Rust toolchain..."
	@rustup component add rustfmt clippy || echo "Components already installed"
	@echo "4. Verifying git hooks..."
	@ls -la .git/hooks/ | grep -E "(pre-commit|pre-push)"
	@echo "✅ Development environment setup complete!"
	@echo ""
	@echo "Quick start:"
	@echo "  make fmt          - Format code"
	@echo "  make lint         - Run clippy"
	@echo "  make smart-test   - Run smart tests"
	@echo "  make test-unit    - Run all unit tests"
	@echo "  make dev-up       - Start local services"