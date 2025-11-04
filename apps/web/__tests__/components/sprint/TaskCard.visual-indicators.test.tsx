import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TaskCard } from '@/components/sprint/TaskCard'
import { Task, Story } from '@/lib/types/story'

/**
 * Test suite for AC3: Visual distinction of task ownership
 *
 * Acceptance Criteria 3:
 * Given: I am viewing the sprint task board
 * When: I see the list of tasks
 * Then:
 * - Available tasks (no owner, not completed) should be clearly visually distinguished
 * - My own tasks should be highlighted or marked
 * - Tasks owned by others should show the owner name
 */
describe('TaskCard - AC3: Visual Indicators for Task Availability', () => {
  const mockStory: Story = {
    id: 'story-1',
    projectId: 'project-1',
    title: 'User Authentication Story',
    status: 'inprogress',
    labels: [],
    createdAt: '2024-12-20T00:00:00Z',
    updatedAt: '2024-12-20T00:00:00Z',
  }

  const baseTask: Task = {
    id: 'task-1',
    storyId: 'story-1',
    title: 'Implement login form',
    status: 'available',
    acceptanceCriteriaRefs: ['ac-1'],
    createdAt: '2024-12-20T00:00:00Z',
    updatedAt: '2024-12-20T00:00:00Z',
  }

  describe('Available Tasks - Visual Distinction', () => {
    it('should render available task with dashed border', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      const { container } = render(
        <TaskCard task={availableTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('border-dashed')
    })

    it('should show "Available to claim" text for tasks without owner', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      render(<TaskCard task={availableTask} story={mockStory} isMyTask={false} />)

      expect(screen.getByText('Available to claim')).toBeInTheDocument()
      expect(screen.getByText('Available to claim')).toHaveClass('text-green-600', 'font-medium')
    })

    it('should have gray border color for available tasks', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      const { container } = render(
        <TaskCard task={availableTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-gray-200')
    })

    it('should display Circle icon for available status', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      const { container } = render(
        <TaskCard task={availableTask} story={mockStory} isMyTask={false} />
      )

      // Check for the status icon with gray color
      const statusIcon = container.querySelector('.text-gray-400')
      expect(statusIcon).toBeInTheDocument()
    })

    it('should show Available status badge', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      render(<TaskCard task={availableTask} story={mockStory} isMyTask={false} />)

      const badge = screen.getByText('Available')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-gray-50', 'text-gray-400')
    })

    it('should NOT show "My Task" badge for available tasks', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      render(<TaskCard task={availableTask} story={mockStory} isMyTask={false} />)

      expect(screen.queryByText('My Task')).not.toBeInTheDocument()
    })

    it('should NOT have ring styling for available tasks', () => {
      const availableTask: Task = {
        ...baseTask,
        status: 'available',
        ownerUserId: undefined,
      }

      const { container } = render(
        <TaskCard task={availableTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).not.toHaveClass('ring-2')
      expect(card).not.toHaveClass('ring-blue-500')
    })
  })

  describe('My Tasks - Highlighted and Marked', () => {
    it('should render my task with blue ring highlight', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2')
    })

    it('should display "My Task" badge for owned tasks', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const myTaskBadge = screen.getByText('My Task')
      expect(myTaskBadge).toBeInTheDocument()
      expect(myTaskBadge).toHaveClass('bg-blue-500', 'text-white')
    })

    it('should show "You" as owner for my tasks', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('should have blue border color for owned tasks', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-blue-200')
    })

    it('should show blue status badge for owned tasks', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const badge = screen.getByText('Owned')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-blue-50', 'text-blue-500')
    })

    it('should highlight in-progress tasks owned by current user', () => {
      const myInProgressTask: Task = {
        ...baseTask,
        status: 'inprogress',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(
        <TaskCard task={myInProgressTask} story={mockStory} isMyTask={true} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2')

      expect(screen.getByText('My Task')).toBeInTheDocument()
    })

    it('should set data-my-task attribute to true for owned tasks', () => {
      const myTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveAttribute('data-my-task', 'true')
    })
  })

  describe('Tasks Owned by Others - Show Owner Name', () => {
    it('should show owner ID for tasks owned by others', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id-12345678',
      }

      render(<TaskCard task={othersTask} story={mockStory} isMyTask={false} />)

      // Should show "Owned by" followed by truncated user ID (first 8 chars)
      expect(screen.getByText(/Owned by other-us/)).toBeInTheDocument()
    })

    it('should NOT display "My Task" badge for tasks owned by others', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id',
      }

      render(<TaskCard task={othersTask} story={mockStory} isMyTask={false} />)

      expect(screen.queryByText('My Task')).not.toBeInTheDocument()
    })

    it('should NOT have ring highlight for tasks owned by others', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id',
      }

      const { container } = render(
        <TaskCard task={othersTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).not.toHaveClass('ring-2')
      expect(card).not.toHaveClass('ring-blue-500')
    })

    it('should display User icon for tasks with owner', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id',
      }

      const { container } = render(
        <TaskCard task={othersTask} story={mockStory} isMyTask={false} />
      )

      // User icon should be present in the owner section
      const userIcons = container.querySelectorAll('svg')
      expect(userIcons.length).toBeGreaterThan(0)
    })

    it('should have blue border for owned status regardless of owner', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id',
      }

      const { container } = render(
        <TaskCard task={othersTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-blue-200')
    })

    it('should set data-my-task attribute to false for others tasks', () => {
      const othersTask: Task = {
        ...baseTask,
        status: 'owned',
        ownerUserId: 'other-user-id',
      }

      const { container } = render(
        <TaskCard task={othersTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveAttribute('data-my-task', 'false')
    })
  })

  describe('Completed Tasks - Visual State', () => {
    it('should render completed task with green styling', () => {
      const completedTask: Task = {
        ...baseTask,
        status: 'completed',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(
        <TaskCard task={completedTask} story={mockStory} isMyTask={true} />
      )

      const badge = screen.getByText('Completed')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-green-50', 'text-green-500')

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-green-200')
    })

    it('should still highlight completed tasks if owned by current user', () => {
      const myCompletedTask: Task = {
        ...baseTask,
        status: 'completed',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(
        <TaskCard task={myCompletedTask} story={mockStory} isMyTask={true} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('ring-2', 'ring-blue-500')

      expect(screen.getByText('My Task')).toBeInTheDocument()
    })

    it('should show ownership status based on ownerUserId, not completion status', () => {
      // Completed task without owner
      const completedTaskNoOwner: Task = {
        ...baseTask,
        status: 'completed',
        ownerUserId: undefined,
      }

      const { rerender } = render(
        <TaskCard task={completedTaskNoOwner} story={mockStory} isMyTask={false} />
      )

      // Current implementation shows "Available to claim" when no owner, regardless of status
      expect(screen.getByText('Available to claim')).toBeInTheDocument()

      // Completed task with owner
      const completedTaskWithOwner: Task = {
        ...baseTask,
        status: 'completed',
        ownerUserId: 'some-user-id',
      }

      rerender(<TaskCard task={completedTaskWithOwner} story={mockStory} isMyTask={false} />)

      // Should NOT show "Available to claim" when there is an owner
      expect(screen.queryByText('Available to claim')).not.toBeInTheDocument()
      expect(screen.getByText(/Owned by/)).toBeInTheDocument()
    })
  })

  describe('In Progress Tasks - Visual State', () => {
    it('should render in-progress task with yellow styling', () => {
      const inProgressTask: Task = {
        ...baseTask,
        status: 'inprogress',
        ownerUserId: 'current-user-id',
      }

      render(<TaskCard task={inProgressTask} story={mockStory} isMyTask={true} />)

      const badge = screen.getByText('In Progress')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-yellow-50', 'text-yellow-500')
    })

    it('should highlight my in-progress tasks', () => {
      const myInProgressTask: Task = {
        ...baseTask,
        status: 'inprogress',
        ownerUserId: 'current-user-id',
      }

      const { container } = render(
        <TaskCard task={myInProgressTask} story={mockStory} isMyTask={true} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('ring-2', 'ring-blue-500')
      expect(screen.getByText('My Task')).toBeInTheDocument()
    })

    it('should have yellow border for in-progress tasks', () => {
      const inProgressTask: Task = {
        ...baseTask,
        status: 'inprogress',
        ownerUserId: 'other-user-id',
      }

      const { container } = render(
        <TaskCard task={inProgressTask} story={mockStory} isMyTask={false} />
      )

      const card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-yellow-200')
    })
  })

  describe('Comprehensive Visual Distinction Matrix', () => {
    it('should clearly distinguish between all three task types visually', () => {
      const availableTask: Task = { ...baseTask, status: 'available', ownerUserId: undefined }
      const myTask: Task = { ...baseTask, id: 'task-2', status: 'owned', ownerUserId: 'user-1' }
      const othersTask: Task = {
        ...baseTask,
        id: 'task-3',
        status: 'owned',
        ownerUserId: 'user-2',
      }

      const { rerender, container } = render(
        <TaskCard task={availableTask} story={mockStory} isMyTask={false} />
      )

      // Available task characteristics
      let card = container.querySelector('[data-testid="task-card-task-1"]')
      expect(card).toHaveClass('border-dashed') // Unique to available
      expect(card).not.toHaveClass('ring-2') // No ring
      expect(screen.getByText('Available to claim')).toBeInTheDocument()

      // My task characteristics
      rerender(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)
      card = container.querySelector('[data-testid="task-card-task-2"]')
      expect(card).toHaveClass('ring-2', 'ring-blue-500') // Unique to my tasks
      expect(card).not.toHaveClass('border-dashed') // No dashed border
      expect(screen.getByText('My Task')).toBeInTheDocument()

      // Others task characteristics
      rerender(<TaskCard task={othersTask} story={mockStory} isMyTask={false} />)
      card = container.querySelector('[data-testid="task-card-task-3"]')
      expect(card).not.toHaveClass('ring-2') // No ring
      expect(card).not.toHaveClass('border-dashed') // No dashed border
      expect(screen.queryByText('My Task')).not.toBeInTheDocument()
      expect(screen.getByText(/Owned by/)).toBeInTheDocument()
    })
  })

  describe('Task Card Test IDs', () => {
    it('should include task ID in data-testid for E2E testing', () => {
      const task: Task = {
        ...baseTask,
        id: 'unique-task-123',
      }

      const { container } = render(<TaskCard task={task} story={mockStory} isMyTask={false} />)

      const card = container.querySelector('[data-testid="task-card-unique-task-123"]')
      expect(card).toBeInTheDocument()
    })

    it('should include data-my-task attribute for filtering', () => {
      const myTask: Task = {
        ...baseTask,
        ownerUserId: 'current-user-id',
      }

      const { container } = render(<TaskCard task={myTask} story={mockStory} isMyTask={true} />)

      const card = container.querySelector('[data-my-task="true"]')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle task with no description gracefully', () => {
      const taskWithoutDescription: Task = {
        ...baseTask,
        description: undefined,
      }

      render(<TaskCard task={taskWithoutDescription} story={mockStory} isMyTask={false} />)

      expect(screen.getByText('Implement login form')).toBeInTheDocument()
    })

    it('should handle task with no AC refs', () => {
      const taskWithoutACs: Task = {
        ...baseTask,
        acceptanceCriteriaRefs: [],
      }

      render(<TaskCard task={taskWithoutACs} story={mockStory} isMyTask={false} />)

      expect(screen.queryByText(/AC/)).not.toBeInTheDocument()
    })

    it('should truncate long task IDs in badge', () => {
      const taskWithLongId: Task = {
        ...baseTask,
        id: 'very-long-task-id-that-should-be-truncated-12345',
      }

      render(<TaskCard task={taskWithLongId} story={mockStory} isMyTask={false} />)

      // Should show first 8 characters
      expect(screen.getByText('very-lon')).toBeInTheDocument()
    })

    it('should show AC count correctly for multiple ACs', () => {
      const taskWithMultipleACs: Task = {
        ...baseTask,
        acceptanceCriteriaRefs: ['ac-1', 'ac-2', 'ac-3'],
      }

      render(<TaskCard task={taskWithMultipleACs} story={mockStory} isMyTask={false} />)

      expect(screen.getByText('3 ACs')).toBeInTheDocument()
    })

    it('should show singular AC for single acceptance criteria', () => {
      const taskWithSingleAC: Task = {
        ...baseTask,
        acceptanceCriteriaRefs: ['ac-1'],
      }

      render(<TaskCard task={taskWithSingleAC} story={mockStory} isMyTask={false} />)

      expect(screen.getByText('1 AC')).toBeInTheDocument()
    })
  })
})
