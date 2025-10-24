# Product Requirements Document (PRD)

**Product:** Battra AI
**Version:** AI-First Assistant Pivot
**Date:** Sept 2025
**Owner:** James Massey

---

## 1. Vision

Battra AI is an **AI-first agile project management tool** that focuses on **guidance over bureaucracy**.  
Rather than being “a prettier Jira,” it leads with an **assistant interface** that tells teams what to do next, generates high-quality artifacts (acceptance criteria, test prompts, demo narratives), and ensures agile best practices are naturally followed.

**Core philosophy:**

- For creators: **clarity of next steps** and minimal friction.
- For sponsors: **predictability and visibility** into progress and delivery.
- For everyone: **AI as a partner**, not a button bolted onto a Kanban board.

---

## 2. Goals

1. **Assistant-first UX**: natural language input and AI-driven suggestions guide users.
2. **Predictability**: enforce story readiness, estimation sanity, and demo prep.
3. **Reduced burden**: auto-generate acceptance criteria, test prompts, and demo packs.
4. **Team health**: nudges that improve agile hygiene (no oversized stories, no mid-sprint churn).
5. **Transparency**: sponsors see delivery forecasts and clear demo narratives.

---

## 3. Pain Points Addressed

Current tools (Jira, Linear, ClickUp) often:

- Fail to distinguish real stories vs. tasks.
- Confuse complexity points with hours.
- Allow oversized stories that break estimation.
- Let stories start without readiness (ACs, tests, QA alignment).
- Treat estimates as rigid commitments.
- Require manual board grooming and demos.
- Encourage bureaucracy over flow.
- Offer AI add-ons, but not **core AI-guided workflows**.

**Additional pain points from community research:**

- Poor backlog hygiene (duplicates, stale items).
- Context switching between dev, QA, and PM roles.
- Reporting and visibility are bolted on, not real-time.

---

## 4. Solution Overview

Battra AI replaces the **board as the center** with an **assistant prompt + suggestion feed**:

- **Prompt Bar**: “What’s next?” → AI interprets vague inputs like “the task I finished last week about pets.”
- **Suggestion Feed**: prioritized nudges: “Story 123 has no ACs, draft now?” → accept/dismiss.
- **Guided flows**: progress updates, splitting oversized stories, prepping demos, sprint health checks.
- **Optional classic views**: board/backlog/reports for teams that want them.

---

## 5. Core Features

### 5.1 Conversational Front Door

- Prompt Bar (always visible).
- AI interprets natural input into intent (MarkTaskDone, SplitStory, GeneratePlanPack).
- Confirmation dialogs before actions.

### 5.2 Suggestion Feed

- Ranked nudges based on readiness, sprint health, backlog hygiene.
- Accept/Edit/Dismiss actions.
- Dismissals logged for tuning (reduce noise).

### 5.3 Guided Flows

- **Progress updates**: “Task X is done” → AI confirms entity → marks complete.
- **Story readiness**: auto-draft Given/When/Then criteria if missing.
- **Backlog refinement**: split oversized stories with AI-proposed slices.
- **Sprint health**: nudges to add/swap scope if capacity allows.
- **Demo prep**: auto-compile checklist + narrative.

### 5.4 Role-specific nudges

- **Devs**: “PR merged, mark story done?”
- **QA**: “2 stories lack mapped tests.”
- **POs**: “Oversized story, want to split?”
- **Sponsors**: “Demo pack ready for Sprint 5.”

### 5.5 Integration

- **GitHub** (MVP): link PRs and commits to stories.
- Future: GitLab, Bitbucket, Slack, Teams.

---

## 6. AI & Architecture

### 6.1 Retrieval & Interpretation

- Hybrid search: **Qdrant vector DB** (semantic) + **Postgres FTS** (lexical) + **recency boost**.
- AI interprets utterances into intents + entity slots, constrained by schema.
- No invented IDs; candidates come only from retrieval.

### 6.2 Prompt Builder

- Generates:
  - Acceptance criteria drafts.
  - Story slice proposals.
  - Demo narratives.
  - Test prompts (for vibe coding tools).

### 6.3 Dogfooding

- Battra AI will be used to manage **its own development**, ensuring stories are always Ready and test prompts produce robust code.

### 6.4 Architecture pattern

- Microservices, Rust-first, Shuttle/Fly.io deployable.
- Event-sourcing + projections where fast reads are needed (e.g., "My Todo list").
- Strong CI/CD gates: `cargo test`, `cargo clippy`, `cargo fmt`, coverage enforced.

### 6.5 Opinionated Agile Workflow (Core Domain)

**User Roles & Hierarchy:**

- **Sponsor**: View progress, demos, forecasts (read-only)
- **Product Owner**: Manage backlog, prioritize stories, accept completed work
- **Managing Contributor**: Technical leadership + mentorship (same capabilities as Contributor)
- **Contributor**: Self-organize work, take task ownership, implement solutions
  - Specialties: Frontend, Backend, Fullstack, QA, DevOps, UX Designer

**Team Structure:**

- Contributors belong to teams (no individual work)
- Teams work on one sprint at a time (no overlapping sprints)
- Team velocity tracked for capacity planning

**Story Workflow (Enforced Statuses):**

```
Draft → NeedsRefinement → Ready → Committed → InProgress →
TasksComplete → Deployed → AwaitingAcceptance → Accepted
```

**Non-Negotiable Constraints:**

1. **WIP Limits**: Team works on 1 story at a time, contributors own 1 incomplete task
2. **Story Size**: Maximum 8 points (larger stories must be split)
3. **Readiness Gates**: Minimum 3 acceptance criteria, test prompts, demo script
4. **Task Ownership**: Contributors self-select tasks ("I'm on it"), no manager assignment
5. **Acceptance**: Only Product Owner can accept completed stories
6. **Sprint Integrity**: Fixed duration, goal required, no mid-sprint additions

**Database Schema Extensions:**

- `teams`, `team_memberships`, `sprints`, `sprint_stories`
- Enhanced `users` with roles and specialties
- Task ownership tracking with self-selection model
- Story acceptance audit trail

---

## 7. Roadmap

### Phase 1: MVP (Dogfood Ready)

- Context-orchestrator with LLM parser + Qdrant + Postgres hybrid search.
- Prompt Bar + Suggestion Feed UI.
- `/interpret` + `/act` flows with confirmation.
- GitHub integration for PR/commit linking.
- Basic Suggestion Engine (story readiness, sprint health).
- Playwright tests for UI flows.

### Phase 2: Enhanced Guidance

- Story splitting flows.
- Demo narrative generation.
- Expanded nudges (QA/test coverage, backlog hygiene).
- Sponsor views (forecasts, demo packs).

### Phase 3: Scale & Integrations

- GitLab/Bitbucket support.
- Slack/Teams bot integration.
- Per-workspace pricing & metering.
- Enterprise features (SSO, SOC2, audit logs).

---

## 8. Pricing Strategy (early thinking)

- Market ceiling: $10–12/user/month.
- AI + infra costs ~ $5/user/month for very small teams, dropping to <$2/user at scale.
- Options:
  - Flat $10/user/month.
  - Tiered: $8 basic | $12 pro (uncapped AI).
  - Per-workspace pricing (e.g., $99/month up to 15 seats).
- 2-week free trial, with AI usage caps to avoid abuse.

---

## 9. Success Metrics

- **Activation:** % of trial users completing ≥5 actions in Prompt Bar.
- **Adoption:** DAU/WAU ratio > 30%.
- **Predictability:** % of stories marked Ready before sprint start.
- **Conversion:** 20%+ free-trial → paid.
- **Margin:** ≥70% gross margin at 25+ users/team.

---

## 10. Risks & Mitigations

- **AI costs too high at small scale** → pricing floors, base workspace fees.
- **LLM errors** → shortlist & confirmation step prevents silent mistakes.
- **Noise from nudges** → dismiss/learn feedback loop.
- **Competition** → differentiate with prescriptive guidance, not just “prettier Jira.”

---
