# SprintHeader Integration Guide

## Overview

The `SprintHeader` component displays sprint context information including sprint name, dates, days remaining, progress indicator, and story count. This component satisfies **AC5** of the Sprint Tasks View story.

## Features

✅ Sprint name and goal display
✅ Sprint start/end dates with formatted display
✅ Days remaining calculation (real-time)
✅ Task completion progress with percentage
✅ Total story count
✅ Visual progress bar
✅ Responsive design (1-3 column grid)
✅ Real-time updates via React Query
✅ Comprehensive test coverage (27 tests)

## Component API

```typescript
import { SprintHeader } from '@/components/sprint'
import { Sprint } from '@/lib/types/team'
import { Story } from '@/lib/types/story'

interface SprintHeaderProps {
  sprint: Sprint
  stories: Story[]
}
```

## Data Requirements

### Sprint Object
- `name`: Sprint name (required)
- `goal`: Sprint objective (optional, won't render if empty)
- `startDate`: ISO date string
- `endDate`: ISO date string
- All other Sprint type fields

### Stories Array
- Array of Story objects with populated `tasks` array
- Each task must have `status` field for progress calculation
- Progress calculation: `completedTasks / totalTasks * 100`
- Task is considered completed when `status === 'completed'`

## Integration Examples

### Basic Integration with React Query

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { SprintHeader } from '@/components/sprint'
import { sprintsApi } from '@/lib/api/teams'
import { storiesApi } from '@/lib/api/stories'

export default function SprintTasksPage({ sprintId }: { sprintId: string }) {
  // Fetch sprint data
  const { data: sprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => sprintsApi.getSprint(teamId, sprintId),
  })

  // Fetch stories with tasks
  const { data: stories, isLoading: storiesLoading } = useQuery({
    queryKey: ['sprint-stories', sprintId],
    queryFn: () => storiesApi.getSprintStories(sprintId),
  })

  if (sprintLoading || storiesLoading) {
    return <SprintHeaderSkeleton />
  }

  if (!sprint || !stories) {
    return <ErrorState />
  }

  return (
    <div>
      <SprintHeader sprint={sprint} stories={stories} />
      {/* Rest of your sprint tasks UI */}
    </div>
  )
}
```

### Real-time Updates (AC4)

The component automatically recalculates progress when the `stories` prop changes. To enable real-time updates:

#### Option 1: Polling (Recommended for MVP)

```typescript
const { data: stories } = useQuery({
  queryKey: ['sprint-stories', sprintId],
  queryFn: () => storiesApi.getSprintStories(sprintId),
  refetchInterval: 30000, // Poll every 30 seconds
  refetchOnWindowFocus: true, // Refresh on tab focus
})
```

#### Option 2: WebSocket (Future Enhancement)

```typescript
import { useWebSocket } from '@/hooks/useWebSocket'

export default function SprintTasksPage({ sprintId }: { sprintId: string }) {
  const queryClient = useQueryClient()

  // Subscribe to sprint updates
  useWebSocket(`/sprints/${sprintId}/updates`, (message) => {
    if (message.type === 'task_status_changed') {
      // Invalidate queries to refetch
      queryClient.invalidateQueries(['sprint-stories', sprintId])
    }
  })

  // ... rest of component
}
```

#### Option 3: Server-Sent Events

```typescript
useEffect(() => {
  const eventSource = new EventSource(`/api/sprints/${sprintId}/events`)

  eventSource.addEventListener('task_update', (event) => {
    const data = JSON.parse(event.data)
    queryClient.invalidateQueries(['sprint-stories', sprintId])
  })

  return () => eventSource.close()
}, [sprintId])
```

## Progress Calculation

The component uses `useMemo` for efficient calculation:

```typescript
const taskProgress = useMemo(() => {
  const allTasks = stories.flatMap((story) => story.tasks || [])
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((task) => task.status === 'completed').length
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return { totalTasks, completedTasks, percentage }
}, [stories])
```

### Task Status Mapping

- `available`: Not completed
- `owned`: Not completed
- `inprogress`: Not completed
- `completed`: Completed ✅

## Days Remaining Calculation

```typescript
const daysRemaining = useMemo(() => {
  const endDate = new Date(sprint.endDate)
  const now = new Date()
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays) // Never negative
}, [sprint.endDate])
```

## Responsive Design

The component uses a responsive grid:

```css
grid-cols-1 md:grid-cols-3
```

- **Mobile**: Single column stack
- **Tablet+**: 3-column layout (Dates | Stories | Progress)

## Accessibility

- Semantic HTML with proper heading hierarchy (`<h2>` for sprint name)
- All data has `data-testid` attributes for testing
- ARIA attributes on progress bar (`aria-valuemin`, `aria-valuemax`, `aria-valuenow`)
- Keyboard accessible (no interactive elements in base component)

## Test IDs

For E2E testing, the following test IDs are available:

```typescript
'sprint-header'          // Root container
'sprint-name'           // Sprint title
'sprint-goal'           // Sprint goal (if provided)
'sprint-dates'          // Date range
'days-remaining'        // Days left text
'story-count'           // Number of stories
'task-progress'         // Task completion count
'progress-percentage'   // Percentage text
'progress-bar'          // Progress bar component
```

## Loading States

Create a skeleton component for loading:

```typescript
export function SprintHeaderSkeleton() {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-20 bg-gray-100 animate-pulse rounded" />
            <div className="h-20 bg-gray-100 animate-pulse rounded" />
            <div className="h-20 bg-gray-100 animate-pulse rounded" />
          </div>
          <div className="h-2 bg-gray-100 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
```

## Error Handling

```typescript
if (sprintError || !sprint) {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium">Failed to load sprint</h3>
          <p className="text-muted-foreground mt-2">
            {sprintError instanceof Error ? sprintError.message : 'Unknown error'}
          </p>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Performance Optimization

### Memoization

Both `daysRemaining` and `taskProgress` use `useMemo` to prevent unnecessary recalculations:

```typescript
// Only recalculates when sprint.endDate changes
const daysRemaining = useMemo(() => { /* ... */ }, [sprint.endDate])

// Only recalculates when stories array changes
const taskProgress = useMemo(() => { /* ... */ }, [stories])
```

### React Query Optimization

```typescript
const { data: stories } = useQuery({
  queryKey: ['sprint-stories', sprintId],
  queryFn: () => storiesApi.getSprintStories(sprintId),
  staleTime: 30000, // Consider data fresh for 30s
  gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
})
```

## Testing

Run component tests:

```bash
npm test -- __tests__/components/sprint/SprintHeader.test.tsx
```

### Test Coverage

- ✅ 27 tests passing
- ✅ AC5 compliance tests
- ✅ Edge cases (0 tasks, undefined tasks, negative days)
- ✅ Visual structure tests
- ✅ Accessibility tests
- ✅ Re-rendering and memoization tests

## API Endpoints Required

```typescript
// Fetch sprint details
GET /api/v1/sprints/:sprintId

// Fetch stories with tasks for sprint
GET /api/v1/sprints/:sprintId/stories
```

### Expected Response Structure

```typescript
// Sprint
{
  id: string
  teamId: string
  name: string
  goal: string
  status: 'planning' | 'active' | 'review' | 'completed'
  startDate: string // ISO 8601
  endDate: string   // ISO 8601
  // ... other fields
}

// Stories
[
  {
    id: string
    projectId: string
    title: string
    status: string
    tasks: [
      {
        id: string
        storyId: string
        title: string
        status: 'available' | 'owned' | 'inprogress' | 'completed'
        // ... other fields
      }
    ]
  }
]
```

## Future Enhancements

1. **Real-time Updates**: Implement WebSocket connection for live task status updates
2. **Burndown Chart**: Add visual burndown chart integration
3. **Sprint Health**: Color-coded indicators for sprint health (on track, at risk, behind)
4. **Animations**: Smooth transitions for progress bar updates
5. **Notifications**: Toast notifications when tasks change (AC4)
6. **Story Points**: Support story points in addition to task count

## Related Components

- `Progress`: Radix UI progress bar (`@/components/ui/progress`)
- `Card`: UI card wrapper (`@/components/ui/card`)
- Icons: `Calendar`, `Target`, `TrendingUp` from `lucide-react`

## Troubleshooting

### Progress not updating
- Ensure `stories` prop includes `tasks` array
- Check React Query cache settings
- Verify task `status` field values

### Days remaining shows 0 when sprint is active
- Check sprint `endDate` format (must be ISO 8601)
- Verify timezone handling in date calculations

### Layout breaking on mobile
- Ensure Tailwind CSS is properly configured
- Check for conflicting CSS classes
