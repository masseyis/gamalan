# Repository Guidelines

## Project Structure & Module Organization
The monorepo holds the full Battra AI stack. Next.js frontend lives in `apps/web`, Rust microservices sit in `services/*`, and shared Rust crates are under `libs/*`. Frontend UI assets and docs reside in `apps/web/public` and `docs/`. System-level integration tests live alongside Rust code in each service; Playwright and Vitest suites live in `apps/web/tests`. Scripts and automation live in `scripts/`, while the top-level `Makefile` orchestrates common workflows.

## Build, Test, and Development Commands
Use the Makefile during day-to-day work: `make dev-up` boots the local Postgres + mock services stack, `make test` runs all Rust tests, and `make lint` executes `cargo clippy -D warnings`. For focused development, run `cargo run -p services/<service-name>` to start one service, or `pnpm dev` (Turbo) followed by `pnpm --filter @salunga/web dev` to launch the frontend. Frontend builds go through `pnpm build`; workspace-wide builds use `pnpm build` (Turbo). The smart test helpers (`make smart-test`, `make test-changed`) scope Rust and frontend checks to touched files.

## Coding Style & Naming Conventions
Rust code must pass `cargo fmt --all` and `cargo clippy` (no warnings allowed). Favor module-centric directory names (e.g., `services/projects/src/handlers`). TypeScript follows Next.js defaults plus ESLint; run `pnpm lint` or `pnpm --filter @salunga/web lint`. Maintain PascalCase for React components, camelCase for functions/variables, and snake_case for Rust items. Apply Tailwind utility classes sparingly and co-locate component styles in the same file. Prettier (`pnpm format`) governs `.ts`, `.tsx`, and `.md`.

## Testing Guidelines
Rust services rely on `cargo test`; integration suites use dockerized infra (`make test-int`) or a local database (`make test-int-local`). Contract tests run with `make test-contract`. Frontend unit tests use Vitest (`pnpm --filter @salunga/web test`); e2e tests use Playwright with optional config flags like `pnpm --filter @salunga/web test:e2e:ci`. Keep spec files parallel to source (e.g., `component.test.tsx`). Aim to maintain the coverage status published via `make coverage` and `pnpm test:coverage`.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits (`type: short imperative`), as seen with `fix:` and `ci:` prefixes. Keep scope tight and staged changes clean to satisfy git hooks (`install-hooks`). PRs should summarize impact, link Jira/GitHub issues, note environment variables touched, and attach screenshots or CLI output for UI and API updates. Ensure all lint/tests above pass locally, and include migration notes when database schemas change.

## Environment & Security Notes
Copy `.env.example` to configure both Rust services and Next.js (`apps/web/.env.local`). Secrets for Shuttle deployments live in GitHub Actions; do not commit them. For local auth flows, run `docker-compose -f docker-compose.test.yml up mock-clerk` or rely on `make dev-up`. Rotate API keys in `Secrets.toml` and verify new secrets with `make health-check` before merging.
