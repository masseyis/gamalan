# Sprint Task Board Specification Tests

## Overview

This document describes the **specification tests** for the Sprint Task Board feature. These tests validate the **technical contracts** defined in ADR-0006 and the acceptance criteria.

## Purpose

**⚠️ IMPORTANT: These are SPECIFICATION TESTS, not implementation tests**

- **Goal**: Define and validate technical contracts that the UI must implement
- **Expected Behavior**: These tests are **EXPECTED TO FAIL** until implementation is complete
- **Do NOT**: Modify these tests to make them pass - they define the contract!

## Test File

Location: `apps/web/tests/e2e/workflows/sprint-task-board-contracts.spec.ts`

## Contract Sources

1. **ADR-0006**: Real-Time WebSocket Updates for Sprint Task Board
2. **Acceptance Criteria**:
   - AC 7852bac8: Display all sprint tasks with required information
   - AC a2ef8786: Filter and group tasks with visible counts
   - AC 8e8e949d: Visual distinction for task states
   - AC 728fd41e: Real-time updates without page refresh
   - AC d4d41a1f: Sprint metadata and progress indicators

## Test Structure

### AC 7852bac8: Task Display Contract (7 tests)

**Contract**: Each task must display complete information with correct data-testid attributes

| Test | Contract Validated |
|------|-------------------|
| task cards must have unique data-testid with UUID | `data-testid="task-card-{uuid}"` pattern |
| task must display ID field | `data-testid="task-id"` with UUID format |
| task must display title field | `data-testid="task-title"` non-empty |
| task must display status | `data-testid="task-status"` with valid values |
| task must display owner when assigned | `data-testid="task-owner"` for owned tasks |
| task must display parent story name | `data-testid="story-name"` non-empty |
| task must have AC references container | `data-testid="ac-refs"` exists |

**Valid Status Values**: available, owned, inprogress, completed

### AC a2ef8786: Filter and Group Contract (5 tests)

**Contract**: Filter and grouping controls must exist with correct data-testid attributes

| Test | Contract Validated |
|------|-------------------|
| status filter checkboxes | `input[type="checkbox"][value="available|owned|inprogress|completed"]` |
| filtered count display | `data-testid="filtered-count"` shows "X of Y" format |
| group by control | `data-testid="group-by-select"` exists |
| story groups structure | `data-testid="story-group"` with title and count |
| status groups structure | `data-testid="status-group"` with title and count |

**Group Requirements**:
- Each group must have `data-testid="group-title"`
- Each group must have `data-testid="group-count"` with numeric value

### AC 8e8e949d: Visual Distinction Contract (4 tests)

**Contract**: Tasks must be visually distinguished by ownership state

| Test | Contract Validated |
|------|-------------------|
| available tasks badge | `data-testid="available-badge"` visible on available tasks |
| my tasks badge | `data-testid="my-task-badge"` visible on owned tasks |
| my tasks attribute | `data-my-task="true"` attribute on task cards |
| other users' owner name | `data-testid="task-owner"` shows owner name (not "You") |

### AC 728fd41e: Real-Time Updates Contract (ADR-0006) (7 tests)

**Contract**: WebSocket connection and event schemas from ADR-0006

| Test | Contract Validated |
|------|-------------------|
| WebSocket endpoint | Connection to `/api/v1/ws/tasks` |
| JWT authentication | Token in query parameter `?token=` |
| OwnershipTaken event schema | Matches ADR-0006 TaskEvent::OwnershipTaken |
| StatusChanged event schema | Matches ADR-0006 TaskEvent::StatusChanged |
| Connection indicator | `data-testid="connection-indicator"` visible |
| Notification display | `data-testid="toast"` or `role="alert"` |
| No page reload | UI updates without triggering page reload |

**OwnershipTaken Event Schema** (from ADR-0006):
```json
{
  "type": "ownership_taken",
  "task_id": "uuid",
  "story_id": "uuid",
  "owner_user_id": "uuid",
  "timestamp": "ISO8601 string"
}
```

**StatusChanged Event Schema** (from ADR-0006):
```json
{
  "type": "status_changed",
  "task_id": "uuid",
  "story_id": "uuid",
  "old_status": "string",
  "new_status": "string",
  "changed_by_user_id": "uuid",
  "timestamp": "ISO8601 string"
}
```

### AC d4d41a1f: Sprint Metadata Contract (8 tests)

**Contract**: Sprint header must display complete metadata

| Test | Contract Validated |
|------|-------------------|
| sprint name | `data-testid="sprint-name"` non-empty |
| sprint dates | `data-testid="sprint-dates"` with date format and separator |
| days remaining | `data-testid="days-remaining"` with number and text |
| progress bar | `data-testid="progress-bar"` visible |
| progress percentage | `data-testid="progress-percentage"` with % symbol, range 0-100 |
| story count | `data-testid="story-count"` with number and "story/stories" |
| task progress | `data-testid="task-progress"` with "X of Y tasks" format |
| progress validation | completed count ≤ total count |

### Error Handling Contracts (3 tests)

**Contract**: Standard error and empty states

| Test | Contract Validated |
|------|-------------------|
| error state | Error heading with "Try Again" button |
| empty state | `data-testid="empty-state"` when no tasks |
| main container | `data-testid="sprint-task-board"` exists |

## Total Test Coverage

- **Total Specification Tests**: 33
- **Contracts Validated**: All 5 acceptance criteria + ADR-0006 WebSocket contract
- **All tests marked with**: `@spec-test` comments

## Test Execution

### Expected Behavior

```bash
pnpm exec playwright test sprint-task-board-contracts.spec.ts --project chromium
```

**Expected Result**: Tests WILL FAIL until implementation is complete

This is **CORRECT** and **EXPECTED** behavior for specification tests!

### Success Criteria for QA Task

✅ All spec tests written for all ACs
✅ All tests marked with @spec-test comments
✅ Tests validate technical contracts from ADR-0006
✅ Tests committed (failures are expected and correct!)

## Implementation Checklist

When implementing the Sprint Task Board UI, developers should ensure:

### Task Cards
- [ ] Each card has `data-testid="task-card-{uuid}"`
- [ ] Task ID displayed with `data-testid="task-id"`
- [ ] Task title displayed with `data-testid="task-title"`
- [ ] Task status badge with `data-testid="task-status"`
- [ ] Task owner field with `data-testid="task-owner"` when assigned
- [ ] Parent story with `data-testid="story-name"`
- [ ] AC references container with `data-testid="ac-refs"`

### Filters and Grouping
- [ ] Status filter checkboxes with values: available, owned, inprogress, completed
- [ ] Filtered count display with `data-testid="filtered-count"`
- [ ] Group by select with `data-testid="group-by-select"`
- [ ] Story groups with `data-testid="story-group"`
- [ ] Status groups with `data-testid="status-group"`
- [ ] Group titles with `data-testid="group-title"`
- [ ] Group counts with `data-testid="group-count"`

### Visual Distinction
- [ ] Available badge with `data-testid="available-badge"`
- [ ] My task badge with `data-testid="my-task-badge"`
- [ ] My task attribute `data-my-task="true"` on owned tasks
- [ ] Owner name displayed for tasks owned by others

### Real-Time Updates (ADR-0006)
- [ ] WebSocket connection to `/api/v1/ws/tasks`
- [ ] JWT token in query parameter
- [ ] OwnershipTaken event handling (correct schema)
- [ ] StatusChanged event handling (correct schema)
- [ ] Connection indicator with `data-testid="connection-indicator"`
- [ ] Toast notifications with `data-testid="toast"` or `role="alert"`
- [ ] UI updates without page reload

### Sprint Metadata
- [ ] Sprint name with `data-testid="sprint-name"`
- [ ] Sprint dates with `data-testid="sprint-dates"`
- [ ] Days remaining with `data-testid="days-remaining"`
- [ ] Progress bar with `data-testid="progress-bar"`
- [ ] Progress percentage with `data-testid="progress-percentage"`
- [ ] Story count with `data-testid="story-count"`
- [ ] Task progress with `data-testid="task-progress"`

### Error Handling
- [ ] Error state with "Try Again" button
- [ ] Empty state with `data-testid="empty-state"`
- [ ] Main container with `data-testid="sprint-task-board"`

## References

- **ADR-0006**: `docs/adr/ADR-0006-real-time-websocket-updates.md`
- **Story**: As a contributor, I want to view all sprint tasks grouped by story
- **Task ID**: c708d4d2-dfaf-4da5-86a1-50b5c6431311

## Notes for Developers

1. **Do NOT modify these specification tests** to make them pass
2. **Implement the UI** according to the contracts defined in these tests
3. **Run the tests frequently** during development to check contract compliance
4. **All tests passing** = Implementation matches the specification
5. **Reference ADR-0006** for WebSocket event schemas and behavior

---

**Test Author**: QA Engineer (Specification Phase)
**Date Created**: 2025-11-05
**Status**: ✅ Specification Complete - Ready for Implementation
