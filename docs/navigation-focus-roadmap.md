# Navigation & Focus Roadmap

This roadmap captures the plan to deliver a role-aware dashboard, simplified navigation, and “next best action” workflow. It is organised into discovery, design, enablement, implementation, and rollout phases so future sessions can resume work quickly.

## Goals
- Surface “what should I do now?” immediately for each role (developer, product owner, scrum master, sponsor).
- Bring the current team sprint and personal tasks to the top of the experience.
- Provide AI-backed nudges for backlog grooming, story readiness, and sprint health.
- Reduce navigation friction by centring the workflow around dashboard, current sprint, and personal tasks.

Success metrics:
- 25% reduction in time from login to first actionable step.
- ≥60% weekly dashboard adoption by active contributors within two weeks of launch.
- Role satisfaction scores ≥4/5 in post-launch surveys.
- ≥30% engagement with AI suggestions (accepted or actioned).

## Phase 0 – Discovery (Week 1)
**Deliverables**
- Persona/role matrix detailing needs for developers, POs, SMs, sponsors.
- Audit of current navigation paths and pain points.
- KPI baseline and target definitions (time-to-action, dashboard engagement).

**Key Tasks**
- Stakeholder interviews and quick usability walkthroughs.
- Review existing telemetry and support tickets.
- Draft PRD addendum describing desired outcomes and metrics.

**Exit Criteria**
- Cross-functional sign-off on PRD addendum and measurement plan.

## Phase 1 – Experience Blueprint (Weeks 2–3)
**Deliverables**
- Navigation sitemap with simplified primary/secondary nav.
- Dashboard information architecture with module placement.
- High-fidelity wireframes per persona, including mobile breakpoints.

**Key Tasks**
- Iterate from low-fi sketches to hi-fi mocks with design reviews.
- Validate copy for alerts/prompts; accessibility review.
- Update design system components as needed (cards, rails, feed).

**Exit Criteria**
- Approved design spec; engineering sign-off on component scope.

## Phase 2 – Platform Enablement (Weeks 3–4, parallel with design)
**Backend Enhancements**
- Extend backlog APIs to expose story readiness signals, story size heuristics, and backlog grooming flags. (See `docs/navigation-phase2-backend-plan.md`.)
- Add AI recommendations endpoint combining heuristic rules with LLM-generated prompts.
- Include user role + team membership metadata in team APIs.

**Eventing**
- Enrich sprint Created/Updated events with capacity, goal, time remaining for dashboard consumption.

**Exit Criteria**
- Integration tests covering new endpoints/events.
- Updated API contract documentation.

## Phase 3 – Frontend Foundations (Weeks 4–5)
**Deliverables**
- New global navigation shell (sidebar/top bar) with quick access rail.
- Team switcher and dashboard layout skeleton guarded by feature flag.

**Key Tasks**
- Refactor Next.js root layout to adopt new nav.
- Implement role-aware data hooks (React Query) keyed by active team.
- Ensure legacy deep links remain valid; update route guards if required.

**Exit Criteria**
- Feature-flagged build renders without regressions; performance parity (Lighthouse/Next metrics).

## Phase 4 – Focus Modules (Weeks 5–6)
**Modules**
- *My Tasks:* actionable list with status transitions and empty-state guidance.
- *Current Sprint Spotlight:* goal, capacity utilisation, time remaining, quick links (board, backlog, stand-up notes).
- *AI Coaching Feed:* ranked suggestions with dismiss/complete controls.

**Exit Criteria**
- Usability test (1 session per persona) with ≥80% task success.
- Analytics instrumentation (dashboards, events) merged and validated.

## Phase 5 – Guided Workflows (Weeks 6–7)
**Enhancements**
- Between-task nudges (offer next ready task, backlog grooming, sprint hygiene).
- PO/SM playbooks for story splitting, acceptance-criteria review, sprint preparation.

**Exit Criteria**
- Beta feedback indicates reduced “what now?” confusion (survey ≥4/5).
- Critical bug count within release threshold.

## Phase 6 – Rollout & Optimisation (Week 8)
**Steps**
- Beta launch to pilot teams with telemetry monitoring.
- Stage rollout via feature flag; monitor KPIs and error budget.
- Collect qualitative feedback; plan follow-up A/B tests on AI suggestions.

**Post-Launch Tasks**
- Open backlog for iterative improvements.
- Update help centre and record demo walkthroughs.
- Enablement sessions for success/support teams.

## Dependencies & Coordination
- **AI Signals:** align with data science on heuristics + LLM prompts quality.
- **Role Data:** ensure teams service returns reliable role metadata.
- **Change Management:** coordinate with documentation and enablement groups.
- **Analytics:** define events early so logging lands before launch.

## Immediate Next Steps
1. Schedule Phase 0 discovery workshop; assign PM, Design, Eng leads.
2. Finalise PRD addendum reflecting this roadmap.
3. Prepare feature flag framework and analytics plan prior to development.

Use this document as the anchor for future planning sessions; update phase status and deliverables as work progresses. 
