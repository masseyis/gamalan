# Sprint Components

This directory contains components for sprint management and visualization.

## Components

### SprintHeader

The `SprintHeader` component displays sprint context information at the top of sprint-related pages.

**Location:** `components/sprint/SprintHeader.tsx`

#### Purpose

Provides sprint context including:
- Sprint name and goal
- Start/end dates with days remaining
- Task completion progress (percentage)
- Total story count
- Visual progress bar

#### Satisfies Acceptance Criteria

- **AC5 (Primary):** Sprint context header display
  - Sprint name ✅
  - Start date ✅
  - End date ✅
  - Days remaining ✅
  - Progress indicator ✅
  - Percentage of tasks completed ✅
  - Total number of stories ✅

#### Usage

```typescript
import { SprintHeader } from '@/components/sprint'

// In your page component
<SprintHeader sprint={sprint} stories={stories} />
```

#### Where to Use

The SprintHeader is designed for pages that display sprint-level information:

1. **Sprint Task Board** (Primary use case)
2. **Sprint Overview/Details**
3. **Sprint Retrospective**

## Documentation

- **Integration Guide:** `INTEGRATION.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`

## Testing

```bash
npm test -- __tests__/components/sprint/SprintHeader.test.tsx
```

Test coverage: **27 tests** (all passing)

## Status

✅ **Production Ready**
