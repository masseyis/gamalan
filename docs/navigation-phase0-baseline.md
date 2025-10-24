# Navigation Baseline Walkthroughs (Phase 0 – M0.1)

Baseline recordings for the current UI. Times are approximate manual timings (start when dashboard loads; stop when first meaningful action initiated).

## Developer Agent (“Dev”)
- **Scenario:** Developer logs in to start their next task.
- **Path Observed:**
  1. Load dashboard (default landing: general metrics + marketing copy).
  2. Sidebar → “Projects”.
  3. Select project from list.
  4. Within project, navigate to “Board”.
  5. Scan columns to find own task (requires clicking story, identifying assigned task).
  6. Open task, click “Start Work”.
- **Time to first action:** ~85s (heavy navigation; board fetch latency; manual scanning).
- **Pain Points:**
  - Dashboard lacks direct link to “My Tasks”.
  - Board view requires scroll/filter to find own work.
  - No quick indicator of active sprint or personal queue.

## Product Owner Agent (“PO”)
- **Scenario:** PO wants to groom stories for next sprint.
- **Path Observed:**
  1. Dashboard → “Projects”.
  2. Choose project, then “Backlog”.
  3. Filter by status (“Ready” vs “Needs Refinement”).
  4. Open story to review; check acceptance criteria.
- **Time to first action:** ~95s (filtering, page loads).
- **Pain Points:**
  - Must hop project-by-project; no global “needs refinement” summary.
  - Acceptance criteria readiness not highlighted until inside story modal.
  - No prompt for stories exceeding size threshold.

## Scrum Master Agent (“SM”)
- **Scenario:** SM checking sprint health before stand-up.
- **Path Observed:**
  1. Dashboard → “Teams”.
  2. Select team → “Sprints”.
  3. Identify active sprint (planning vs active not visually distinct).
  4. Click into sprint to view goal, progress.
- **Time to first action:** ~110s (multiple nesting levels).
- **Pain Points:**
  - Current sprint buried under Teams → Team → Sprints.
  - No quick metric summary on dashboard (capacity, blockers).
  - Stand-up notes not linked from sprint details.

## Sponsor Agent (“Sponsor”)
- **Scenario:** Sponsor checking high-level progress across teams.
- **Path Observed:**
  1. Dashboard → “Projects”.
  2. Repeat for each project to locate status updates.
  3. Navigate to reports to check velocity trends.
- **Time to first action:** ~120s (lots of jumps).
- **Pain Points:**
  - No aggregated cross-team summary.
  - Reports hidden deep in navigation.
  - Difficult to spot risk or blockers without manual dig.

## Observations Summary
- Average time to first action across personas: ~102s (target ≤55s post-change).
- Dashboard currently redundant for role-specific workflows.
- Navigation emphasises project hierarchy rather than personal/team workflow.
- Lack of visual cues about active sprint, personal assignments, or urgent backlog tasks drives extra clicks.

These insights feed Phase 0 metrics and the upcoming experience blueprint. 
