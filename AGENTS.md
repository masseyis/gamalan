# Repository Guidelines

## Project Structure & Module Organization
The monorepo hosts the full Battra AI stack. Next.js UI code lives in `apps/web`, with public assets under `apps/web/public` and shared docs in `docs/`. Rust microservices reside in `services/<service-name>` and reuse shared crates located in `libs/`. Keep integration tests beside their owning Rust service, while Playwright and Vitest suites sit in `apps/web/tests`. Automation and scripts belong in `scripts/`, and common workflows are orchestrated via the top-level `Makefile`.

## Build, Test, and Development Commands
Leverage the Makefile for routine tasks: `make dev-up` boots Postgres and mock services, `make test` runs all Rust tests, and `make lint` executes `cargo clippy -D warnings`. For focused work, `cargo run -p services/<service>` launches a single microservice, while `pnpm dev` followed by `pnpm --filter @salunga/web dev` starts the frontend. Run `pnpm build` (Turbo) for workspace builds and `pnpm --filter @salunga/web build` for the web app only.

## Coding Style & Naming Conventions
Rust code must remain in `snake_case`, formatted with `cargo fmt --all`, and linted via `cargo clippy` with zero warnings. TypeScript follows Next.js defaults: components in PascalCase, variables in camelCase. Apply Tailwind sparingly and co-locate styles with components. Format `.ts`, `.tsx`, and `.md` files using `pnpm format`.

## Testing Guidelines
Execute Rust unit tests with `cargo test` or scoped runs via `make smart-test`. Integration suites trigger with `make test-int` (docker) or `make test-int-local` (local DB), and contract tests with `make test-contract`. Frontend unit tests use Vitest through `pnpm --filter @salunga/web test`, while Playwright e2e tests run via `pnpm --filter @salunga/web test:e2e:ci`. Keep spec files next to their targets and watch coverage with `pnpm test:coverage` or `make coverage`.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits (e.g., `feat: add scheduler`, `fix: handle auth error`). PRs should summarize impact, link Jira or GitHub issues, call out environment variable changes, and attach screenshots or CLI snippets for UX-affecting work. Confirm local `pnpm lint`, `pnpm test` (or service-specific tests), and `make lint` before opening a PR.

## Security & Configuration Notes
Copy `.env.example` into service-specific `.env` files and `apps/web/.env.local` before developing. Secrets for Shuttle deploys stay out of the repo; rotate entries in `Secrets.toml` and validate with `make health-check`. For local auth flows, bring up `mock-clerk` via `docker-compose -f docker-compose.test.yml up mock-clerk` or rely on `make dev-up`.
