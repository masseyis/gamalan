# Salunga — AI-Enhanced Agile Project Management Tool

**Product Requirements Document (PRD) — Draft v0.2**

---

## 1. Vision & Goals

Agile project management tools should make it easier for teams to focus on delivering value and for sponsors to see where things are heading. Instead, most current tools (especially Jira) add bureaucracy, prioritise cost accounting, and fail to support agile best practices.

This product is designed to be:

- **Opinionated**: nudges teams toward healthy agile practices and discourages anti-patterns.
- **AI-Enhanced**: uses automation and intelligent suggestions to reduce busywork, clarify confusion, and improve predictability.
- **Lightweight & Flow-Oriented**: minimal fields, fewer clicks, smoother workflows.
- **Aligned with Agile’s Two Core Goals**:
  1. Help creators focus and know what to do next.
  2. Give sponsors visibility and predictability into delivery.

The ultimate goal is a tool that feels like a **coach + assistant**, not a bureaucratic reporting system.

---

## 2. Target Users

### Primary Users

- **Developers / Creators**: need clarity on what to do next, small/testable stories, minimal admin.
- **QAs / Testers**: need to co-shape “ready” stories and generate testable acceptance criteria.
- **Product Owners / Sponsors**: need visibility and predictability, with demos that map to value.

### Secondary Users

- **Agile Coaches / Team Leads**: want enforced hygiene without constant policing; want lightweight metrics.

---

## 3. Core Problems

### Developers / Creators

- Confuse **stories vs tasks**, leading to backlog clutter.
- Misuse story points as time/effort, or feel pressured into false commitments.
- Lack support for splitting stories small enough to estimate.
- Overloaded with fields and manual updates.
- Lose trust when delegating tasks to AI/junior devs because prompts are vague → shortcuts like skipping tests or altering requirements.

### QAs / Testers

- Involved too late in the process.
- No space to co-author acceptance criteria early.

### Product Owners / Sponsors

- Struggle with predictability (burndowns misleading, mid-sprint changes common).
- Demos are inconsistent, incomplete, or don’t clearly map to delivered value.
- Refinement is manual and friction-heavy.

### Agile Coaches / Team Leads

- Spend energy enforcing basics (ready stories, good demos).
- Tools get hijacked for cost accounting and bureaucracy.
- Teams feel “stuck with Jira” instead of enabled.

---

## 4. Key Features

- **AI Story Classifier**: nudge when a “story” is really a task.
- **AI Estimation Coach**: reframe points as complexity/risk, not hours.
- **AI Story Splitter**: propose vertical slices when stories are too big.
- **Readiness Assistant**: detect missing criteria/dependencies; make suggestions.
- **Acceptance Criteria Generator**: draft Given/When/Then scenarios.
- **Task Clarifier & Guardrail Builder**: produce unambiguous, AI/junior-safe prompts with explicit “do/don’t” rules.
- **Lean Workflow**: minimal board (Ready → In Progress → In Review → Done).
- **Demo Assistant (basic)**: checklist of completed stories.
- **GitHub Integration**: link commits/PRs/tests automatically; reduce admin burden.

---

## 5. Opinionated Principles

1. **Stories Are About Value, Not Tasks**
2. **Estimates Are for Predictability, Not Accounting**
3. **Stories Become Ready Through Enablement, Not Policing**
4. **Smaller Is Better**
5. **QAs Are Part of the Story Conversation**
6. **Sprint Stability Comes from Visibility, Not Hard Locks**
7. **Demos Map Directly to Delivered Value**
8. **Minimal Bureaucracy, Maximum Flow**
9. **No Customisation for Its Own Sake**
10. **The Tool Is a Coach, Not a Report System**

---

## 6. AI Roles

1. **Story Classifier**
2. **Estimation Coach**
3. **Story Splitter**
4. **Readiness Assistant**
5. **Acceptance Criteria Generator**
6. **Sprint Stability Monitor**
7. **Demo Assistant**
8. **Backlog Curator**
9. **Anti-Pattern Detector**
10. **Task Clarifier & Guardrail Builder** _(USP; moved to MVP for dogfooding)_

---

## 7. Success Metrics

- **Story Readiness**: more stories ready before sprint start; acceptance criteria always present.
- **Delegation Trust**: AI/junior-generated outputs adhere to tests & architecture, not shortcuts.
- **Predictability**: reduced rollover; forecasts align with delivery confidence ranges.
- **Reduced Bureaucracy**: fewer manual updates; more automation from commits/PRs.
- **Demo Quality**: consistent sponsor-facing demos, checklist-driven.
- **Positive Sentiment**: teams feel tool helps them, not polices them.

---

## 8. MVP Roadmap (Dogfooding First)

### MVP Goals

- Use the tool to **build itself** (“eat our own dogfood”).
- Ensure every story is small, testable, and **ready with acceptance criteria**.
- Generate **safe, unambiguous prompts** for AI/junior devs to implement code + tests.
- Provide minimal but sufficient backlog/board/GitHub functionality to track work.

---

### MVP Features (Phase 1 – Dogfooding Oriented)

#### Story Quality & Readiness (highest priority)

- **Story Splitter** – enforce small, vertical slices.
- **Readiness Assistant** – ensure testability and criteria before sprint start.
- **Acceptance Criteria Generator** – Given/When/Then for all stories.
- **Task Clarifier & Guardrail Builder** – hardened prompts with explicit non-goals and test/architecture constraints.

#### Agile Management (core but lean)

- Backlog management (stories, tasks).
- Simple sprint/board (Ready → In Progress → In Review → Done).
- Basic tracking (completion, rollover, confidence-based velocity).

#### GitHub Integration (minimal viable)

- PR/commit linking via `ABC-123` convention.
- Status nudges (PR opened → In Review; PR merged → Done).
- CI check results surfaced into story readiness.

#### Sponsor/Team Value (lightweight)

- **Demo Assistant (basic)** – generate checklist of completed stories.

---

### Future Features (Phase 2+)

- **Sprint Stability Monitor** (visualise mid-sprint changes).
- **Backlog Curator** (auto-prune duplicates/stale).
- **Anti-Pattern Detector** (scope creep, late QA).
- **Expanded Demo Assistant** (scripts/narratives).
- **Team Health Metrics** (rollover trends, QA engagement).
- **Deeper GitHub/CI Integration** (deployment signals, release tagging).

---

### MVP Success Criteria

- Tool is used in its own development — backlog → story readiness → code/test prompts.
- Stories consistently small, testable, with acceptance criteria present.
- Task prompts generate **robust tests + architecture-compliant code**, not shortcuts.
- Minimal agile workflow in place (backlog, board, GitHub link).
- Positive developer experience: less admin, more clarity.
