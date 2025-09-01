# Salunga User Guide (Draft)

_AI-Enhanced Agile Project Management Tool_

---

## 1. Introduction

Welcome to **Salunga**, an opinionated, AI-powered agile project management platform.  
Salunga is designed to:

- Keep teams focused on what matters most.
- Help sponsors see where work is headed.
- Embed best practices (small vertical slices, ready stories, meaningful demos).
- Automate away bureaucracy.

Unlike other tools, Salunga actively coaches you toward good agile hygiene. It helps shape your backlog into small, testable, demo-able stories, and even produces hardened prompts to delegate safe implementation to junior developers or AI assistants.

---

## 2. Key Concepts

- **Story**: A unit of business value, described with acceptance criteria (Given/When/Then).
- **Task**: A technical step to implement part of a story, linked to one or more acceptance criteria.
- **Plan Pack**: A design/slicing artifact generated from a Ready story, proposing tasks and AC mapping.
- **Task Pack**: A hardened, unambiguous prompt that guides a developer/AI through implementing a task safely.
- **Readiness**: A measure of whether a story is small, testable, and has acceptance criteria.
- **Work Packet**: The full set of instructions from a Task Pack, including constraints, test plan, and Do-Not rules.
- **Nudge**: An AI-generated recommendation (e.g. “This PR maps to Story #123 → move to In Review”).

---

## 3. Getting Started

### 3.1 Sign In

- Log in with your **Clerk account** (Google, GitHub, email, or enterprise SSO).
- Salunga maps your Clerk identity to your team membership and role (Developer, QA, PO, Coach).

### 3.2 Projects & Teams

- Create or join a **Project** within your Team.
- Configure:
  - **Estimation scale** (Fibonacci, T-shirt, etc.).
  - **Definition of Ready (DoR)** checklist.
  - **Demo expectations** (what value should be visible in sprint review).

---

## 4. The Backlog

### 4.1 Creating Stories

- Click **New Story** → enter _title_ and _description_.
- Add **acceptance criteria** (Given/When/Then). Salunga suggests criteria using AI; you can accept, edit, or add more.
- Mark story **Ready** once criteria and dependencies are satisfied.

### 4.2 Splitting Stories

- If a story feels too large, Salunga’s **Story Splitter** suggests smaller vertical slices.
- Accept or reject proposals; accepted slices are created as new stories.

### 4.3 Tasks

- From a Ready story, generate a **Plan Pack**.
- Review the suggested **tasks**, each mapped to specific ACs.
- Accept tasks → they appear nested under the story.
- Each task shows which ACs it covers, ensuring full coverage.

---

## 5. Readiness

- Every story shows a **Readiness Score** (checklist + AI evaluation).
- Missing items (e.g. no acceptance criteria, unlinked tasks) are highlighted.
- Stories cannot be pulled into a sprint unless Ready.

---

## 6. Prompt Builder

### 6.1 Plan Packs

- Open a Ready story → click **Generate Plan Pack**.
- View proposed slices, AC mapping, and architectural impact.
- Approve slices → tasks are created automatically.

### 6.2 Task Packs

- Open a task → click **Generate Task Pack**.
- Salunga outputs:
  - Markdown prompt for humans/AI.
  - JSON prompt for automation.
- Task Packs include Do-Not rules, file paths, test plan, and commit steps.
- Copy & paste into your AI coding tool, or hand to a junior developer.

---

## 7. GitHub Integration

- Branches and PRs automatically link to stories via ID convention (`ABC-123`).
- Salunga listens to GitHub webhooks:
  - PR opened → nudge: “Move Story #123 to In Review.”
  - PR merged → nudge: “Mark Story #123 as Done.”
  - CI failed → nudge: “Story not ready for Done; fix tests.”
- Linked commits/PRs are visible from the story view.

---

## 8. Sprint & Board

### 8.1 Creating a Sprint

- Define sprint name, dates, and project.
- Drag Ready stories into the sprint backlog.

### 8.2 The Board

- Kanban-style view: **Ready → In Progress → In Review → Done**.
- Move stories and tasks across columns.
- Salunga enforces valid transitions (e.g. cannot move to Done if ACs unmet).

### 8.3 Velocity & Forecasts

- View velocity with confidence ranges, not false precision.
- Salunga highlights scope changes and rollover trends.

---

## 9. Demo Assistant

- At sprint end, Salunga generates a **Demo Checklist**.
- Lists all Done stories with acceptance criteria satisfied.
- Provides suggested talking points that map each story to business value.
- Export demo notes to share with sponsors.

---

## 10. Notifications & Nudges

- Salunga provides **gentle nudges**, not bureaucracy.
- Examples:
  - “This story looks too large — consider splitting.”
  - “This task has no ACs mapped — it may be ambiguous.”
  - “PR merged; move Story #123 to Done.”
- Nudges appear in the UI, Slack, or email (configurable).

---

## 11. Roles & Permissions

- **Developer**: create/update stories, generate Task Packs, link PRs.
- **QA**: co-author acceptance criteria, verify readiness, mark ACs as tested.
- **Product Owner**: prioritise backlog, approve Plan Packs, create sprints.
- **Coach/Lead**: monitor team health, enforce DoR/DoD, review metrics.

---

## 12. Advanced Features

- **Anti-Pattern Detector**: surfaces bad smells (oversized stories, scope creep, late QA).
- **Backlog Curator**: auto-detects duplicates/stale items; suggests pruning.
- **Forecasting**: probabilistic delivery forecasts with confidence bands.
- **Team Health Metrics**: trends for rollover, QA involvement, demo coverage.

---

## 13. Example Workflow (Dogfooding)

1. PO creates a story: _“As a user, I can reset my password.”_
2. Salunga suggests acceptance criteria → QA edits them → mark Ready.
3. Prompt Builder → Plan Pack suggests 3 tasks:
   - Add “Forgot Password” API (AC1, AC2).
   - Email flow + token expiry (AC3, AC4).
   - UI form & validations (AC5).
4. Team accepts tasks.
5. Dev opens Task → Generate Task Pack → paste into AI coding tool → get PR.
6. PR opens → gh-integrator nudges story to In Review.
7. CI fails on token expiry → Salunga warns story not Done.
8. Fix & merge → nudge to Done.
9. Sprint review → Demo Assistant produces checklist → PO demos value.

---

## 14. Glossary

- **AC (Acceptance Criteria)**: Given/When/Then rules defining story completion.
- **DoR (Definition of Ready)**: Conditions required before starting a story.
- **DoD (Definition of Done)**: Conditions required before considering work complete.
- **Nudge**: An automated suggestion, not a mandate.
- **Work Packet**: Complete, hardened implementation prompt.
