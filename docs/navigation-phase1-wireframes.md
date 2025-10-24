# Phase 1 Wireframe Specification

This document captures mid-fidelity (structural) wireframe notes for the redesigned navigation and dashboard. Use it to guide high-fidelity mock creation.

## Global Layout Framework
- **Grid:** 12-column desktop grid with 24px gutters; primary column (span 8) and secondary column (span 4). Mobile collapses to single column with 16px margins.
- **Navigation Shell:**
  - Left rail width: 280px desktop; collapsible to icon-only 72px.
  - Top bar contains team switcher, search, quick actions (New Story, Plan Sprint).
  - Persistent bottom shortcuts for mobile (`Focus`, `Sprint`, `Backlog`, `More`).

## Dashboard – Developer Persona
- **Header strip (full width):**
  - Team pill, sprint name, days remaining progress bar, capacity cursor.
  - Quick action buttons (Start Stand-Up, View Board).
- **Primary column modules (order top→bottom):**
  1. `My Tasks` card stack (max 5 visible). Each card includes status badge, due indicator, CTA button (`Start`/`Complete`). Inline overflow menu for `Reassign`, `Log note`.
  2. `Sprint Snapshot` tile (70% width) with progress ring + metrics; adjacent `Stories waiting for pickup` list (30% width).
  3. `AI Coaching Feed` list (3 suggestions max). Each suggestion: title, rationale chip (e.g., “Blocker, 2 days”), accept/dismiss actions.
- **Secondary column:**
  - `Notifications & Rituals` panel (agenda, stand-up summary).
  - `Backlog Health` mini-chart (stories ready vs needs refinement).
  - `Team Signals` (velocity trend sparkline, blockers count).
- **Empty states:** placeholders encouraging to pull new ready story or request support.

## Dashboard – Product Owner Persona
- **Primary column:**
  1. `Backlog Grooming` queue (stories flagged for AC, oversize, missing estimates). Each item includes chips describing needs.
  2. `Sprint Readiness` summary (capacity vs committed; highlight unrefined stories).
  3. `AI Coaching` emphasising backlog tasks.
- **Secondary column:** `Upcoming ceremonies`, `Stakeholder updates`, `Top risks`.
- Include `Create Sprint Draft` CTA if upcoming sprint <7 days away.

## Dashboard – Scrum Master Persona
- **Primary column:**
  1. `Blocker Review` board (cards grouped by owner; quick `Ping` action).
  2. `Sprint Health` tile with velocity vs expectation, WIP limit indicator.
  3. `Team Rituals` schedule (stand-up, retro, demo).
- **Secondary column:** `AI Guidance` (check-in prompts), `Action Items` from retro, `Team Availability`.

## Dashboard – Sponsor Persona
- **Primary column:**
  1. `Portfolio Snapshot` (cards per team: status, progress, highlights).
  2. `Key Risks` list (with severity tags).
  3. `Milestone Tracker` timeline.
- **Secondary column:** `AI Insights` summarising trends, `Upcoming Releases`.

## My Tasks Page
- Table/list view with filters (status, sprint, project).
- Bulk actions (start, complete, reassign).
- Mobile: segmented control for `Active`, `Completed`, `Queue`.

## Current Sprint Page
- Top panel: sprint goal, time remaining bar, capacity usage.
- Tabs: `Board`, `Stories`, `Metrics`.
- Stand-up mode: focus view showing blockers, yesterday/today tracker boxes.

## Backlog Page
- Default view: Ready vs Needs Refinement columns; drag-and-drop to reorder.
- “AI suggestions” appear as inline banners when criteria triggered.
- Quick filters for AC missing, oversize, high risk.

## Reports & Insights
- Summary cards for velocity, predictability, quality metrics.
- Sponsor persona sees cross-team aggregated charts by default.

## Wireframe Assets
- Use consistent component scaffolds:
  - Card: header (title + icon), body (primary info), footer (actions).
  - List items: include status pill, metadata chips, CTA button.
  - Charts: simple skeleton (bar, sparkline placeholders).
- Interaction cues: annotate with icons for hover states, quick action buttons.

## Next Steps
- Translate these notes into hi-fidelity frames (Figma) with actual UI components.
- Prepare variant states (loading, empty, error).
- Validate mobile layouts for key screens (Dashboard, My Tasks, Current Sprint).
