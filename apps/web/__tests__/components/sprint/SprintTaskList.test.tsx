import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SprintTaskList } from '@/components/sprint/SprintTaskList'
import { Story, Task, TaskStatus } from '@/lib/types/story'

describe('SprintTaskList', () => {
  let mockStories: Story[]

  beforeEach(() => {
    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'Implement user authentication',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: '[Frontend] Create login form',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-2',
            storyId: 'story-1',
            title: '[Backend] Implement JWT auth',
            status: 'inprogress',
            ownerUserId: 'user-1',
            acceptanceCriteriaRefs: ['ac-1', 'ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-3',
            storyId: 'story-1',
            title: '[QA] Write auth tests',
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
        title: 'Add dashboard widgets',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-4',
            storyId: 'story-2',
            title: '[Frontend] Create widget components',
            status: 'owned',
            ownerUserId: 'user-2',
            acceptanceCriteriaRefs: ['ac-3'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
        ],
      } as Story,
    ]
  })

  describe('AC2: Filtering by status', () => {
    it('should display all tasks when no filters are applied', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByText('[Frontend] Create login form')).toBeInTheDocument()
      expect(screen.getByText('[Backend] Implement JWT auth')).toBeInTheDocument()
      expect(screen.getByText('[QA] Write auth tests')).toBeInTheDocument()
      expect(screen.getByText('[Frontend] Create widget components')).toBeInTheDocument()
    })

    it('should filter tasks by available status', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['available']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.queryByText('[Frontend] Create login form')).not.toBeInTheDocument()
      expect(screen.queryByText('[Backend] Implement JWT auth')).not.toBeInTheDocument()
      expect(screen.getByText('[QA] Write auth tests')).toBeInTheDocument()
      expect(screen.queryByText('[Frontend] Create widget components')).not.toBeInTheDocument()
    })

    it('should filter tasks by completed status', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['completed']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByText('[Frontend] Create login form')).toBeInTheDocument()
      expect(screen.queryByText('[Backend] Implement JWT auth')).not.toBeInTheDocument()
      expect(screen.queryByText('[QA] Write auth tests')).not.toBeInTheDocument()
      expect(screen.queryByText('[Frontend] Create widget components')).not.toBeInTheDocument()
    })

    it('should filter tasks by multiple statuses', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['available', 'owned']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.queryByText('[Frontend] Create login form')).not.toBeInTheDocument()
      expect(screen.queryByText('[Backend] Implement JWT auth')).not.toBeInTheDocument()
      expect(screen.getByText('[QA] Write auth tests')).toBeInTheDocument()
      expect(screen.getByText('[Frontend] Create widget components')).toBeInTheDocument()
    })

    it('should not display stories with no matching tasks', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['completed']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Story 1 should be visible (has completed task)
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument()

      // Story 2 should not be visible (no completed tasks)
      expect(screen.queryByText('Add dashboard widgets')).not.toBeInTheDocument()
    })
  })

  describe('AC2: Grouping by story', () => {
    it('should group tasks by story', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument()
      expect(screen.getByText('Add dashboard widgets')).toBeInTheDocument()
    })

    it('should display task count for each story', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Story 1 should show 3 tasks
      expect(screen.getByText('3 tasks')).toBeInTheDocument()

      // Story 2 should show 1 task
      expect(screen.getByText('1 task')).toBeInTheDocument()
    })

    it('should display filtered task count when filters are applied', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['available', 'owned']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Both stories should show 1 task each
      const taskCountElements = screen.getAllByText('1 task')
      expect(taskCountElements).toHaveLength(2)
    })

    it('should maintain story order', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      const storyHeaders = container.querySelectorAll('[data-testid^="story-group-"]')
      expect(storyHeaders[0]).toHaveTextContent('Implement user authentication')
      expect(storyHeaders[1]).toHaveTextContent('Add dashboard widgets')
    })
  })

  describe('AC2: Grouping by status', () => {
    it('should group tasks by status', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId="user-1"
        />
      )

      // Check for status group headings by data-testid
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-owned')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-inprogress')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()
    })

    it('should display task count for each status group', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId="user-1"
        />
      )

      // Should show counts for each status
      const taskElements = screen.getAllByText(/\d+ task/)
      expect(taskElements.length).toBeGreaterThanOrEqual(4)
    })

    it('should only show status groups that have tasks', () => {
      const singleStatusStories: Story[] = [
        {
          ...mockStories[0],
          tasks: [
            {
              id: 'task-1',
              storyId: 'story-1',
              title: 'Task 1',
              status: 'available',
              acceptanceCriteriaRefs: [],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
          ],
        },
      ]

      render(
        <SprintTaskList
          stories={singleStatusStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId="user-1"
        />
      )

      // Check by data-testid to avoid ambiguity
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.queryByTestId('status-group-owned')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-group-inprogress')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-group-completed')).not.toBeInTheDocument()
    })

    it('should maintain status order: available, owned, inprogress, completed', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId="user-1"
        />
      )

      const statusGroups = container.querySelectorAll('[data-testid^="status-group-"]')
      const statusOrder = Array.from(statusGroups).map((el) => el.getAttribute('data-testid'))

      expect(statusOrder).toEqual([
        'status-group-available',
        'status-group-owned',
        'status-group-inprogress',
        'status-group-completed',
      ])
    })
  })

  describe('AC1: Task display requirements', () => {
    it('should display all required task information', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Task title
      expect(screen.getByText('[Backend] Implement JWT auth')).toBeInTheDocument()

      // Task status (visual indicator or badge)
      const taskCard = screen.getByTestId('task-card-task-2')
      expect(taskCard).toBeInTheDocument()

      // Parent story
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument()
    })

    it('should display task ID', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Task IDs should be displayed or available via data-testid
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument()
    })

    it('should display acceptance criteria references count', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Task with 2 AC refs
      const task2 = screen.getByTestId('task-card-task-2')
      expect(task2).toHaveTextContent('2')
    })

    it('should display owner when task is owned', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Task 2 has owner user-1 (current user, so should display "You")
      const task2 = screen.getByTestId('task-card-task-2')
      expect(task2).toHaveTextContent(/You/i)
    })

    it('should not display owner when task is available', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Task 3 has no owner
      const task3 = screen.getByTestId('task-card-task-3')
      expect(task3).not.toHaveTextContent(/user-/)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty stories array', () => {
      render(
        <SprintTaskList
          stories={[]}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
    })

    it('should handle stories with no tasks', () => {
      const storiesWithNoTasks: Story[] = [
        {
          ...mockStories[0],
          tasks: [],
        },
      ]

      render(
        <SprintTaskList
          stories={storiesWithNoTasks}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
    })

    it('should handle filter resulting in no tasks', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={['available']}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      // Story 2 has no available tasks
      expect(screen.queryByText('Add dashboard widgets')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper test ids', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="user-1"
        />
      )

      expect(screen.getByTestId('sprint-task-list')).toBeInTheDocument()
      expect(screen.getByTestId('story-group-story-1')).toBeInTheDocument()
      expect(screen.getByTestId('story-group-story-2')).toBeInTheDocument()
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
    })
  })
})
