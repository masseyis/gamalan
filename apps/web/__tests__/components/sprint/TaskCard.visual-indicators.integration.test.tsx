import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { SprintTaskList } from '@/components/sprint/SprintTaskList'
import { Story, Task } from '@/lib/types/story'

/**
 * Integration test for AC3: Visual distinction of task ownership in the full Sprint Task Board
 *
 * Acceptance Criteria 3:
 * Given: I am viewing the sprint task board
 * When: I see the list of tasks
 * Then:
 * - Available tasks (no owner, not completed) should be clearly visually distinguished
 * - My own tasks should be highlighted or marked
 * - Tasks owned by others should show the owner name
 *
 * This test verifies that visual indicators work correctly in the context of the
 * full task board with multiple stories and tasks.
 */
describe('Sprint Task Board - AC3: Visual Indicators Integration', () => {
  let mockStories: Story[]
  const currentUserId = 'current-user-123'

  beforeEach(() => {
    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'User Authentication Story',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          // Available task - no owner, not completed
          {
            id: 'available-task-1',
            storyId: 'story-1',
            title: 'Available Task - Write Documentation',
            status: 'available',
            ownerUserId: undefined,
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          // My task - owned by current user
          {
            id: 'my-task-1',
            storyId: 'story-1',
            title: 'My Task - Implement Login',
            status: 'owned',
            ownerUserId: currentUserId,
            acceptanceCriteriaRefs: ['ac-1', 'ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          // Others task - owned by someone else
          {
            id: 'others-task-1',
            storyId: 'story-1',
            title: "Other's Task - JWT Validation",
            status: 'owned',
            ownerUserId: 'other-user-456',
            acceptanceCriteriaRefs: ['ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          // My in-progress task
          {
            id: 'my-inprogress-task',
            storyId: 'story-1',
            title: 'My In Progress - Password Reset',
            status: 'inprogress',
            ownerUserId: currentUserId,
            acceptanceCriteriaRefs: ['ac-3'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
        ],
      } as Story,
      {
        id: 'story-2',
        projectId: 'project-1',
        title: 'Dashboard Features Story',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          // Available task in second story
          {
            id: 'available-task-2',
            storyId: 'story-2',
            title: 'Available Task - Add Widgets',
            status: 'available',
            ownerUserId: undefined,
            acceptanceCriteriaRefs: ['ac-4'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          // Completed task owned by current user
          {
            id: 'my-completed-task',
            storyId: 'story-2',
            title: 'My Completed - Dashboard Layout',
            status: 'completed',
            ownerUserId: currentUserId,
            acceptanceCriteriaRefs: ['ac-4'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          // In progress task owned by others
          {
            id: 'others-inprogress-task',
            storyId: 'story-2',
            title: "Other's In Progress - Chart Component",
            status: 'inprogress',
            ownerUserId: 'other-user-789',
            acceptanceCriteriaRefs: ['ac-5'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
        ],
      } as Story,
    ]
  })

  describe('Visual Distinction - All Task Types Together', () => {
    it('should render all three task types with distinct visual indicators', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // AVAILABLE TASKS - Check visual distinction
      const availableTask1 = container.querySelector('[data-testid="task-card-available-task-1"]')
      expect(availableTask1).toBeInTheDocument()
      expect(availableTask1).toHaveClass('border-dashed') // Unique to available
      expect(availableTask1).toHaveClass('border-gray-200') // Gray border
      expect(availableTask1).not.toHaveClass('ring-2') // No ring highlight

      const availableTask2 = container.querySelector('[data-testid="task-card-available-task-2"]')
      expect(availableTask2).toHaveClass('border-dashed')
      expect(availableTask2).not.toHaveClass('ring-2')

      // MY TASKS - Check ring highlight
      const myTask1 = container.querySelector('[data-testid="task-card-my-task-1"]')
      expect(myTask1).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2') // Blue ring highlight
      expect(myTask1).not.toHaveClass('border-dashed') // No dashed border

      const myInProgressTask = container.querySelector(
        '[data-testid="task-card-my-inprogress-task"]'
      )
      expect(myInProgressTask).toHaveClass('ring-2', 'ring-blue-500') // Also highlighted

      const myCompletedTask = container.querySelector('[data-testid="task-card-my-completed-task"]')
      expect(myCompletedTask).toHaveClass('ring-2', 'ring-blue-500') // Still highlighted when completed

      // OTHERS TASKS - No special styling
      const othersTask1 = container.querySelector('[data-testid="task-card-others-task-1"]')
      expect(othersTask1).not.toHaveClass('ring-2') // No ring
      expect(othersTask1).not.toHaveClass('border-dashed') // No dashed border

      const othersInProgressTask = container.querySelector(
        '[data-testid="task-card-others-inprogress-task"]'
      )
      expect(othersInProgressTask).not.toHaveClass('ring-2')
    })

    it('should display "Available to claim" for available tasks', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Check both available tasks show the indicator
      const availableIndicators = screen.getAllByText('Available to claim')
      expect(availableIndicators).toHaveLength(2) // Two available tasks

      // Each should have green styling
      availableIndicators.forEach((indicator) => {
        expect(indicator).toHaveClass('text-green-600', 'font-medium')
      })
    })

    it('should display "My Task" badge only for tasks owned by current user', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Should have 3 "My Task" badges (my-task-1, my-inprogress-task, my-completed-task)
      const myTaskBadges = screen.getAllByText('My Task')
      expect(myTaskBadges).toHaveLength(3)

      // All should have blue styling
      myTaskBadges.forEach((badge) => {
        expect(badge).toHaveClass('bg-blue-500', 'text-white')
      })
    })

    it('should show owner ID for tasks owned by others', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Verify the specific user IDs are shown (displayed as "Unknown · {shortId}")
      // The component shows "Unknown · {shortId}" when userLookup is not provided
      // Both user IDs "other-user-456" and "other-user-789" are truncated to "other-us" (8 chars)
      const unknownUserLabels = screen.getAllByText(/Unknown · other-us/)
      expect(unknownUserLabels).toHaveLength(2)
    })

    it('should show "You" for my tasks instead of user ID', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Should show "You" for owned tasks
      const youLabels = screen.getAllByText('You')
      expect(youLabels.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Distinction - Grouped by Status', () => {
    it('should maintain visual distinction when grouped by status', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId={currentUserId}
        />
      )

      // Available group should have tasks with dashed borders
      const availableGroup = screen.getByTestId('status-group-available')
      const availableTask = within(availableGroup).getByText('Available Task - Write Documentation')
      expect(availableTask).toBeInTheDocument()

      const availableCard = container.querySelector('[data-testid="task-card-available-task-1"]')
      expect(availableCard).toHaveClass('border-dashed')

      // Owned group should have my task with ring
      const ownedGroup = screen.getByTestId('status-group-owned')
      const myOwnedTask = within(ownedGroup).getByText('My Task - Implement Login')
      expect(myOwnedTask).toBeInTheDocument()

      const myOwnedCard = container.querySelector('[data-testid="task-card-my-task-1"]')
      expect(myOwnedCard).toHaveClass('ring-2', 'ring-blue-500')
    })

    it('should show "My Task" badges in status-grouped view', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="status"
          currentUserId={currentUserId}
        />
      )

      // My task badges should still be visible
      const myTaskBadges = screen.getAllByText('My Task')
      expect(myTaskBadges).toHaveLength(3)
    })
  })

  describe('Data Attributes for Testing', () => {
    it('should set data-my-task attribute correctly for all tasks', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // My tasks should have data-my-task="true"
      const myTasks = container.querySelectorAll('[data-my-task="true"]')
      expect(myTasks.length).toBe(3) // 3 tasks owned by current user

      // Others tasks should have data-my-task="false"
      const othersTasks = container.querySelectorAll('[data-my-task="false"]')
      expect(othersTasks.length).toBe(4) // 2 available + 2 owned by others
    })

    it('should be able to query tasks by ownership using data attributes', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Can select all my tasks
      const myTaskCards = container.querySelectorAll('[data-my-task="true"]')
      expect(myTaskCards.length).toBe(3)

      // Each should have ring styling
      myTaskCards.forEach((card) => {
        expect(card).toHaveClass('ring-2', 'ring-blue-500')
      })
    })
  })

  describe('Mixed Status Visual Verification', () => {
    it('should maintain ownership highlighting across different statuses', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // My owned task (status: owned)
      const myOwnedTask = container.querySelector('[data-testid="task-card-my-task-1"]')
      expect(myOwnedTask).toHaveClass('ring-2', 'ring-blue-500')
      expect(myOwnedTask).toHaveClass('border-blue-200') // Owned status border

      // My in-progress task (status: inprogress)
      const myInProgressTask = container.querySelector(
        '[data-testid="task-card-my-inprogress-task"]'
      )
      expect(myInProgressTask).toHaveClass('ring-2', 'ring-blue-500')
      expect(myInProgressTask).toHaveClass('border-yellow-200') // InProgress status border

      // My completed task (status: completed)
      const myCompletedTask = container.querySelector('[data-testid="task-card-my-completed-task"]')
      expect(myCompletedTask).toHaveClass('ring-2', 'ring-blue-500')
      expect(myCompletedTask).toHaveClass('border-green-200') // Completed status border
    })

    it('should combine status colors with ownership indicators correctly', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Available: gray border, dashed, no ring
      expect(screen.getByText('Available Task - Write Documentation')).toBeInTheDocument()

      // Owned (mine): blue border, ring
      expect(screen.getByText('My Task - Implement Login')).toBeInTheDocument()

      // Owned (others): blue border, no ring
      expect(screen.getByText("Other's Task - JWT Validation")).toBeInTheDocument()

      // InProgress (mine): yellow border, ring
      expect(screen.getByText('My In Progress - Password Reset')).toBeInTheDocument()

      // InProgress (others): yellow border, no ring
      expect(screen.getByText("Other's In Progress - Chart Component")).toBeInTheDocument()

      // Completed (mine): green border, ring
      expect(screen.getByText('My Completed - Dashboard Layout')).toBeInTheDocument()
    })
  })

  describe('User Context Switching', () => {
    it('should highlight different tasks when currentUserId changes', () => {
      const { container, rerender } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Initially, current user's tasks should be highlighted
      let myTask = container.querySelector('[data-testid="task-card-my-task-1"]')
      expect(myTask).toHaveClass('ring-2', 'ring-blue-500')

      let othersTask = container.querySelector('[data-testid="task-card-others-task-1"]')
      expect(othersTask).not.toHaveClass('ring-2')

      // Switch to different user
      rerender(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId="other-user-456"
        />
      )

      // Now the previously "others" task should be highlighted
      myTask = container.querySelector('[data-testid="task-card-my-task-1"]')
      expect(myTask).not.toHaveClass('ring-2') // No longer mine

      othersTask = container.querySelector('[data-testid="task-card-others-task-1"]')
      expect(othersTask).toHaveClass('ring-2', 'ring-blue-500') // Now mine
    })
  })

  describe('Empty States', () => {
    it('should handle stories with no tasks gracefully', () => {
      const storiesWithEmpty: Story[] = [
        {
          id: 'story-empty',
          projectId: 'project-1',
          title: 'Empty Story',
          status: 'inprogress',
          labels: [],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
          tasks: [],
        } as Story,
        ...mockStories,
      ]

      render(
        <SprintTaskList
          stories={storiesWithEmpty}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Should still render other stories correctly
      expect(screen.getByText('Available Task - Write Documentation')).toBeInTheDocument()
      expect(screen.getByText('My Task - Implement Login')).toBeInTheDocument()
    })

    it('should handle all tasks being owned by current user', () => {
      const allMyTasks: Story[] = [
        {
          id: 'story-all-mine',
          projectId: 'project-1',
          title: 'All My Tasks Story',
          status: 'inprogress',
          labels: [],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
          tasks: [
            {
              id: 'my-task-a',
              storyId: 'story-all-mine',
              title: 'My Task A',
              status: 'owned',
              ownerUserId: currentUserId,
              acceptanceCriteriaRefs: ['ac-1'],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
            {
              id: 'my-task-b',
              storyId: 'story-all-mine',
              title: 'My Task B',
              status: 'inprogress',
              ownerUserId: currentUserId,
              acceptanceCriteriaRefs: ['ac-2'],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
          ],
        } as Story,
      ]

      const { container } = render(
        <SprintTaskList
          stories={allMyTasks}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // All tasks should have ring highlight
      const myTasks = container.querySelectorAll('[data-my-task="true"]')
      expect(myTasks.length).toBe(2)

      myTasks.forEach((task) => {
        expect(task).toHaveClass('ring-2', 'ring-blue-500')
      })

      // No available tasks
      expect(screen.queryByText('Available to claim')).not.toBeInTheDocument()
    })

    it('should handle all tasks being available', () => {
      const allAvailable: Story[] = [
        {
          id: 'story-all-available',
          projectId: 'project-1',
          title: 'All Available Tasks Story',
          status: 'inprogress',
          labels: [],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
          tasks: [
            {
              id: 'available-a',
              storyId: 'story-all-available',
              title: 'Available Task A',
              status: 'available',
              ownerUserId: undefined,
              acceptanceCriteriaRefs: ['ac-1'],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
            {
              id: 'available-b',
              storyId: 'story-all-available',
              title: 'Available Task B',
              status: 'available',
              ownerUserId: undefined,
              acceptanceCriteriaRefs: ['ac-2'],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            },
          ],
        } as Story,
      ]

      const { container } = render(
        <SprintTaskList
          stories={allAvailable}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // All tasks should have dashed border
      const availableCards = container.querySelectorAll('.border-dashed')
      expect(availableCards.length).toBe(2)

      // Should have "Available to claim" text
      const availableIndicators = screen.getAllByText('Available to claim')
      expect(availableIndicators).toHaveLength(2)

      // No "My Task" badges
      expect(screen.queryByText('My Task')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility and Semantic HTML', () => {
    it('should use semantic data attributes for visual states', () => {
      const { container } = render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Check that all task cards have proper test IDs
      expect(
        container.querySelector('[data-testid="task-card-available-task-1"]')
      ).toBeInTheDocument()
      expect(container.querySelector('[data-testid="task-card-my-task-1"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="task-card-others-task-1"]')).toBeInTheDocument()

      // Check that all task cards have data-my-task attribute
      const allTaskCards = container.querySelectorAll('[data-testid^="task-card-"]')
      allTaskCards.forEach((card) => {
        expect(card.hasAttribute('data-my-task')).toBe(true)
      })
    })

    it('should provide clear visual hierarchy with badges and icons', () => {
      render(
        <SprintTaskList
          stories={mockStories}
          selectedStatuses={[]}
          groupBy="story"
          currentUserId={currentUserId}
        />
      )

      // Status badges should be present (using getAllBy for badges that appear multiple times)
      expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Owned').length).toBeGreaterThan(0)
      expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)

      // "My Task" badges should be visually distinct
      const myTaskBadges = screen.getAllByText('My Task')
      myTaskBadges.forEach((badge) => {
        expect(badge).toHaveClass('bg-blue-500', 'text-white')
      })
    })
  })
})
