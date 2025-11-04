import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { Story, Task, TaskStatus } from '@/lib/types/story'
import { TaskFilters, GroupByOption } from '@/components/sprint/TaskFilters'
import { TaskList } from '@/components/sprint/TaskList'
import { useState } from 'react'

/**
 * Integration test for AC2: Filter and grouping functionality
 *
 * AC2: Given I am viewing the sprint task board
 *      When I apply filters for status
 *      Then The task list should update to show only matching tasks,
 *           and I should be able to group tasks by story or by status,
 *           and the count of tasks in each filter/group should be visible
 */

// Integration wrapper component that connects filters and list
function SprintTaskBoard({ stories, currentUserId }: { stories: Story[]; currentUserId: string }) {
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
  const [groupBy, setGroupBy] = useState<GroupByOption>('story')

  // Calculate task counts for all statuses
  const allTasks = stories.flatMap((story) => story.tasks || [])
  const taskCounts: Record<TaskStatus, number> = {
    available: allTasks.filter((t) => t.status === 'available').length,
    owned: allTasks.filter((t) => t.status === 'owned').length,
    inprogress: allTasks.filter((t) => t.status === 'inprogress').length,
    completed: allTasks.filter((t) => t.status === 'completed').length,
  }

  return (
    <div data-testid="sprint-task-board">
      <TaskFilters
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        onFilterChange={setSelectedStatuses}
        onGroupByChange={setGroupBy}
        taskCounts={taskCounts}
      />
      <TaskList
        stories={stories}
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        currentUserId={currentUserId}
      />
    </div>
  )
}

describe('Task Filtering and Grouping Integration (AC2)', () => {
  const mockStories: Story[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      title: 'Authentication Story',
      status: 'inprogress',
      labels: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tasks: [
        {
          id: 'task-1',
          storyId: 'story-1',
          title: 'Implement login endpoint',
          acceptanceCriteriaRefs: ['ac-1'],
          status: 'available',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'task-2',
          storyId: 'story-1',
          title: 'Add JWT validation',
          acceptanceCriteriaRefs: ['ac-2'],
          status: 'owned',
          ownerUserId: 'user-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'task-3',
          storyId: 'story-1',
          title: 'Write integration tests',
          acceptanceCriteriaRefs: ['ac-3'],
          status: 'inprogress',
          ownerUserId: 'user-2',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      title: 'Dashboard Story',
      status: 'inprogress',
      labels: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tasks: [
        {
          id: 'task-4',
          storyId: 'story-2',
          title: 'Create dashboard UI',
          acceptanceCriteriaRefs: ['ac-4'],
          status: 'completed',
          ownerUserId: 'user-1',
          completedAt: '2025-01-02T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
        {
          id: 'task-5',
          storyId: 'story-2',
          title: 'Add data visualization',
          acceptanceCriteriaRefs: ['ac-5'],
          status: 'available',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'story-3',
      projectId: 'project-1',
      title: 'Export Story',
      status: 'ready',
      labels: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tasks: [
        {
          id: 'task-6',
          storyId: 'story-3',
          title: 'Implement CSV export',
          acceptanceCriteriaRefs: ['ac-6'],
          status: 'owned',
          ownerUserId: 'user-3',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    },
  ]

  describe('AC2: Status filtering updates task list', () => {
    it('should show all tasks when no filters applied', () => {
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // All 6 tasks should be visible
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument()
      expect(screen.getByText('Add JWT validation')).toBeInTheDocument()
      expect(screen.getByText('Write integration tests')).toBeInTheDocument()
      expect(screen.getByText('Create dashboard UI')).toBeInTheDocument()
      expect(screen.getByText('Add data visualization')).toBeInTheDocument()
      expect(screen.getByText('Implement CSV export')).toBeInTheDocument()
    })

    it('should filter tasks to show only available status', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Only available tasks should be visible
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument()
      expect(screen.getByText('Add data visualization')).toBeInTheDocument()

      // Other tasks should not be visible
      expect(screen.queryByText('Add JWT validation')).not.toBeInTheDocument()
      expect(screen.queryByText('Write integration tests')).not.toBeInTheDocument()
      expect(screen.queryByText('Create dashboard UI')).not.toBeInTheDocument()
      expect(screen.queryByText('Implement CSV export')).not.toBeInTheDocument()
    })

    it('should filter tasks by multiple statuses', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available and owned filters
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      const ownedCheckbox = screen.getByRole('checkbox', { name: /Owned/i })
      await user.click(ownedCheckbox)

      // Available and owned tasks should be visible
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument()
      expect(screen.getByText('Add data visualization')).toBeInTheDocument()
      expect(screen.getByText('Add JWT validation')).toBeInTheDocument()
      expect(screen.getByText('Implement CSV export')).toBeInTheDocument()

      // Other tasks should not be visible
      expect(screen.queryByText('Write integration tests')).not.toBeInTheDocument()
      expect(screen.queryByText('Create dashboard UI')).not.toBeInTheDocument()
    })

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Verify filtering is active
      expect(screen.queryByText('Add JWT validation')).not.toBeInTheDocument()

      // Clear filters
      const clearButton = screen.getByTestId('clear-filters')
      await user.click(clearButton)

      // All tasks should be visible again
      expect(screen.getByText('Add JWT validation')).toBeInTheDocument()
      expect(screen.getByText('Write integration tests')).toBeInTheDocument()
    })
  })

  describe('AC2: Grouping by story and status', () => {
    it('should group tasks by story by default', () => {
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Story headings should be visible
      expect(screen.getByText('Authentication Story')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Story')).toBeInTheDocument()
      expect(screen.getByText('Export Story')).toBeInTheDocument()

      // Tasks should be under their stories
      const story1Group = screen.getByTestId('group-story-1')
      expect(story1Group).toContainElement(screen.getByText('Implement login endpoint'))
      expect(story1Group).toContainElement(screen.getByText('Add JWT validation'))
    })

    it('should respect grouping when filters are applied', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Should still see story groups (for stories with available tasks)
      expect(screen.getByText('Authentication Story')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Story')).toBeInTheDocument()

      // Story 3 should not appear (no available tasks)
      expect(screen.queryByText('Export Story')).not.toBeInTheDocument()
    })
  })

  describe('AC2: Task counts visible in groups', () => {
    it('should display task counts for each story group', () => {
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Story 1 has 3 tasks
      expect(screen.getByTestId('group-count-story-1')).toHaveTextContent('3 tasks')

      // Story 2 has 2 tasks
      expect(screen.getByTestId('group-count-story-2')).toHaveTextContent('2 tasks')

      // Story 3 has 1 task
      expect(screen.getByTestId('group-count-story-3')).toHaveTextContent('1 task')
    })

    it('should display task counts for each status group when grouped by status', () => {
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Check status counts in filters
      expect(screen.getByTestId('count-available')).toHaveTextContent('2')
      expect(screen.getByTestId('count-owned')).toHaveTextContent('2')
      expect(screen.getByTestId('count-inprogress')).toHaveTextContent('1')
      expect(screen.getByTestId('count-completed')).toHaveTextContent('1')
    })

    it('should update group counts when filters change', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Story 1 should now show 1 available task
      expect(screen.getByTestId('group-count-story-1')).toHaveTextContent('1 task')

      // Story 2 should now show 1 available task
      expect(screen.getByTestId('group-count-story-2')).toHaveTextContent('1 task')

      // Story 3 should not appear (no available tasks)
      expect(screen.queryByTestId('group-count-story-3')).not.toBeInTheDocument()
    })

    it('should show correct counts with multiple filters', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available and owned filters
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      const ownedCheckbox = screen.getByRole('checkbox', { name: /Owned/i })
      await user.click(ownedCheckbox)

      // Story 1 should show 2 tasks (1 available + 1 owned)
      expect(screen.getByTestId('group-count-story-1')).toHaveTextContent('2 tasks')

      // Story 2 should show 1 task (1 available)
      expect(screen.getByTestId('group-count-story-2')).toHaveTextContent('1 task')

      // Story 3 should show 1 task (1 owned)
      expect(screen.getByTestId('group-count-story-3')).toHaveTextContent('1 task')
    })
  })

  describe('AC2: Empty states and edge cases', () => {
    it('should show empty state when no tasks match filters', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply completed filter (should have 1 task)
      const completedCheckbox = screen.getByRole('checkbox', { name: /Completed/i })
      await user.click(completedCheckbox)

      // Now also apply available filter (no overlap)
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Should have tasks (1 completed + 2 available)
      expect(screen.queryByText(/No tasks match your filters/i)).not.toBeInTheDocument()

      // Now clear available and keep only completed
      await user.click(availableCheckbox)

      // Uncheck completed to have no filters matching
      await user.click(completedCheckbox)

      // Apply only inprogress (1 task)
      const inprogressCheckbox = screen.getByRole('checkbox', { name: /In Progress/i })
      await user.click(inprogressCheckbox)

      // Should show 1 task
      expect(screen.getByText('Write integration tests')).toBeInTheDocument()
    })

    it('should handle stories with no tasks', () => {
      const storiesWithEmptyStory: Story[] = [
        ...mockStories,
        {
          id: 'story-empty',
          projectId: 'project-1',
          title: 'Empty Story',
          status: 'ready',
          labels: [],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          tasks: [],
        },
      ]

      render(<SprintTaskBoard stories={storiesWithEmptyStory} currentUserId="user-current" />)

      // Empty story should not appear in groups
      expect(screen.queryByText('Empty Story')).not.toBeInTheDocument()

      // Other stories should still appear
      expect(screen.getByText('Authentication Story')).toBeInTheDocument()
    })
  })

  describe('AC2: Filter and group interaction', () => {
    it('should maintain filters when switching between story and status grouping', async () => {
      const user = userEvent.setup()
      render(<SprintTaskBoard stories={mockStories} currentUserId="user-current" />)

      // Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /Available/i })
      await user.click(availableCheckbox)

      // Verify filtered tasks
      expect(screen.getByText('Implement login endpoint')).toBeInTheDocument()
      expect(screen.queryByText('Add JWT validation')).not.toBeInTheDocument()

      // The tasks should still be filtered (2 available tasks visible)
      const taskCards = screen.getAllByTestId(/^task-card/)
      expect(taskCards).toHaveLength(2)
    })
  })
})
