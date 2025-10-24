# Phase 1 – Experience Blueprint Working Doc

This file tracks the Phase 1 activities (Weeks 2–3) as outlined in the roadmap. It will evolve into the approved experience spec.

## Objectives
- Produce navigation sitemap that reflects the new workflow-first layout.
- Define dashboard information architecture and module placement per persona.
- Deliver high-fidelity wireframes (desktop + mobile breakpoints) for key views.

## Checklist
- [x] Draft navigation sitemap (low-fi).
- [x] Produce low-fi dashboard sketches per persona (Dev, PO, SM, Sponsor).
- [ ] Validate sketches with James; capture feedback.
- [x] Translate approved concepts into high-fidelity wireframes (textual spec).
- [ ] Update design system components (nav shell, cards, suggestion feed).
- [ ] Accessibility review (contrast, keyboard navigation).
- [ ] Engineering sign-off on UI components impacted.

### Artefacts
- Navigation sitemap & persona sketches (above).
- Wireframe specification: `docs/navigation-phase1-wireframes.md`.
- Design system impact notes: `docs/navigation-phase1-design-system.md`.
- Hi-fi textual spec: `docs/navigation-phase1-hi-fi-details.md`.

## Phase 1 Journal
- *2025-02-16*: Kick-off logged; agreed to emphasise My Tasks + Current Sprint modules.
- *2025-02-16*: Drafted low-fi sitemap focusing on workflow-first navigation.
- *2025-02-16*: Documented persona-specific dashboard sketches (lo-fi textual).
- *2025-02-16*: Compiled structural wireframe spec and design system impact notes.
- *2025-02-16*: Documented hi-fi component specs & copy in textual form.
- (Add future entries as we iterate.)

## Deliverable Targets
- Sitemap + IA: end of Phase 1 week 1.
- Hi-fi wireframes + mobile breakpoints: end of Phase 1 week 2.
- Accessibility & eng review: same week as hi-fi completion.

## Dependencies
- Persona insights from Phase 0 (baseline doc).
- Backend capability assumptions (story signals, role metadata).
- Dashboard copywriting guidance (to be drafted during Phase 1).

---

## Low-Fi Navigation Sitemap (Draft)

```
Global Shell
├─ Dashboard (default landing)
│  ├─ My Focus (role-aware modules)
│  └─ AI Coaching Feed
├─ My Tasks
│  ├─ Active tasks
│  ├─ Completed (recent)
│  └─ Queue (ready to pull)
├─ Current Sprint
│  ├─ Sprint summary
│  ├─ Stories & tasks
│  └─ Stand-up notes shortcut
├─ Backlog
│  ├─ Ready stories
│  ├─ Needs refinement
│  └─ Archive / ideas
├─ Reports & Insights
│  ├─ Velocity / burndown
│  ├─ Predictive risk
│  └─ Team health
└─ Explore
   ├─ Projects directory
   ├─ Teams directory
   └─ Admin / settings
```

**Navigation Notes**
- Primary nav contains Dashboard, My Tasks, Current Sprint, Backlog, Reports, Explore.
- Team switcher pinned to top of nav; Sponsor persona can pin multiple teams/projects.
- Breadcrumbs preserved for deep links (e.g., `/projects/{id}/backlog`) but nav highlights nearest primary item.
- Mobile: collapsible bottom nav with tabs (`Focus`, `Team`, `Explore`).

## Low-Fi Dashboard IA (Work-in-Progress)

- **Header Strip:**
  - Team switcher (if >1 team).
  - Active sprint name + days remaining.
  - Quick actions: Start stand-up mode, Add story, Plan next sprint.

- **Primary Column (left 2/3):**
  1. **My Next Actions** (default to tasks for Dev; story prep cues for PO/SM).
     - Each card: title, context, CTA (`Start work`, `Review story`, `Resolve blocker`).
  2. **Current Sprint Snapshot**
     - Progress bar (committed vs completed points).
     - Capacity usage indicator.
     - Links: view board, update sprint goal.
  3. **AI Coaching Feed**
     - Ranked suggestions with relevance tags.

- **Secondary Column (right 1/3):**
  - **Notifications & Rituals** (upcoming meetings, stand-up summary).
  - **Backlog Health Indicators** (stories lacking ACs, oversized items).
  - **Team Signals** (velocity trend, blockers).

- **Empty State Handling:**
  - If user has no tasks, highlight recommended next steps (pull new story, groom backlog, review blockers).
  - Provide quick CTA to schedule backlog refinement when necessary.

Next step: produce role-specific low-fi sketches (textual + wireframe references). 

## Persona-Specific Dashboard Sketches (Textual Lo-Fi)

### Developer Agent
- **My Next Actions (Top):** list of assigned tasks sorted by status urgency (In Progress, Ready, Blocked). Inline actions: start, mark complete, open story.
- **Sprint Snapshot:** progress bar + “stories waiting for pickup” count; quick link to board swimlane filtered to developer.
- **AI Coaching Feed:** emphasise blockers (“Story ABC waiting for your code review”). Secondary suggestions hidden when tasks exist to avoid clutter.
- **Empty State:** if no tasks, display recommended ready stories + “pairing opportunities”.

### Product Owner Agent
- **My Next Actions:** cards for “Stories needing ACs”, “Stories oversized (>8 pts)”, “Upcoming sprint planning prep”.
- **Backlog Health Panel (Primary column location #2):** readiness metrics by status; CTA to review each cluster.
- **Sprint Snapshot:** emphasise commitment coverage vs planned; highlight stories missing grooming.
- **AI Coaching Feed:** prompts like “Split Story XYZ (13 pts)” or “Add acceptance criteria to Story 123”.

### Scrum Master Agent
- **My Next Actions:** blockers, overdue tasks, pending stand-up notes, retro prep reminders.
- **Sprint Snapshot:** includes team availability, capacity usage, risk meter (based on blockers + throughput).
- **Team Signals Module (primary column #3):** aggregated metrics (WIP limit breaches, queue health).
- **AI Coaching Feed:** suggestions to check in with specific contributors or unblock stories.

### Sponsor Agent
- **My Next Actions:** high-level KPIs needing attention (e.g., “Team Velocity dropped 20%”, “Release slip risk”).
- **Sprint Snapshot:** simplified card per key team with status (on track / at risk).
- **Reports & Insights preview:** quick links to velocity charts, roadmap alignment.
- **AI Coaching Feed:** focus on risk/impact summaries rather than story-level detail.

### Mobile Layout Notes
- Sections stack vertically; “My Next Actions” converted to swipeable cards.
- Sprint snapshot collapses into a compact meter; tap to expand details.
- AI suggestions accessible via carousel near bottom; notifications accessible via tab bar.

---
