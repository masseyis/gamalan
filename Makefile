.PHONY: fmt lint build test test-int test-contract coverage dev-up migrate deploy-all

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

test-int:
	@echo "Running integration tests..."
	# Add commands to run integration tests here

test-contract:
	@echo "Running contract tests..."
	# Add commands to run contract tests here

coverage:
	@echo "Generating test coverage..."
	cargo install --version 0.13.3 cargo-tarpaulin
	cargo tarpaulin --workspace --out Html

dev-up:
	@echo "Starting local development environment..."
	docker-compose up -d

migrate:
	@echo "Running database migrations..."
	cargo install sqlx-cli --no-default-features --features "postgres,uuid,tls-rustls"
	sqlx migrate run --source services/auth-gateway/migrations --database-url $$DATABASE_URL_AUTH_GATEWAY
	sqlx migrate run --source services/projects/migrations --database-url $$DATABASE_URL_PROJECTS
	sqlx migrate run --source services/backlog/migrations --database-url $$DATABASE_URL_BACKLOG
	sqlx migrate run --source services/readiness/migrations --database-url $$DATABASE_URL_READINESS

deploy-all:
	@echo "Deploying all services to Shuttle..."
	cargo install cargo-shuttle --locked
	cargo shuttle deploy -p services/auth-gateway
	cargo shuttle deploy -p services/projects
	cargo shuttle deploy -p services/backlog
	cargo shuttle deploy -p services/readiness