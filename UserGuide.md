# Salunga User Guide

**Version:** AI-First Assistant Edition  
**Date:** Sept 2025

---

## 1. Introduction

Salunga is an **AI-first agile project management tool**. Instead of relying on manual board updates and heavy process, it uses an **assistant interface** to keep teams on track.

- For creators: clear guidance on what to do next.
- For sponsors: visibility and predictability.
- For everyone: reduced overhead and bureaucracy.

---

## 2. Key Concepts

- **Assistant Prompt Bar**: type natural language like “I finished the pets task last week.”
- **Suggestion Feed**: prioritized list of AI-generated nudges (e.g., “Story 42 is oversized, split it?”).
- **Guided Flows**: step-by-step confirmations for marking tasks done, splitting stories, or preparing demos.
- **Classic Views**: backlog, board, and reports remain available, but are secondary.

---

## 3. Getting Started

1. **Sign in with Clerk** (Google/GitHub/email).
2. **Create a Workspace** for your team.
3. **Connect GitHub** (optional, recommended) so PRs and commits link to stories.
4. Invite your team members.
5. Open the **Assistant** tab (default home).

---

## 4. Using the Assistant

### 4.1 Prompt Bar

- Located at the top of the app.
- Type natural phrases:
  - “The database migration task is done.”
  - “Split the onboarding story.”
  - “What should I demo this sprint?”
- The AI interprets your intent, shows a shortlist of possible matches, and asks you to confirm.
- No changes happen until you confirm.

### 4.2 Candidate Confirmation

- If multiple matches are found, Salunga shows the top 2–3 with **evidence chips** (PRs, commits, story titles).
- Choose the right one → confirm action.
- If high confidence, it will skip shortlist and show a confirm dialog directly.

---

## 5. Suggestion Feed

- The main panel in **Assistant** view.
- Shows AI-generated nudges, ranked by importance. Examples:
  - “Story 15 has no acceptance criteria. Draft now?”
  - “You’re ahead of sprint plan — add a larger story?”
  - “Demo pack is ready to review.”
- Each suggestion card has **Accept**, **Edit**, or **Dismiss**.
- Dismissals help train Salunga to reduce noise.

---

## 6. Guided Flows

### 6.1 Marking Work Done

1. Type “Task X is finished” in the Prompt Bar.
2. AI matches it to the correct task (via PRs, commits, assignee, time filters).
3. Confirm candidate → Salunga marks it done and may suggest advancing the parent story.

### 6.2 Story Readiness

- Before sprint start, AI checks if stories are Ready.
- Missing acceptance criteria? It drafts Given/When/Then examples for review.
- Missing test prompts? It generates stubs.

### 6.3 Splitting Stories

- Oversized story? Salunga proposes vertical slices.
- You choose which slices to accept; tasks are created automatically.

### 6.4 Demo Prep

- At sprint end, AI compiles:
  - Completed stories + linked PRs.
  - Demo narrative (what to show, why it matters).
  - Checklist for demo session.

---

## 7. Classic Views

- **Backlog**: ordered list of stories.
- **Board**: Kanban-style view of stories and tasks.
- **Reports**: burndown, velocity, and sprint health.  
  These are always available, but secondary to the assistant experience.

---

## 8. Notifications

- In-app and email notifications when:
  - Suggestions are waiting for you.
  - A task/story is assigned to you.
  - Demo pack is ready.

---

## 9. Roles and Perspectives

- **Developers**: guidance on next tasks, auto-drafted tests, nudges to mark PRs/stories done.
- **QAs**: reminders to map tests, early visibility of ACs.
- **Product Owners**: backlog refinement support, story splitting, acceptance criteria drafting.
- **Sponsors/Stakeholders**: demo packs, delivery forecasts, sprint summaries.

---

## 10. Trial and Pricing

- Free 2-week trial (AI usage capped for fairness).
- Paid tiers start at $10/user/month, with options for Pro tier or workspace flat pricing.

---

## 11. Tips & Best Practices

- Use the **Prompt Bar first** instead of hunting through the backlog.
- Always confirm AI suggestions; nothing is applied without your input.
- Dismiss irrelevant suggestions to tune the feed.
- Use demo packs as living documentation for sponsors.
- Connect GitHub early to unlock the full experience.

---

## 12. Support & Feedback

- **Help Center**: docs.salunga.io
- **Support Email**: support@salunga.io
- **Feedback**: use the in-app “Send Feedback” option to shape the roadmap.

---
