# ADR-0007: Sprint Task Board Visual Indicators

## Status
Accepted

## Context
Contributors working on sprint tasks need clear visual indicators to quickly distinguish between:
- Available tasks (no owner, can be claimed)
- Their own tasks (owned by current user)
- Tasks owned by other team members

Without clear visual differentiation, contributors waste time identifying which tasks they can work on, leading to confusion and potential ownership conflicts.

## Decision

### Visual Design System

We implemented a comprehensive visual indicator system with the following elements:

#### 1. Available Tasks
- **Border Style**: Dashed border (`border-dashed`)
- **Border Color**: Gray (`border-gray-200`)
- **Text Indicator**: Green "Available to claim" badge (`text-green-600 font-medium`)
- **Ring Highlight**: None
- **Badge**: Standard status badge with Circle icon
- **Data Attribute**: `data-my-task="false"`

#### 2. My Tasks (Current User)
- **Border Style**: Solid border
- **Border Color**: Status-dependent (blue for owned, yellow for in-progress, green for completed)
- **Ring Highlight**: Blue ring with offset (`ring-2 ring-blue-500 ring-offset-2`)
- **Badge**: Blue "My Task" badge (`bg-blue-500 text-white`)
- **Owner Display**: Shows "You" instead of user ID
- **Data Attribute**: `data-my-task="true"`

#### 3. Tasks Owned by Others
- **Border Style**: Solid border
- **Border Color**: Status-dependent
- **Ring Highlight**: None
- **Badge**: No special badge
- **Owner Display**: Shows "Owner: {userId}"
- **Data Attribute**: `data-my-task="false"`

### Technical Implementation

#### Component Structure
```typescript
// SprintTaskList.tsx (lines 131-215)
const renderTaskCard = (task: TaskWithStory) => {
  const isMyTask = currentUserId && task.ownerUserId === currentUserId
  const isAvailable = task.status === 'available' && !task.ownerUserId
  const isOthersTask = task.ownerUserId && !isMyTask

  // Conditional styling based on task ownership
  // ...
}
```

#### CSS Classes Applied

**Available Tasks:**
- Base: `border-dashed border-gray-200`
- Hover: `hover:shadow-md`
- Indicator: `text-green-600 font-medium`

**My Tasks:**
- Base: `ring-2 ring-blue-500 ring-offset-2`
- Border: Status-dependent color
- Badge: `bg-blue-500 text-white`

**Others' Tasks:**
- Base: Standard card styling
- Border: Status-dependent color
- Owner: `<User icon /> Owner: {userId}`

### Status-Specific Border Colors

All task types inherit status-specific border colors:
- **Available**: `border-gray-200`
- **Owned**: `border-blue-200`
- **In Progress**: `border-yellow-200`
- **Completed**: `border-green-200`

## Acceptance Criteria Mapping

### AC-8e8e949d: Visual Distinction
**Given:** I am viewing the sprint task board
**When:** I see the list of tasks
**Then:** Available tasks should be clearly visually distinguished

**Implementation:**
- ✅ Available tasks have dashed borders (`border-dashed`)
- ✅ "Available to claim" text in green
- ✅ Gray border color distinguishes from owned tasks
- ✅ No ring highlight (unlike my tasks)

**Tests:**
- Unit: `SprintTaskList.visual-indicators.test.tsx:46-145`
- E2E: `sprint-board-visual-indicators.spec.ts:52-170`

### AC-8e8e949d: My Tasks Highlighted
**Given:** I am viewing the sprint task board
**When:** I see the list of tasks
**Then:** My own tasks should be highlighted or marked

**Implementation:**
- ✅ Blue ring highlight with offset (`ring-2 ring-blue-500 ring-offset-2`)
- ✅ Blue "My Task" badge
- ✅ Owner shows as "You"
- ✅ `data-my-task="true"` attribute for programmatic access
- ✅ Highlight persists across all statuses (owned, in-progress, completed)

**Tests:**
- Unit: `SprintTaskList.visual-indicators.test.tsx:148-270`
- E2E: `sprint-board-visual-indicators.spec.ts:172-303`

### AC-8e8e949d: Show Owner Name
**Given:** I am viewing the sprint task board
**When:** I see the list of tasks
**Then:** Tasks owned by others should show the owner name

**Implementation:**
- ✅ Displays "Owner: {userId}" for others' tasks
- ✅ User icon precedes owner information
- ✅ No special highlight (no ring)
- ✅ No "My Task" badge
- ✅ `data-my-task="false"` attribute

**Tests:**
- Unit: `SprintTaskList.visual-indicators.test.tsx:272-370`
- E2E: `sprint-board-visual-indicators.spec.ts:305-390`

## Technical Contracts

### Component Interface

```typescript
interface SprintTaskListProps {
  stories: Story[]
  selectedStatuses: TaskStatus[]
  groupBy: GroupByOption
  currentUserId?: string  // Required for "My Tasks" detection
}

interface Task {
  id: string
  status: TaskStatus
  ownerUserId?: string
  // ... other fields
}
```

### Data Attributes

Components must set the following data attributes for testing and automation:

```typescript
<Card data-testid={`task-card-${task.id}`} data-my-task={isMyTask ? 'true' : 'false'}>
```

### CSS Class Contract

Components using these visual indicators must apply:

1. **Base Card Classes:**
   - `transition-all hover:shadow-md`
   - Status-specific border color

2. **Conditional Classes:**
   - Available: `border-dashed` (in addition to base)
   - My Task: `ring-2 ring-blue-500 ring-offset-2` (in addition to base)
   - Others: Base classes only

## Consequences

### Positive
- **Immediate Visual Feedback**: Contributors can scan the board and instantly identify:
  - Tasks they can claim (dashed border, green "Available to claim")
  - Their own tasks (blue ring + badge)
  - Tasks owned by teammates (owner name displayed)
- **Reduced Cognitive Load**: No need to read task details to determine availability
- **Improved Collaboration**: Clear ownership prevents duplicate work
- **Accessibility**: Multiple visual cues (border style, color, badges, icons) provide redundancy
- **Testability**: Data attributes enable reliable automated testing

### Negative
- **Performance**: Additional DOM elements (badges, icons) and CSS classes slightly increase rendering cost
  - Mitigation: Tested with 100+ tasks; no perceivable lag
- **Maintenance**: Visual system must be consistent across all task-related views
  - Mitigation: Centralized in `SprintTaskList.tsx` component

### Neutral
- **Design Consistency**: Visual indicators must align with overall design system
- **Browser Support**: Ring styles require modern CSS; tested on Chrome, Firefox, Safari

## Test Coverage

### Unit Tests (22 tests)
Location: `apps/web/components/sprint/__tests__/SprintTaskList.visual-indicators.test.tsx`

**Test Categories:**
1. Available Tasks - Visual Distinction (5 tests)
2. My Tasks - Highlighted and Marked (6 tests)
3. Tasks Owned by Others - Show Owner Name (5 tests)
4. Comprehensive Visual Distinction (1 test)
5. Status-Specific Border Colors (3 tests)
6. Edge Cases (2 tests)

**Coverage:** All acceptance criteria scenarios tested

### E2E Tests (20+ scenarios)
Location: `apps/web/tests/e2e/workflows/sprint-board-visual-indicators.spec.ts`

**Test Categories:**
1. Available Tasks - Visual Distinction
2. My Tasks - Highlighted and Marked
3. Tasks Owned by Others - Show Owner Name
4. Comprehensive Visual Distinction
5. Status-Specific Visual Indicators
6. Accessibility and UX

## Related ADRs
- ADR-0006: Real-time WebSocket Updates (task ownership changes trigger UI updates)

## References
- Acceptance Criteria: AC-8e8e949d-1917-4187-a675-57dd59cb9783
- Component: `apps/web/components/sprint/SprintTaskList.tsx`
- Unit Tests: `apps/web/components/sprint/__tests__/SprintTaskList.visual-indicators.test.tsx`
- E2E Tests: `apps/web/tests/e2e/workflows/sprint-board-visual-indicators.spec.ts`
