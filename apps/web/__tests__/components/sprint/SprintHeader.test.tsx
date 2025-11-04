import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SprintHeader } from '@/components/sprint/SprintHeader'
import { Sprint } from '@/lib/types/team'
import { Story, Task } from '@/lib/types/story'

describe('SprintHeader', () => {
  let mockSprint: Sprint
  let mockStories: Story[]

  beforeEach(() => {
    // Mock sprint with dates 10 days from now
    const startDate = new Date('2025-01-01T00:00:00Z')
    const endDate = new Date('2025-01-15T00:00:00Z')

    mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1: Test Sprint',
      goal: 'Deliver core features',
      status: 'active',
      capacityPoints: 40,
      committedPoints: 30,
      completedPoints: 15,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdAt: '2024-12-20T00:00:00Z',
      updatedAt: '2024-12-20T00:00:00Z',
    }

    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'Story 1',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: 'Task 1',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          } as Task,
          {
            id: 'task-2',
            storyId: 'story-1',
            title: 'Task 2',
            status: 'inprogress',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          } as Task,
        ],
      } as Story,
      {
        id: 'story-2',
        projectId: 'project-1',
        title: 'Story 2',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-3',
            storyId: 'story-2',
            title: 'Task 3',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          } as Task,
          {
            id: 'task-4',
            storyId: 'story-2',
            title: 'Task 4',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          } as Task,
        ],
      } as Story,
    ]
  })

  describe('AC5: Sprint context information display', () => {
    it('should display sprint name', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const sprintName = screen.getByTestId('sprint-name')
      expect(sprintName).toBeInTheDocument()
      expect(sprintName).toHaveTextContent('Sprint 1: Test Sprint')
    })

    it('should display sprint goal when provided', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const sprintGoal = screen.getByTestId('sprint-goal')
      expect(sprintGoal).toBeInTheDocument()
      expect(sprintGoal).toHaveTextContent('Deliver core features')
    })

    it('should not display sprint goal section when goal is not provided', () => {
      const sprintWithoutGoal = { ...mockSprint, goal: '' }
      render(<SprintHeader sprint={sprintWithoutGoal} stories={mockStories} />)

      expect(screen.queryByTestId('sprint-goal')).not.toBeInTheDocument()
    })

    it('should display sprint start and end dates formatted correctly', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const sprintDates = screen.getByTestId('sprint-dates')
      expect(sprintDates).toBeInTheDocument()
      // Dates should be formatted as "Jan 1, 2025 - Jan 15, 2025" or similar
      expect(sprintDates.textContent).toMatch(/Jan\s+1,\s+2025\s+-\s+Jan\s+15,\s+2025/)
    })

    it('should calculate and display days remaining correctly', () => {
      // Mock the current date to be Jan 5, 2025 (10 days before end)
      const mockNow = new Date('2025-01-05T00:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toBeInTheDocument()
      expect(daysRemaining).toHaveTextContent('10 days remaining')

      vi.useRealTimers()
    })

    it('should display singular "day" when only 1 day remaining', () => {
      const mockNow = new Date('2025-01-14T00:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toHaveTextContent('1 day remaining')

      vi.useRealTimers()
    })

    it('should display 0 days remaining when sprint has ended', () => {
      const mockNow = new Date('2025-01-16T00:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toHaveTextContent('0 days remaining')

      vi.useRealTimers()
    })

    it('should display total number of stories in sprint', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toBeInTheDocument()
      expect(storyCount).toHaveTextContent('2 stories')
    })

    it('should display singular "story" when only 1 story', () => {
      const singleStory = [mockStories[0]]
      render(<SprintHeader sprint={mockSprint} stories={singleStory} />)

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('1 story')
    })

    it('should calculate and display task progress correctly', () => {
      // 3 completed tasks out of 4 total = 75%
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toBeInTheDocument()
      expect(taskProgress).toHaveTextContent('3 of 4 tasks')
    })

    it('should display percentage of tasks completed', () => {
      // 3 completed tasks out of 4 total = 75%
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toBeInTheDocument()
      expect(progressPercentage).toHaveTextContent('75%')
    })

    it('should display progress bar with correct value', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toBeInTheDocument()
      // Progress component should have max value set
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })

    it('should handle zero tasks gracefully', () => {
      const storiesWithoutTasks: Story[] = [
        {
          ...mockStories[0],
          tasks: [],
        },
      ]

      render(<SprintHeader sprint={mockSprint} stories={storiesWithoutTasks} />)

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('0 of 0 tasks')

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('0%')
    })

    it('should handle stories with no tasks array', () => {
      const storiesWithUndefinedTasks: Story[] = [
        {
          ...mockStories[0],
          tasks: undefined,
        },
      ]

      render(<SprintHeader sprint={mockSprint} stories={storiesWithUndefinedTasks} />)

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('0 of 0 tasks')
    })

    it('should handle empty stories array', () => {
      render(<SprintHeader sprint={mockSprint} stories={[]} />)

      const storyCount = screen.getByTestId('story-count')
      expect(storyCount).toHaveTextContent('0 stories')

      const taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('0 of 0 tasks')
    })
  })

  describe('Visual structure', () => {
    it('should render with proper data-testid for component identification', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      const header = screen.getByTestId('sprint-header')
      expect(header).toBeInTheDocument()
    })

    it('should display calendar icon for sprint dates section', () => {
      const { container } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      // Check for lucide-react Calendar icon
      const calendarIcons = container.querySelectorAll('svg.lucide-calendar')
      expect(calendarIcons.length).toBeGreaterThan(0)
    })

    it('should display target icon for stories section', () => {
      const { container } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      // Check for lucide-react Target icon
      const targetIcon = container.querySelector('svg.lucide-target')
      expect(targetIcon).toBeInTheDocument()
    })

    it('should display trending up icon for task progress section', () => {
      const { container } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      // Check for lucide-react TrendingUp icon
      const trendingIcon = container.querySelector('svg.lucide-trending-up')
      expect(trendingIcon).toBeInTheDocument()
    })
  })

  describe('Edge cases and calculations', () => {
    it('should calculate progress correctly with all tasks completed', () => {
      const allCompletedStories: Story[] = [
        {
          ...mockStories[0],
          tasks: [
            { ...mockStories[0].tasks![0], status: 'completed' },
            { ...mockStories[0].tasks![1], status: 'completed' },
          ],
        },
        {
          ...mockStories[1],
          tasks: [
            { ...mockStories[1].tasks![0], status: 'completed' },
            { ...mockStories[1].tasks![1], status: 'completed' },
          ],
        },
      ]

      render(<SprintHeader sprint={mockSprint} stories={allCompletedStories} />)

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('100%')
    })

    it('should calculate progress correctly with no completed tasks', () => {
      const noCompletedStories: Story[] = [
        {
          ...mockStories[0],
          tasks: [
            { ...mockStories[0].tasks![0], status: 'available' },
            { ...mockStories[0].tasks![1], status: 'inprogress' },
          ],
        },
      ]

      render(<SprintHeader sprint={mockSprint} stories={noCompletedStories} />)

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('0%')
    })

    it('should round percentage to nearest integer', () => {
      // 1 completed out of 3 tasks = 33.33% -> should round to 33%
      const storyWith3Tasks: Story[] = [
        {
          ...mockStories[0],
          tasks: [
            { ...mockStories[0].tasks![0], status: 'completed' },
            { ...mockStories[0].tasks![1], status: 'available' },
            {
              id: 'task-5',
              storyId: 'story-1',
              title: 'Task 5',
              status: 'available',
              acceptanceCriteriaRefs: ['ac-1'],
              createdAt: '2024-12-20T00:00:00Z',
              updatedAt: '2024-12-20T00:00:00Z',
            } as Task,
          ],
        },
      ]

      render(<SprintHeader sprint={mockSprint} stories={storyWith3Tasks} />)

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('33%')
    })

    it('should handle future sprint dates correctly', () => {
      const futureStartDate = new Date('2025-06-01T00:00:00Z')
      const futureEndDate = new Date('2025-06-15T00:00:00Z')
      const futureSprint = {
        ...mockSprint,
        startDate: futureStartDate.toISOString(),
        endDate: futureEndDate.toISOString(),
      }

      const mockNow = new Date('2025-01-05T00:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      render(<SprintHeader sprint={futureSprint} stories={mockStories} />)

      const daysRemaining = screen.getByTestId('days-remaining')
      // Should show many days remaining
      expect(parseInt(daysRemaining.textContent || '0')).toBeGreaterThan(100)

      vi.useRealTimers()
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const { container } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      // Should have a main heading (h2) for sprint name
      const heading = container.querySelector('h2')
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveTextContent('Sprint 1: Test Sprint')
    })

    it('should use appropriate test ids for all key elements', () => {
      render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      expect(screen.getByTestId('sprint-name')).toBeInTheDocument()
      expect(screen.getByTestId('sprint-dates')).toBeInTheDocument()
      expect(screen.getByTestId('days-remaining')).toBeInTheDocument()
      expect(screen.getByTestId('story-count')).toBeInTheDocument()
      expect(screen.getByTestId('task-progress')).toBeInTheDocument()
      expect(screen.getByTestId('progress-percentage')).toBeInTheDocument()
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
    })
  })

  describe('Re-rendering and memoization', () => {
    it('should recalculate days remaining when sprint endDate changes', () => {
      const mockNow = new Date('2025-01-05T00:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)

      const { rerender } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      let daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toHaveTextContent('10 days remaining')

      // Change sprint end date (useMemo depends on sprint.endDate)
      const updatedSprint = {
        ...mockSprint,
        endDate: new Date('2025-01-10T00:00:00Z').toISOString(), // 5 days from now
      }

      rerender(<SprintHeader sprint={updatedSprint} stories={mockStories} />)

      daysRemaining = screen.getByTestId('days-remaining')
      expect(daysRemaining).toHaveTextContent('5 days remaining')

      vi.useRealTimers()
    })

    it('should recalculate task progress when stories change', () => {
      const { rerender } = render(<SprintHeader sprint={mockSprint} stories={mockStories} />)

      let taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('3 of 4 tasks')

      // Update stories with more completed tasks
      const updatedStories = mockStories.map((story) => ({
        ...story,
        tasks: story.tasks?.map((task) => ({ ...task, status: 'completed' as const })),
      }))

      rerender(<SprintHeader sprint={mockSprint} stories={updatedStories} />)

      taskProgress = screen.getByTestId('task-progress')
      expect(taskProgress).toHaveTextContent('4 of 4 tasks')

      const progressPercentage = screen.getByTestId('progress-percentage')
      expect(progressPercentage).toHaveTextContent('100%')
    })
  })
})
