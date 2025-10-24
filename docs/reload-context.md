# Reload Context Summary (Navigation & MCP Work)

**Current Focus**
- Navigation redesign Phase 0 (metrics + baseline). Personas defined, metrics plan in `docs/navigation-phase0-metrics.md`, backlog stories yet to be created.
- Dogfooding via Battra MCP server to capture workflow friction while building the new dashboard/nav experience.

**API / Auth Setup**
- API gateway now supports API key auth (`services/api-gateway/src/auth.rs`). Middleware resolves keys stored in `api_keys` table and stamps headers so downstream services reuse `AuthenticatedWithOrg`.
- New migration `db/migrations/20251021153000_create_api_keys_table.sql` added and applied locally.
- Seeded API key `battra-local-key-1` for user `user_34NgtsMnbjCImgtbQ7gRac27Uyx` (Test Org `org_33F8RYQBCb26heNI8AjkgfTvGC0`).
- `codex.toml` configured to launch MCP bridge (`/battra-mcp`) with that API key.

**Tooling**
- MCP bridge source: `tools/battra-mcp-server`. Build with `pnpm --filter @battra/mcp-server build`. Start via `/battra-mcp`. It accepts `BATTRA_API_KEY`, `BATTRA_USER_ID`, `BATTRA_ORG_ID`.
- Docs for Codex integration: `docs/codex-mcp-bridge.md`.
- Readiness projections can be rebuilt after a service restart either by running\
  `curl -sS -X POST http://localhost:8000/api/v1/readiness/projections/hydrate -H 'X-API-Key: battra-local-key-1' -H 'X-User-Id: user_34NgtsMnbjCImgtbQ7gRac27Uyx' -H 'X-Organization-Id: org_33F8RYQBCb26heNI8AjkgfTvGC0'`\
  or, via MCP, by calling the `rehydrate_readiness_projections` tool (no arguments).
- Persona dogfooding accounts live in Clerk (all password `Gocmo9-xyqtar-qebgud`) and are seeded in the local DB/Excelsior team with matching API keys:\
  - Dev → `dev+clerk_test@mock.com` (`user_34QaKB6nN5tBHsV4bBsd75d08LH`, key `battra-dev-key-1`)\
  - Product Owner → `po+clerk_test@mock.com` (`user_34QabGsiYcHLPWbC2cRLgSGRotR`, key `battra-po-key-1`)\
  - Scrum Master → `sm+clerk_test@mock.com` (`user_34QaOWGrFQFYuPpTLjYsiqIId35`, key `battra-sm-key-1`)\
  - Sponsor → `sponsor+clerk_test@mock.com` (`user_34QaTNLLe08bibyuetnykiAqUnc`, key `battra-sponsor-key-1`)\
  - QA → `qa+clerk_test@mock.com` (`user_34QaXwzFFW1CVkZXQ4nUDNwS3TN`, key `battra-qa-key-1`)
- Frontend can impersonate a persona without Clerk token issues by setting `NEXT_PUBLIC_BATTRA_API_KEY` in `.env.local` (use the persona’s key above before running `pnpm dev`).

**Next Actions After Reload**
1. Ensure local services/API gateway running (`make dev-up` or equivalent).
2. Use MCP or curl with `X-API-Key: battra-local-key-1` to seed stories for Phase 0 tasks (baseline, analytics plan, PRD addendum).
3. Capture timings in `docs/navigation-phase0-baseline.md` and keep metrics doc up to date.

Point the new session at this file to regain context quickly. 
