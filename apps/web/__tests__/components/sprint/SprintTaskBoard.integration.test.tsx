import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SprintTaskFilters, GroupByOption } from '@/components/sprint/SprintTaskFilters'
import { SprintTaskList } from '@/components/sprint/SprintTaskList'
import { Story, TaskStatus } from '@/lib/types/story'
import { useState } from 'react'

/**
 * Integration test for Sprint Task Board filtering and grouping functionality.
 *
 * This test validates AC2:
 * - Filter tasks by status (multiple selection)
 * - Group tasks by story or status
 * - Display task counts for each filter/group
 */

// Test component that integrates filters and list
function SprintTaskBoardIntegration({
  stories,
  currentUserId
}: {
  stories: Story[]
  currentUserId?: string
}) {
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
  const [groupBy, setGroupBy] = useState<GroupByOption>('story')

  // Calculate task counts
  const taskCounts = {
    available: stories.flatMap(s => s.tasks || []).filter(t => t.status === 'available').length,
    owned: stories.flatMap(s => s.tasks || []).filter(t => t.status === 'owned').length,
    inprogress: stories.flatMap(s => s.tasks || []).filter(t => t.status === 'inprogress').length,
    completed: stories.flatMap(s => s.tasks || []).filter(t => t.status === 'completed').length,
  }

  return (
    <div data-testid="sprint-task-board-integration">
      <SprintTaskFilters
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        onFilterChange={setSelectedStatuses}
        onGroupChange={setGroupBy}
        taskCounts={taskCounts}
      />
      <SprintTaskList
        stories={stories}
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        currentUserId={currentUserId}
      />
    </div>
  )
}

describe('SprintTaskBoard Integration - AC2: Filtering and Grouping', () => {
  let mockStories: Story[]

  beforeEach(() => {
    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'User Authentication',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: 'Create login form',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-2',
            storyId: 'story-1',
            title: 'Implement JWT',
            status: 'inprogress',
            ownerUserId: 'user-1',
            acceptanceCriteriaRefs: ['ac-1', 'ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-3',
            storyId: 'story-1',
            title: 'Write tests',
            status: 'available',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
        ],
      } as Story,
      {
        id: 'story-2',
        projectId: 'project-1',
        title: 'Dashboard Widgets',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-4',
            storyId: 'story-2',
            title: 'Create widget components',
            status: 'owned',
            ownerUserId: 'user-2',
            acceptanceCriteriaRefs: ['ac-3'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-5',
            storyId: 'story-2',
            title: 'Add widget data',
            status: 'available',
            acceptanceCriteriaRefs: ['ac-3'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
        ],
      } as Story,
    ]
  })

  describe('AC2.1: Filter by status updates task list', () => {
    it('should filter task list when a status filter is selected', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Initially all tasks should be visible
      expect(screen.getByText('Create login form')).toBeInTheDocument()
      expect(screen.getByText('Implement JWT')).toBeInTheDocument()
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Create widget components')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()

      // Filter by available status
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Only available tasks should be visible
      expect(screen.queryByText('Create login form')).not.toBeInTheDocument()
      expect(screen.queryByText('Implement JWT')).not.toBeInTheDocument()
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.queryByText('Create widget components')).not.toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()
    })

    it('should support multiple status filters', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Select available and completed
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })

      fireEvent.click(availableCheckbox)
      fireEvent.click(completedCheckbox)

      // Should show available and completed tasks
      expect(screen.getByText('Create login form')).toBeInTheDocument() // completed
      expect(screen.queryByText('Implement JWT')).not.toBeInTheDocument() // inprogress
      expect(screen.getByText('Write tests')).toBeInTheDocument() // available
      expect(screen.queryByText('Create widget components')).not.toBeInTheDocument() // owned
      expect(screen.getByText('Add widget data')).toBeInTheDocument() // available
    })

    it('should show no results message when filters match nothing', () => {
      const storiesWithNoCompleted: Story[] = [
        {
          ...mockStories[0],
          tasks: [
            {
              id: 'task-1',
              storyId: 'story-1',
              title: 'Available task',
              status: 'available',
              acceptanceCriteriaRefs: [],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
          ],
        },
      ]

      render(<SprintTaskBoardIntegration stories={storiesWithNoCompleted} currentUserId="user-1" />)

      // Filter by completed (which doesn't exist)
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })
      fireEvent.click(completedCheckbox)

      expect(screen.getByText(/no tasks match the selected filters/i)).toBeInTheDocument()
    })
  })

  describe('AC2.2: Group by story or status', () => {
    it('should group tasks by story by default', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Story groups should be visible
      expect(screen.getByText('User Authentication')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument()

      // Story 1 should show 3 tasks
      const story1Group = screen.getByTestId('story-group-story-1')
      expect(within(story1Group).getByText('3 tasks')).toBeInTheDocument()

      // Story 2 should show 2 tasks
      const story2Group = screen.getByTestId('story-group-story-2')
      expect(within(story2Group).getByText('2 tasks')).toBeInTheDocument()
    })

    it('should switch to group by status when status option is selected', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Switch to group by status
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Status groups should be visible
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-owned')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-inprogress')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()
    })

    it('should maintain filters when switching grouping mode', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Apply filter for available
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Initially grouped by story - should show 2 available tasks
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()

      // Switch to group by status
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Should still show same filtered tasks, now grouped by status
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()

      // Only available status group should be visible
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.queryByTestId('status-group-owned')).not.toBeInTheDocument()
    })
  })

  describe('AC2.3: Task counts are visible', () => {
    it('should display counts in filter controls', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      const filters = screen.getByTestId('sprint-task-filters')

      // Check counts in the filter section
      expect(within(filters).getByText('2')).toBeInTheDocument() // 2 available

      // Check that there are multiple "1" counts (for owned, inprogress, completed)
      const oneCountBadges = within(filters).getAllByText('1')
      expect(oneCountBadges.length).toBeGreaterThanOrEqual(3) // At least 3 statuses with count of 1
    })

    it('should display counts in group headers (story grouping)', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Story 1 has 3 tasks
      const story1Group = screen.getByTestId('story-group-story-1')
      expect(within(story1Group).getByText('3 tasks')).toBeInTheDocument()

      // Story 2 has 2 tasks
      const story2Group = screen.getByTestId('story-group-story-2')
      expect(within(story2Group).getByText('2 tasks')).toBeInTheDocument()
    })

    it('should display counts in group headers (status grouping)', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Switch to status grouping
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Available should show 2 tasks
      const availableGroup = screen.getByTestId('status-group-available')
      expect(within(availableGroup).getByText('2 tasks')).toBeInTheDocument()

      // Owned, inprogress, completed should each show 1 task
      const ownedGroup = screen.getByTestId('status-group-owned')
      expect(within(ownedGroup).getByText('1 task')).toBeInTheDocument()
    })

    it('should update counts when filters are applied', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Filter by available
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Both stories should now show filtered counts
      const story1Group = screen.getByTestId('story-group-story-1')
      expect(within(story1Group).getByText('1 task')).toBeInTheDocument()

      const story2Group = screen.getByTestId('story-group-story-2')
      expect(within(story2Group).getByText('1 task')).toBeInTheDocument()
    })
  })

  describe('AC2.4: Clear filters functionality', () => {
    it('should clear all filters when clear button is clicked', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Apply multiple filters
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })

      fireEvent.click(availableCheckbox)
      fireEvent.click(completedCheckbox)

      // Verify filters are applied (3 tasks visible: 2 available + 1 completed)
      expect(screen.queryByText('Implement JWT')).not.toBeInTheDocument()
      expect(screen.queryByText('Create widget components')).not.toBeInTheDocument()

      // Clear filters
      const clearButton = screen.getByText(/clear filters/i)
      fireEvent.click(clearButton)

      // All tasks should be visible again
      expect(screen.getByText('Create login form')).toBeInTheDocument()
      expect(screen.getByText('Implement JWT')).toBeInTheDocument()
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Create widget components')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()
    })
  })

  describe('AC2: Complete workflow integration', () => {
    it('should handle complete filter and group workflow', () => {
      render(<SprintTaskBoardIntegration stories={mockStories} currentUserId="user-1" />)

      // Step 1: Verify initial state - grouped by story, all tasks visible
      expect(screen.getByText('User Authentication')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument()
      expect(screen.getAllByText(/task/).length).toBeGreaterThan(0)

      // Step 2: Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Should show 2 available tasks
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()
      expect(screen.queryByText('Implement JWT')).not.toBeInTheDocument()

      // Step 3: Add completed filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })
      fireEvent.click(completedCheckbox)

      // Should show 3 tasks (2 available + 1 completed)
      expect(screen.getByText('Create login form')).toBeInTheDocument()
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Add widget data')).toBeInTheDocument()

      // Step 4: Switch to status grouping
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Should still show same tasks but grouped by status
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()
      expect(screen.queryByTestId('status-group-inprogress')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-group-owned')).not.toBeInTheDocument()

      // Step 5: Clear filters
      const clearButton = screen.getByText(/clear filters/i)
      fireEvent.click(clearButton)

      // All status groups should now be visible
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-owned')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-inprogress')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()

      // Step 6: Switch back to story grouping
      const storyRadio = screen.getByRole('radio', { name: /group by story/i })
      fireEvent.click(storyRadio)

      // Should be back to initial state
      expect(screen.getByText('User Authentication')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument()

      const story1Group = screen.getByTestId('story-group-story-1')
      expect(within(story1Group).getByText('3 tasks')).toBeInTheDocument()
    })
  })
})
