# Navigation Focus Metrics (Phase 0)

This sheet outlines the Phase 0 hypotheses and measurement tactics we will validate before moving into Phase 1 design/implementation.

## Hypotheses & Success Criteria

1. **H1 – Faster path to action:** Simplifying navigation and surfacing “next action” will reduce time from login to a meaningful interaction (e.g., opening a task, starting work) by **≥25%** compared to today’s baseline.
   - *Metric:* Time (seconds) from dashboard load to initiating primary action per persona.
   - *Baseline Capture:* Manual walk-through recordings for each persona (Dev/PO/SM) with existing UI.
   - *Target:* ≤55 seconds (assuming current average ≈75 seconds).

2. **H2 – Dashboard adoption:** A role-aware dashboard will be used by **≥60%** of active contributors weekly.
   - *Metric:* Unique users visiting dashboard / active users in week.
   - *Phase 0 Proxy:* Since telemetry isn’t instrumented, we will log manual usage during tests and set up mock analytics events to verify collection points.

3. **H3 – Role satisfaction:** Presenting personalised insights improves perceived clarity (survey **≥4/5**) for each persona.
   - *Metric:* Post-task SUS-style score after usability simulations.
   - *Phase 0 Proxy:* Simulated persona evaluations (Codex acting as agent) to produce baseline qualitative feedback.

4. **H4 – AI suggestion engagement:** At least **30%** of surfaced AI coaching prompts will be accepted or lead to direct action.
   - *Metric:* Suggestions accepted / dismissed / ignored.
   - *Phase 0 Proxy:* Create a list of candidate prompts; evaluate perceived value via persona walkthroughs; define tracking events for Phase 2.

## Phase 0 Tasks

- **M0.1 – Baseline Walkthroughs**
  - Record screenflow (manual or notes) for each persona from login → first action.
  - Note navigation path, clicks, pain points, and measured time.
  - Store findings in `docs/navigation-phase0-baseline.md`.

- **M0.2 – Analytics Instrumentation Plan**
  - Identify events required (dashboard_viewed, task_started, suggestion_clicked).
  - Map event payloads (user_id, persona role, team_id, project_id).
  - Document in `docs/navigation-phase0-analytics-plan.md`.

- **M0.3 – Persona Surveys**
  - Draft short questionnaires for Dev/PO/SM/Sponsor agents.
  - Capture baseline satisfaction estimates.

- **M0.4 – KPI Validation**
  - Review hypotheses with James; adjust targets if unrealistic.
  - Lock final success criteria before entering Phase 1.

## Deliverables
- Baseline walkthrough doc with timings and friction notes.
- Analytics plan outlining future telemetry hooks.
- Persona satisfaction survey templates.
- Sign-off summary listing agreed KPIs and measurement approach.

These artefacts complete Phase 0 metrics validation and feed into the PRD addendum. 
