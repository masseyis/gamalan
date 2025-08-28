# Salunga MVP Roadmap

---

## MVP Goals

- Use the tool to **build itself** (“eat our own dogfood”).
- Ensure every story is small, testable, and **ready with acceptance criteria**.
- Generate **safe, unambiguous prompts** for AI/junior devs to implement code + tests.
- Provide minimal but sufficient backlog/board/GitHub functionality to track work.

---

## MVP Features (Phase 1 – Dogfooding Oriented)

### Story Quality & Readiness (highest priority)

- **Story Splitter** – enforce small, vertical slices.
- **Readiness Assistant** – ensure testability and criteria before sprint start.
- **Acceptance Criteria Generator** – Given/When/Then for all stories.
- **Task Clarifier & Guardrail Builder** – hardened prompts with explicit non-goals and test/architecture constraints.

### Agile Management (core but lean)

- Backlog management (stories, tasks).
- Simple sprint/board (Ready → In Progress → In Review → Done).
- Basic tracking (completion, rollover, confidence-based velocity).

### GitHub Integration (minimal viable)

- PR/commit linking via `ABC-123` convention.
- Status nudges (PR opened → In Review; PR merged → Done).
- CI check results surfaced into story readiness.

### Sponsor/Team Value (lightweight)

- **Demo Assistant (basic)** – generate checklist of completed stories.

---

## Future Features (Phase 2+)

- **Sprint Stability Monitor** – visualise mid-sprint changes.
- **Backlog Curator** – auto-prune duplicates/stale items.
- **Anti-Pattern Detector** – scope creep, late QA.
- **Expanded Demo Assistant** – scripts/narratives.
- **Team Health Metrics** – rollover trends, QA engagement.
- **Deeper GitHub/CI Integration** – deployment signals, release tagging.

---

## MVP Success Criteria

- Tool is used in its own development — backlog → story readiness → code/test prompts.
- Stories consistently small, testable, with acceptance criteria present.
- Task prompts generate **robust tests + architecture-compliant code**, not shortcuts.
- Minimal agile workflow in place (backlog, board, GitHub link).
- Positive developer experience: less admin, more clarity.
