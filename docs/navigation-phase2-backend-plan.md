# Phase 2 – Platform Enablement Plan

This document breaks down the backend work required to support the navigation & focus experience. It spans the backlog, sprint, and team services, plus a lightweight AI recommendation layer.

## Objectives
1. Expose story readiness signals (AC coverage, size, stale updates) via backlog APIs.
2. Provide an endpoint that aggregates team role metadata and active sprint context.
3. Deliver AI/heuristic recommendations with explainable payloads.
4. Enrich domain events so the dashboard can stay in sync without heavy polling.

## Epic Breakdown

### EPIC P2-1: Story Readiness Signals
- **P2-1A Story properties API extension**
  - Add `readiness_state`, `story_points`, `acceptance_criteria_present`, `last_updated_days` to story DTO.
  - Accept optional `signal=…` filters (e.g., `needs_acceptance`, `oversized`).
- **P2-1B Readiness heuristics module**
  - Rules:
    - `needs_acceptance` if no ACs OR AC not updated in last 7 days.
    - `oversized` if `story_points > 8`.
    - `stale_ready` if status Ready and `updated_at > 5 days`.
  - Unit tests for each rule.
- **P2-1C Aggregated backlog metrics endpoint**
  - `/projects/{id}/backlog/health` returning counts per signal and list of top offenders.

### EPIC P2-2: Team & Sprint Context
- **P2-2A Team roles API**
  - Extend teams service to return member role + speciality; mark primary team per user.
- **P2-2B Active sprint summary endpoint**
  - `/teams/{id}/current-sprint` returns: sprint metadata, committed/completed points, blockers count, days remaining.
- **P2-2C Event enrichment**
  - When sprint status changes, emit event with `capacity_points`, `goal`, `committed_points`, `time_remaining`.

### EPIC P2-3: AI Coaching Service
- **P2-3A Recommendation catalog**
  - Define suggestion types: `story_split`, `add_acceptance`, `revisit_blocker`, `review_velocity`.
  - Config file mapping heuristics to messages, severity.
- **P2-3B Recommendation API**
  - Endpoint `/coaching/{team_id}` returning ranked suggestions with `suggestion_id`, `title`, `reason`, `primary_action`.
  - Combine heuristics (rule-based) with optional LLM call stub (future).
- **P2-3C Suggestion action logging**
  - Endpoint to record accept/dismiss; feeds analytics.

### EPIC P2-4: Telemetry & Logging Foundation
- **P2-4A Analytics hook**
  - Provide server endpoint to receive dashboard events (from Phase 4 UI).  
  - Store minimal fields (event name, user, payload JSON) in telemetry table.
- **P2-4B Observability**
  - Add tracing + metrics around new endpoints; include time-to-first-suggestion metric.

## Data Contracts
- **Story DTO additions**
  ```json
  {
    "id": "uuid",
    "title": "string",
    "status": "ready",
    "story_points": 5,
    "acceptance_criteria_present": true,
    "readiness_signals": ["stale_ready"],
    "last_updated": "2025-02-15T12:00:00Z"
  }
  ```
- **Backlog health response**
  ```json
  {
    "project_id": "uuid",
    "signals": {
      "needs_acceptance": 3,
      "oversized": 1,
      "stale_ready": 4
    },
    "top_stories": [
      {"story_id": "uuid", "signals": ["needs_acceptance"], "age_days": 6}
    ]
  }
  ```
- **Coaching suggestion**
  ```json
  {
    "suggestion_id": "uuid",
    "type": "add_acceptance",
    "title": "Add acceptance criteria to Story ABC",
    "reason": "Story lacks ACs and is planned for current sprint.",
    "priority": "high",
    "action": {
      "label": "Open Story",
      "target": "/projects/{id}/backlog/{story_id}"
    }
  }
  ```

## Implementation Order
1. Story readiness signals (P2-1) – required for dashboard health widgets.
2. Team & sprint context (P2-2) – enables current sprint spotlight.
3. Recommendation API (P2-3) – powers AI feed and nudges.
4. Telemetry foundation (P2-4) – optional before Phase 4 UI but good to establish early.

## Testing Strategy
- Unit tests for signal rules and recommendation ranking.
- Integration tests for new endpoints (backlog, sprint).
- Contract tests against API gateway to verify serialization.
- Observability checks (logs/metrics) to ensure endpoints instrumented.

## Open Questions
- Do we require persistence for suggestion history (for avoiding repeats)? → Probably, simple cache keyed by `user_id`, to add in P2-3C.
- Should readiness signals be computed on demand or via nightly job? → Start on demand; revisit once load known.
- Any domain event consumers needing updates? → Prompt builder/context orchestrator may benefit; coordinate later.
