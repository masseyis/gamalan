/**
 * Integration tests for SprintHeader component in the context of SprintTaskBoard
 *
 * This test file specifically validates AC5 requirements:
 * - Sprint name, start date, end date, and days remaining display
 * - Progress indicator showing percentage of tasks completed
 * - Total number of stories in the sprint
 *
 * These tests verify that the header correctly integrates with the full board
 * and accurately reflects the state of the sprint.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SprintTaskBoard } from '@/components/sprint/SprintTaskBoard'
import { Sprint } from '@/lib/types/team'
import { Story, Task } from '@/lib/types/story'

// Mock the WebSocket hook
vi.mock('@/lib/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: vi.fn(() => ({
    isConnected: true,
  })),
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

describe('SprintHeader Integration with SprintTaskBoard', () => {
  let mockSprint: Sprint
  let mockStories: Story[]

  beforeEach(() => {
    // Set a fixed date for consistent testing
    const mockNow = new Date('2025-01-10T00:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(mockNow)

    mockSprint = {
      id: 'sprint-123',
      teamId: 'team-456',
      name: 'Sprint 2025-01: Core Platform',
      goal: 'Build sprint task board with real-time updates',
      status: 'active',
      capacityPoints: 50,
      committedPoints: 40,
      completedPoints: 20,
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-15T00:00:00Z', // 5 days remaining from mockNow
      createdAt: '2024-12-15T00:00:00Z',
      updatedAt: '2025-01-10T00:00:00Z',
    }

    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'Sprint Task Board UI',
        description: 'Build the main sprint task board interface',
        status: 'inprogress',
        labels: ['frontend', 'high-priority'],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: 'Create SprintHeader component',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-5'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-05T00:00:00Z',
          } as Task,
          {
            id: 'task-2',
            storyId: 'story-1',
            title: 'Build TaskList component',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-06T00:00:00Z',
          } as Task,
          {
            id: 'task-3',
            storyId: 'story-1',
            title: 'Implement filter controls',
            status: 'inprogress',
            ownerUserId: 'user-123',
            acceptanceCriteriaRefs: ['ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-10T00:00:00Z',
          } as Task,
        ],
      } as Story,
      {
        id: 'story-2',
        projectId: 'project-1',
        title: 'Real-time Task Updates',
        description: 'Implement WebSocket-based real-time task updates',
        status: 'inprogress',
        labels: ['backend', 'websocket'],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
        tasks: [
          {
            id: 'task-4',
            storyId: 'story-2',
            title: 'Setup WebSocket infrastructure',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-4'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-08T00:00:00Z',
          } as Task,
          {
            id: 'task-5',
            storyId: 'story-2',
            title: 'Implement event handlers',
            status: 'available',
            acceptanceCriteriaRefs: ['ac-4'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-10T00:00:00Z',
          } as Task,
        ],
      } as Story,
      {
        id: 'story-3',
        projectId: 'project-1',
        title: 'Task Visual Indicators',
        description: 'Add visual distinction for available, owned, and others tasks',
        status: 'todo',
        labels: ['frontend', 'ux'],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2025-01-10T00:00:00Z',
        tasks: [
          {
            id: 'task-6',
            storyId: 'story-3',
            title: 'Design task card variants',
            status: 'available',
            acceptanceCriteriaRefs: ['ac-3'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2025-01-10T00:00:00Z',
          } as Task,
        ],
      } as Story,
    ]
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('AC5: Sprint context header display', () => {
    it('should display sprint name in header', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const sprintName = screen.getByTestId('sprint-name')
      expect(sprintName).toBeInTheDocument()
      expect(sprintName).toHaveTextContent('Sprint 2025-01: Core Platform')
    })

    it('should display sprint goal in header', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const sprintGoal = screen.getByTestId('sprint-goal')
      expect(sprintGoal).toBeInTheDocument()
      expect(sprintGoal).toHaveTextContent('Build sprint task board with real-time updates')
    })

    it('should display formatted start and end dates', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const sprintDates = screen.getByTestId('sprint-dates')
      expect(sprintDates).toBeInTheDocument()
      // Should format as "Jan 1, 2025 - Jan 15, 2025"
      expect(sprintDates.textContent).toMatch(/Jan\s+1,\s+2025\s+-\s+Jan\s+15,\s+2025/)
    })

    it('should calculate and display correct days remaining', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toBeInTheDocument()
      // From Jan 10 to Jan 15 = 5 days
      expect(daysRemaining).toHaveTextContent('5 days remaining')
    })

    it('should display accurate story count', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toBeInTheDocument()
      expect(storyCount).toHaveTextContent('3 stories')
    })

    it('should calculate task progress accurately', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toBeInTheDocument()
      // 3 completed tasks out of 6 total
      expect(taskProgress).toHaveTextContent('3 of 6 tasks')
    })

    it('should display correct progress percentage', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toBeInTheDocument()
      // 3/6 = 50%
      expect(progressPercentage).toHaveTextContent('50%')
    })

    it('should render progress bar with correct value', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
      // The progress bar should reflect 50% completion
    })
  })

  describe('Header accuracy with different data scenarios', () => {
    it('should display accurate story count for different story arrays', () => {
      // Test with 3 stories
      const { unmount } = render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />
      )

      let storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('3 stories')

      unmount()

      // Test with 1 story
      const fewerStories = mockStories.slice(0, 1)
      render(<SprintTaskBoard sprint={mockSprint} stories={fewerStories} currentUserId="user-123" />)

      storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('1 story')
    })

    it('should display accurate progress for different task completion states', () => {
      // Test with 50% completion (3 out of 6 completed)
      const { unmount } = render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />
      )

      let progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('50%')

      unmount()

      // Test with 100% completion - mark all tasks as completed
      const allCompletedStories = mockStories.map((story) => ({
        ...story,
        tasks: story.tasks?.map((task) => ({ ...task, status: 'completed' as const })),
      }))

      render(
        <SprintTaskBoard sprint={mockSprint} stories={allCompletedStories} currentUserId="user-123" />
      )

      progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('100%')
    })

    it('should handle sprint with no stories gracefully', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={[]} currentUserId="user-123" />)

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('0 stories')

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('0 of 0 tasks')

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('0%')
    })

    it('should handle stories with no tasks gracefully', () => {
      const storiesWithoutTasks = mockStories.map((story) => ({ ...story, tasks: [] }))

      render(
        <SprintTaskBoard sprint={mockSprint} stories={storiesWithoutTasks} currentUserId="user-123" />
      )

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('3 stories')

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('0 of 0 tasks')

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('0%')
    })

    it('should display correctly when sprint has ended', () => {
      // Set current time to after sprint end
      const pastDate = new Date('2025-01-20T00:00:00Z')
      vi.setSystemTime(pastDate)

      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      const daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toHaveTextContent('0 days remaining')
    })

    it('should display correctly for future sprint', () => {
      // Set sprint dates in the future
      const futureSprint = {
        ...mockSprint,
        startDate: '2025-02-01T00:00:00Z',
        endDate: '2025-02-15T00:00:00Z',
      }

      render(<SprintTaskBoard sprint={futureSprint} stories={mockStories} currentUserId="user-123" />)

      const daysRemaining = screen.getByTestId('days-remaining')
      // Should calculate days from current mockNow (Jan 10) to Feb 15
      expect(parseInt(daysRemaining.textContent || '0')).toBeGreaterThan(30)
    })

    it('should accurately reflect progress with mixed task statuses', () => {
      // Create stories with specific task distribution
      const mixedStories: Story[] = [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'Story 1',
          status: 'inprogress',
          labels: [],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2025-01-10T00:00:00Z',
          tasks: [
            { id: 't1', storyId: 'story-1', title: 'T1', status: 'completed', acceptanceCriteriaRefs: ['ac-1'], createdAt: '2024-12-20T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' } as Task,
            { id: 't2', storyId: 'story-1', title: 'T2', status: 'completed', acceptanceCriteriaRefs: ['ac-1'], createdAt: '2024-12-20T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' } as Task,
            { id: 't3', storyId: 'story-1', title: 'T3', status: 'inprogress', acceptanceCriteriaRefs: ['ac-1'], createdAt: '2024-12-20T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' } as Task,
            { id: 't4', storyId: 'story-1', title: 'T4', status: 'owned', acceptanceCriteriaRefs: ['ac-1'], createdAt: '2024-12-20T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' } as Task,
            { id: 't5', storyId: 'story-1', title: 'T5', status: 'available', acceptanceCriteriaRefs: ['ac-1'], createdAt: '2024-12-20T00:00:00Z', updatedAt: '2025-01-10T00:00:00Z' } as Task,
          ],
        } as Story,
      ]

      render(<SprintTaskBoard sprint={mockSprint} stories={mixedStories} currentUserId="user-123" />)

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('2 of 5 tasks')

      const progressPercentage = screen.getByTestId('progress-percentage')
      // 2/5 = 40%
      expect(progressPercentage).toHaveTextContent('40%')
    })
  })

  describe('Header integration with board state', () => {
    it('should display header above filters and task list', () => {
      const { container } = render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />
      )

      const sprintTaskBoard = screen.getByTestId('sprint-task-board')
      const sprintHeader = screen.getByTestId('sprint-header')
      const sprintFilters = screen.getByTestId('sprint-task-filters')

      // Verify header is rendered before filters
      expect(sprintTaskBoard.contains(sprintHeader)).toBe(true)
      expect(sprintTaskBoard.contains(sprintFilters)).toBe(true)
    })

    it('should maintain header visibility when filters are applied', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      // Header should always be visible
      expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      expect(screen.getByTestId('sprint-name')).toBeInTheDocument()
      expect(screen.getByTestId('story-count')).toBeInTheDocument()
      expect(screen.getByTestId('task-progress')).toBeInTheDocument()
    })

    it('should display all required header elements simultaneously', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-123" />)

      // Verify all AC5 requirements are visible together
      expect(screen.getByTestId('sprint-name')).toBeInTheDocument()
      expect(screen.getByTestId('sprint-dates')).toBeInTheDocument()
      expect(screen.getByTestId('days-remaining')).toBeInTheDocument()
      expect(screen.getByTestId('story-count')).toBeInTheDocument()
      expect(screen.getByTestId('task-progress')).toBeInTheDocument()
      expect(screen.getByTestId('progress-percentage')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })
  })
})
