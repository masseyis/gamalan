
# CLAUDE.MD — Salunga Engineering Charter for Claude Code

> **Purpose**  
> This file defines the **architectural design plan**, **non-negotiable quality bars**, and **working rules** for Claude Code when proposing or committing changes in the Salunga monorepo. Treat it as a **contract**: follow it unless an ADR explicitly updates it.

---

## 1) Architectural Design Plan (Source of Truth)

### 1.1 Overall style
- **Language:** Rust (2021/1.79+)
- **Architecture:** **Hexagonal / Clean Architecture (Ports & Adapters)**
- **Services (microservices):** `auth-gateway`, `projects`, `backlog`, `readiness`, `prompt-builder`, (later) `gh-integrator`, `sprint`, `demo`, `analytics`, `coach`
- **Shared libs:** `libs/common` (tracing, error, http utils), `libs/auth_clerk` (Clerk JWT verification)
- **APIs:** **OpenAPI-first** — each service maintains `docs/openapi.yaml`
- **Persistence:** Shuttle-managed Postgres via `sqlx` with `#[Postgres]` annotation (migrations per service)
- **AuthN:** **Clerk** (JWT via JWKS); **AuthZ** is internal (roles/memberships)
- **Hosting:** Shuttle (per-service `Shuttle.toml`)
- **Observability:** structured logs + correlation id; `/health` & `/ready` endpoints in every service

### 1.2 Hexagonal boundaries (strict)
- `domain/` — entities, value objects, invariants; **no** async, **no** IO, **no** frameworks
- `application/` — use-cases, orchestration, DTOs, **ports** (traits) needed by domain/use-cases
- `adapters/http/` — Axum routes/handlers; request/response mapping; auth extractors
- `adapters/persistence/` — `sqlx` repos implementing out ports
- `adapters/integrations/` — outbound HTTP, events, LLM adapters, etc.
- **Rule:** dependencies **point inward only**. Adapters depend on application/domain; domain depends on nothing.

### 1.3 Key product flows (context)
- **Backlog** → Ready stories w/ ACs (G/W/T)
- **Prompt-builder**:
  - **Plan Pack** (story-level slicing; AC map with `ac_id`)
  - **Task Packs** (task-level, hardened prompts bound to ACs)
- **GitHub integrator** → PR/CI → status nudges back to Backlog
- **Sprint/Board** → Ready → In Progress → In Review → Done
- **Demo Assistant** → checklist from Done stories

---

## 2) Non-Negotiables (Quality Gates & Behaviors)

### 2.1 Testing & quality (MUST)
- **TDD/BDD first**: write/extend tests before or alongside code.
- **Test types per service**:
  - Unit tests for `domain/` and `application/`
  - Integration tests (HTTP + DB) with docker Postgres or testcontainers
  - Contract tests validating responses vs `docs/openapi.yaml` (status + schemas)
- **Coverage gate:** **≥ 85%** (enforced in CI via `tarpaulin`)
- **Never** skip, comment out, or weaken tests to “make green”.
- **No** breaking of hexagonal boundaries to “make it easier”.

### 2.2 Lint/format (MUST)
- **On every push & PR**:
  - `cargo fmt --all --check`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo test --all --locked`
- PRs that fail any of the above **must not** be merged.

### 2.3 OpenAPI fidelity (MUST)
- If an endpoint/DTO changes:
  - Update `docs/openapi.yaml`
  - Update/generate contract tests
  - Keep examples current in service README

### 2.4 Security & secrets
- **Do not** hardcode secrets or tokens.
- Use env vars; document in `.env.example` and service README.
- JWT verification must check `iss`, `aud`, `exp`, and JWKS `kid`.

### 2.5 Dependencies & crates
- Justify **new** third-party crates in an ADR; prefer std + well-known crates.
- Pin versions; deny unknown licenses if license policy is set.

---

## 3) CI/CD Best Practices (Required)

### 3.1 CI workflow (GitHub Actions)
**On PR + push:**
1. `cargo fmt --check`
2. `cargo clippy -D warnings`
3. Build (workspace)
4. **Unit tests**
5. Start Postgres (compose/testcontainers) → **integration tests**
6. **Contract tests** vs OpenAPI
7. **Coverage** (`tarpaulin`) ≥ 85%

**On deploy (tags/manual):**
- `cargo shuttle deploy -p services/<name>` for each deployable service
- Required secrets: `SHUTTLE_API_KEY`, `CLERK_*`, service DB URLs

### 3.2 Local dev convenience
- Pre-push hook (suggested): run fmt, clippy, test locally before pushing.
- `Makefile` targets: `fmt`, `lint`, `test`, `test-int`, `test-contract`, `coverage`, `dev-up`, `migrate`, `deploy-<svc>`

---

## 4) Living Architecture: Document Every Change

### 4.1 Files of record
- **ADRs:** `docs/adr/ADR-XXXX-*.md` (one per significant decision)
- **Living doc:** `docs/adr/LIVING_ARCHITECTURE.md` (running summary/changelog)

### 4.2 What Claude must do after changes
After implementing or proposing architectural work (endpoints, modules, boundaries, data models, dependencies), **summarize the diff and update docs**:

1. Produce a diff summary:
   - Run:  
     ```bash
     git fetch origin
     git diff --name-status origin/main...HEAD
     git diff --stat origin/main...HEAD
     ```
   - Extract **architectural** changes (folders, ports, adapters, schemas, OpenAPI, migrations, CI).
2. Update **`docs/adr/LIVING_ARCHITECTURE.md`** with:
   - Date, short title, scope of change
   - Impacted services/modules
   - New/changed ports, adapters, endpoints, migrations
   - Rationale & trade-offs
   - Links to relevant ADRs & PR
3. If a decision is substantial (new dependency, new boundary, new service):
   - Add a dedicated **ADR** (template in `docs/adr/ADR-TEMPLATE.md`), and reference it from the Living doc.

> **Note:** If a prior PR modified architecture but docs lag behind, **open a docs-only PR** to reconcile immediately.

---

## 5) BDD & TDD Implementation Rules

- Stories express value with **acceptance criteria (G/W/T)**; tests must reflect ACs.
- **Plan Pack** introduces `ac_id`s; **Task Packs** bind tasks to those ACs.
- Prefer **property-based tests** (e.g., `proptest`) for key invariants where useful.
- Negative tests are **mandatory** for validation & auth paths.
- For HTTP APIs, use **contract tests** to assert OpenAPI behavior (status + schema).

---

## 6) Monorepo Structure Contract (Do not drift)
/docs
/adr
ADR-0001-architecture.md
LIVING_ARCHITECTURE.md
/libs
/common
/auth_clerk
/services
/auth-gateway
/projects
/backlog
/readiness
/prompt-builder
/gh-integrator (later)
/sprint (later)
/demo (later)
/analytics (later)
/coach (later)


- Each service contains: `docs/openapi.yaml`, `src/{domain,application,adapters/...}`, `migrations/`, `tests/{unit,integration,contract}`, `Shuttle.toml`, `README.md`.
- Keep **ports** in `application/ports.rs` (or module); **adapters** implement them.

---

## 7) Commit & PR Protocol

- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `build:`, `ci:` …)
- PR must include:
  - Checklist: fmt, clippy, tests, coverage, OpenAPI updated
  - ADR link(s) if applicable
  - Short **architecture summary** (or note “no arch impact”)
- Do **not** merge red CI.

---

## 8) Don’ts (Hard Rules)

- ❌ Don’t silence or weaken tests/lints to land code.  
- ❌ Don’t bypass ports (e.g., HTTP adapter talking straight to DB).  
- ❌ Don’t add endpoints without OpenAPI updates & contract tests.  
- ❌ Don’t commit secrets or disable auth checks.  
- ❌ Don't introduce new crates without ADR justification.
- ❌ Don't use external database providers (AWS RDS, Neon, etc.) — **ONLY** use Shuttle-managed Postgres.
- ❌ Don't add DATABASE_URL to GitHub Actions workflows — databases are provided by Shuttle automatically.

---

## 9) Service-Specific Reminders

- **Auth-gateway:** verify Clerk webhooks (signature) and upsert `users`; JWT extractor in `libs/auth_clerk`.
- **Backlog:** story vs task discipline; `Task.acceptanceCriteriaRefs: string[]`; emits story events.
- **Readiness:** Ready = criteria present + tasks mapped to ACs (or explicit INFRA rationale).
- **Prompt-builder:** Plan Pack (story-level) & Task Packs (task-level, bound to ACs); store Markdown + JSON artifacts; idempotent.
- **GH-integrator (later):** verify GitHub signature; map PR/CI to nudges; never mutate Backlog directly without API.
- **Sprint (later):** owns sprint board; commands Backlog for status updates.

---

## 10) How to Propose Architectural Change (Claude workflow)

1. Draft change → write **tests first** (or concurrently)  
2. Update OpenAPI + contract tests as needed  
3. Implement within hexagonal boundaries  
4. Run local quality suite:  
   ```bash
   cargo fmt --all --check
   cargo clippy --all-targets --all-features -- -D warnings
   cargo test --all --locked
   make coverage   # ensure ≥ 85%

Generate diff summary & update docs/adr/LIVING_ARCHITECTURE.md (+ ADR if substantive)
Open PR with architecture summary + links; ensure CI is green
11) CI/CD Goals
Fast feedback, reproducible builds, deterministic tests
Enforced gates (fmt, clippy, tests, coverage, contract conformance)
Automated deploys to Shuttle on tags/manual approval
Security hygiene: minimal privileges, env-var secrets, no plaintext tokens
This charter is binding for Claude Code and all contributors.
If a change requires breaking these rules, propose an ADR first, justify the trade-offs, and update this CLADE.MD accordingly.
