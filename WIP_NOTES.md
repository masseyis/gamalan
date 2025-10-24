# Work In Progress – Uncommitted Changes

## Big Picture
- Introduced a shared `libs/event-bus` crate that defines backlog/sprint domain events and an in-memory pub/sub bus so services can publish and listen for cross-service changes.
- Refactored API Gateway (`services/api-gateway`) to instantiate service use case structs directly, share the new event bus, and mount rebuilt routers instead of proxying to per-service HTTP crates.
- Began migrating individual Rust services (backlog, readiness, prompt-builder, context-orchestrator) to publish/consume events and to rely on shared projections; service-level migration folders were deleted in favor of a consolidated `db/migrations` directory.
- Started a large UI refresh in `apps/web` to reflect a nine-stage story workflow and to align components/tests with the simplified status change mechanics that are meant to replace the unfinished Event-Sourced flow.

## Frontend (`apps/web`)
- `apps/web/app/projects/[id]/board/page.tsx`: Attempting to rip out the `@dnd-kit` drag-and-drop board in favor of simple state-transition buttons (Ready → Committed → In Progress → Accepted). Imports for `useState`, `useEffect`, and DnD helpers were removed but the JSX still references them, so the page is currently broken and needs the new button-based interactions wired in.
- `apps/web/app/projects/[id]/backlog/**/*.tsx`: Expanded to the nine-stage workflow, updated copy/metrics, and added richer status + priority displays. These expect simplified status mutations from the backend but still rely on the unfinished UI controls.
- `apps/web/components/**` and related tests: Updated task ownership, AI assistant components, and navigation to the new workflow terminology. Jest/Vitest suites were adjusted but none of the tests have been rerun after the refactor.
- Overall TODO: finish the non-DnD status transition UX, reintroduce the missing React hooks/imports, and verify the tests compile once the API changes settle.

## Backend – Shared Crate
- `libs/event-bus`: New crate exporting event payload structs (`StoryRecord`, `SprintRecord`, etc.), the `EventBus` pub/sub wrapper, and `EventPublisher`/`EventListener` traits. Everything currently publishes to an in-process channel; persistence/backpressure is future work.

## Backend – Services
- `services/api-gateway`: `main.rs` now builds `BacklogUsecases`, `ReadinessUsecases`, and `PromptBuilderUsecases` directly, shares an `Arc<EventBus>`, and mounts new helpers (`build_backlog_router`, `build_readiness_router`, `build_prompt_builder_router`). Added adapters so prompt-builder can call backlog/readiness use cases without HTTP. Needs follow-up to ensure all routes are wired correctly and authentication middleware still works.
- `services/backlog`: `lib.rs` now exposes `build_usecases`. `application/usecases.rs` publishes `DomainEvent`s after each mutation. `adapters/http/handlers.rs` was rewritten around Axum `State<Arc<BacklogUsecases>>`. The old `routes.rs` was deleted, so any consumer still importing it will fail until migrated to the new API Gateway wiring.
- `services/readiness`: Added `projections` module that materializes projection tables from backlog events; `build_usecases` now spawns the projection worker and wires in the event bus and mock LLM. HTTP handlers still assume the old routes and need exercising.
- `services/prompt-builder` and `services/context-orchestrator`: Similar projection workers were added, expecting new projection tables for sprints/stories. The orchestration router now accepts an `EventBus` so projections can listen for sprint updates, but business logic is still stubbed.
- TODO across services: audit every integration test (`services/*/tests`, `tests/e2e`) because the signatures and routing changed; update any consumers that still expect the old CQRS endpoints.

## Database
- Deleted service-specific migration folders (e.g., `services/backlog/migrations/*`) and collected SQL into `db/migrations/`. Added new projection-related migrations (e.g., `20251001090000_add_projection_tables.sql`), plus a `.done` marker for the initial users table. Need to verify every service points its `sqlx::migrate!` macro at the new path (API Gateway already does) and regenerate SQLx offline data.
- New projection tables (`context_sprint_projections`, prompt-builder projections, etc.) are referenced by the new projection workers but migrations have not been applied/tested yet.

## Testing / Outstanding Work
- No backend (`make test`) or frontend (`pnpm --filter @salunga/web test`) suites have been rerun since the refactor; expect compile and runtime failures until the router/API breakages, migration path, and board UI are fixed.
- Immediate blockers: restore working imports and the simple status transition controls on the project board, finish wiring the Axum routes in API Gateway/backlog service, apply/regenerate migrations, and rerun the affected integration/e2e tests.
