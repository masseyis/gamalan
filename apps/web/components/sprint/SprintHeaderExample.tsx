/**
 * SprintHeader Integration Example
 *
 * This example demonstrates how to integrate the SprintHeader component
 * into a sprint tasks page. This file serves as documentation and can be
 * used as a reference when building the actual sprint tasks view.
 *
 * The SprintHeader component satisfies AC5 of the Sprint Tasks View story:
 * - Displays sprint name, start date, end date, and days remaining
 * - Shows progress indicator with percentage of tasks completed
 * - Shows total number of stories in the sprint
 */

'use client'

import { SprintHeader } from './SprintHeader'
import { Sprint } from '@/lib/types/team'
import { Story } from '@/lib/types/story'

interface SprintTasksPageProps {
  sprintId: string
}

/**
 * Example: Sprint Tasks Page with SprintHeader
 *
 * This is a conceptual example showing how to use SprintHeader.
 * In a real implementation, you would:
 * 1. Fetch the sprint data from the API
 * 2. Fetch the stories associated with the sprint (including tasks)
 * 3. Pass the data to SprintHeader
 * 4. Render the task list below the header
 */
export function SprintTasksPageExample({ sprintId }: SprintTasksPageProps) {
  // In a real implementation, use React Query or similar to fetch data
  // const { data: sprint } = useQuery(['sprint', sprintId], () => sprintApi.getSprint(sprintId))
  // const { data: stories } = useQuery(['sprint-stories', sprintId], () => sprintApi.getSprintStories(sprintId))

  // Example data structure
  const sprint: Sprint = {
    id: sprintId,
    teamId: 'team-1',
    name: 'Sprint 1: Core Features',
    goal: 'Deliver authentication and sprint task board',
    status: 'active',
    capacityPoints: 40,
    committedPoints: 30,
    completedPoints: 15,
    startDate: '2025-01-01T00:00:00Z',
    endDate: '2025-01-15T00:00:00Z',
    createdAt: '2024-12-20T00:00:00Z',
    updatedAt: '2024-12-20T00:00:00Z',
  }

  const stories: Story[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      title: 'Implement authentication',
      description: 'User login and registration',
      status: 'inprogress',
      labels: ['backend', 'security'],
      createdAt: '2024-12-20T00:00:00Z',
      updatedAt: '2024-12-20T00:00:00Z',
      tasks: [
        {
          id: 'task-1',
          storyId: 'story-1',
          title: 'Create JWT middleware',
          status: 'completed',
          acceptanceCriteriaRefs: ['ac-1'],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
        },
        {
          id: 'task-2',
          storyId: 'story-1',
          title: 'Build login UI',
          status: 'inprogress',
          acceptanceCriteriaRefs: ['ac-2'],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
        },
      ],
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      title: 'Sprint task board',
      description: 'View and manage sprint tasks',
      status: 'inprogress',
      labels: ['frontend'],
      createdAt: '2024-12-20T00:00:00Z',
      updatedAt: '2024-12-20T00:00:00Z',
      tasks: [
        {
          id: 'task-3',
          storyId: 'story-2',
          title: 'Build SprintHeader component',
          status: 'completed',
          acceptanceCriteriaRefs: ['ac-5'],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
        },
      ],
    },
  ]

  return (
    <div className="container mx-auto py-6">
      {/* Sprint Context Header - satisfies AC5 */}
      <SprintHeader sprint={sprint} stories={stories} />

      {/* Rest of the sprint tasks view would go here */}
      <div className="mt-6">
        <p className="text-muted-foreground text-sm">
          The task list, filters, and grouping functionality would be rendered below the header.
        </p>
      </div>
    </div>
  )
}

/**
 * Integration Notes:
 *
 * 1. Data Fetching:
 *    - Use React Query (TanStack Query) for fetching sprint and stories data
 *    - Consider using SWR or real-time subscriptions for live updates (AC4)
 *
 * 2. API Endpoints Required:
 *    - GET /api/v1/sprints/:sprintId - Fetch sprint details
 *    - GET /api/v1/sprints/:sprintId/stories - Fetch stories with tasks
 *
 * 3. Data Requirements:
 *    - Sprint must include: name, goal, startDate, endDate
 *    - Stories must include their tasks array
 *    - Tasks must have status field for progress calculation
 *
 * 4. Real-time Updates (for AC4):
 *    - Consider using WebSocket or polling to update task status
 *    - SprintHeader will automatically recalculate progress when stories prop changes
 *
 * 5. Loading and Error States:
 *    - Show skeleton/loading state while fetching data
 *    - Handle errors gracefully with retry functionality
 *
 * 6. Responsive Design:
 *    - SprintHeader is responsive and adapts to mobile/tablet/desktop
 *    - Grid layout automatically adjusts from 1 column to 3 columns
 *
 * 7. Accessibility:
 *    - All interactive elements are keyboard accessible
 *    - Screen reader support via semantic HTML and ARIA attributes
 *    - Test with keyboard navigation and screen readers
 */
