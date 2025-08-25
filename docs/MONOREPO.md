# Monorepo Structure

This document outlines the structure of the `ai-agile` monorepo.

## Root Directory

- `Cargo.toml`: The root workspace definition.
- `rust-toolchain.toml`: Specifies the Rust toolchain version.
- `Makefile`: Common development commands.
- `README.md`: This file.
- `.gitignore`: Files and directories to ignore in git.
- `.env.example`: Example environment variables.
- `docker-compose.yml`: Local development environment with Postgres.
- `.github/`: GitHub Actions workflows.
- `docs/`: Documentation, including ADRs.
- `libs/`: Shared libraries (crates).
- `services/`: Individual microservices.

## Libraries (`libs/`)

- `common`: Shared utilities for logging, error handling, etc.
- `auth_clerk`: Shared library for Clerk JWT authentication.

## Services (`services/`)

Each service is a separate Axum application with the following structure:

- `Cargo.toml`: Service-specific dependencies.
- `Shuttle.toml`: Shuttle deployment configuration.
- `README.md`: Service-specific documentation.
- `docs/openapi.yaml`: OpenAPI specification for the service.
- `src/`: Source code, following a hexagonal architecture.
  - `adapters/`: Adapters for external concerns (HTTP, persistence).
  - `application/`: Application logic and use cases.
  - `domain/`: Core domain logic and types.
  - `config/`: Service configuration.
  - `main.rs`: The main application entry point.
- `migrations/`: SQLx database migrations.
- `tests/`: Tests (unit, integration, contract).
