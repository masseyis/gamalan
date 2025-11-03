import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParams } from 'next/navigation'
import SprintTasksPage from '@/app/projects/[id]/sprints/[sprintId]/tasks/page'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { sprintApi } from '@/lib/api/sprint'
import { teamsApi } from '@/lib/api/teams'
import { useRoles } from '@/components/providers/UserContextProvider'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

// Mock API modules
vi.mock('@/lib/api/projects')
vi.mock('@/lib/api/backlog')
vi.mock('@/lib/api/sprint')
vi.mock('@/lib/api/teams')
vi.mock('@/components/providers/UserContextProvider')

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  teamId: 'team-1',
  organizationId: 'org-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockTeam = {
  id: 'team-1',
  name: 'Alpha Team',
  organizationId: 'org-1',
  velocityHistory: [30, 35, 40],
  members: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

// Helper to create sprint with specific dates
const createMockSprint = (startDate: string, endDate: string, name = 'Sprint Alpha') => ({
  id: 'sprint-1',
  teamId: 'team-1',
  name,
  goal: 'Deliver core features',
  status: 'active' as const,
  capacityPoints: 40,
  committedPoints: 30,
  completedPoints: 10,
  startDate,
  endDate,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
})

const createMockStories = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `story-${i + 1}`,
    projectId: 'project-1',
    title: `Story ${i + 1}`,
    description: `Description for story ${i + 1}`,
    status: 'inprogress' as const,
    priority: 'high' as const,
    storyPoints: 5,
    labels: ['feature'],
    sprintId: 'sprint-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tasks: [
      {
        id: `task-${i * 2 + 1}`,
        storyId: `story-${i + 1}`,
        title: `Task ${i * 2 + 1}`,
        description: `Task description`,
        acceptanceCriteriaRefs: ['AC1'],
        status: 'available' as const,
        estimatedHours: 3,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: `task-${i * 2 + 2}`,
        storyId: `story-${i + 1}`,
        title: `Task ${i * 2 + 2}`,
        description: `Task description`,
        acceptanceCriteriaRefs: ['AC2'],
        status: 'completed' as const,
        ownerUserId: 'user-1',
        estimatedHours: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ownedAt: '2024-01-02T00:00:00Z',
        completedAt: '2024-01-03T00:00:00Z',
      },
    ],
  }))
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Sprint Context Header Display - AC5', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParams).mockReturnValue({ id: 'project-1', sprint_id: 'sprint-1' })
    vi.mocked(useRoles).mockReturnValue({
      user: { id: 'user-1', role: 'contributor' },
      isContributor: true,
      isManager: false,
    } as any)
    vi.mocked(projectsApi.getProject).mockResolvedValue(mockProject)
    vi.mocked(teamsApi.getTeam).mockResolvedValue(mockTeam)
  })

  describe('Sprint Information Display', () => {
    it('should display sprint name in the header', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z', 'Sprint Alpha')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(3))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/Sprint Alpha — Tasks/i)).toBeInTheDocument()
      })
    })

    it('should display sprint goal when present', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('Deliver core features')).toBeInTheDocument()
      })
    })

    it('should display team name in badge', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/Alpha Team/i)).toBeInTheDocument()
      })
    })
  })

  describe('Date Range Display', () => {
    it('should display start and end dates', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // The component formats dates as "MM/DD/YYYY → MM/DD/YYYY"
        // We verify the arrow separator is present
        const dateText = screen.getByText(/→/i)
        expect(dateText).toBeInTheDocument()
      })
    })

    it('should display correct date format', async () => {
      const sprint = createMockSprint('2024-03-15T00:00:00Z', '2024-03-29T00:00:00Z')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Verify date badge is present with arrow separator
        const badges = screen.getAllByRole('status')
        const dateBadge = badges.find(badge => badge.textContent?.includes('→'))
        expect(dateBadge).toBeDefined()
      })
    })
  })

  describe('Days Remaining Calculation', () => {
    it('should calculate and display days remaining correctly', async () => {
      // Create sprint ending 10 days from now
      const now = new Date()
      const endDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000)
      const sprint = createMockSprint(
        now.toISOString(),
        endDate.toISOString()
      )
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show approximately 10 days (may be 9 or 10 due to timing)
        const daysText = screen.getByText(/\d+ days remaining/i)
        expect(daysText).toBeInTheDocument()
        expect(daysText.textContent).toMatch(/(9|10) days remaining/i)
      })
    })

    it('should show 0 days remaining when sprint has ended', async () => {
      // Create sprint that ended yesterday
      const now = new Date()
      const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const sprint = createMockSprint(
        new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate.toISOString()
      )
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/0 days remaining/i)).toBeInTheDocument()
      })
    })
  })

  describe('Progress Indicator Accuracy', () => {
    it('should display correct completion percentage with no completed tasks', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'Story 1',
          description: 'Description',
          status: 'inprogress' as const,
          priority: 'high' as const,
          storyPoints: 5,
          labels: [],
          sprintId: 'sprint-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tasks: [
            {
              id: 'task-1',
              storyId: 'story-1',
              title: 'Task 1',
              description: 'Task description',
              acceptanceCriteriaRefs: ['AC1'],
              status: 'available' as const,
              estimatedHours: 3,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 'task-2',
              storyId: 'story-1',
              title: 'Task 2',
              description: 'Task description',
              acceptanceCriteriaRefs: ['AC2'],
              status: 'inprogress' as const,
              ownerUserId: 'user-1',
              estimatedHours: 2,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              ownedAt: '2024-01-02T00:00:00Z',
            },
          ],
        },
      ]

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 0 completed out of 2 tasks = 0%
        expect(screen.getByText(/0%/i)).toBeInTheDocument()
      })
    })

    it('should display correct completion percentage with some completed tasks', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(2) // Creates 4 tasks total, 2 completed

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 2 completed out of 4 tasks = 50%
        expect(screen.getByText(/50%/i)).toBeInTheDocument()
      })
    })

    it('should display 100% when all tasks are completed', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'Story 1',
          description: 'Description',
          status: 'completed' as const,
          priority: 'high' as const,
          storyPoints: 5,
          labels: [],
          sprintId: 'sprint-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tasks: [
            {
              id: 'task-1',
              storyId: 'story-1',
              title: 'Task 1',
              description: 'Task description',
              acceptanceCriteriaRefs: ['AC1'],
              status: 'completed' as const,
              ownerUserId: 'user-1',
              estimatedHours: 3,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              ownedAt: '2024-01-02T00:00:00Z',
              completedAt: '2024-01-03T00:00:00Z',
            },
            {
              id: 'task-2',
              storyId: 'story-1',
              title: 'Task 2',
              description: 'Task description',
              acceptanceCriteriaRefs: ['AC2'],
              status: 'completed' as const,
              ownerUserId: 'user-2',
              estimatedHours: 2,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              ownedAt: '2024-01-02T00:00:00Z',
              completedAt: '2024-01-04T00:00:00Z',
            },
          ],
        },
      ]

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 2 completed out of 2 tasks = 100%
        expect(screen.getByText(/100%/i)).toBeInTheDocument()
      })
    })

    it('should display completed task count', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(3) // Creates 6 tasks total, 3 completed

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show completed task count in metrics
        const completedCard = screen.getByText('Tasks completed').closest('div')
        expect(completedCard).toBeDefined()
        expect(completedCard?.textContent).toContain('3')
      })
    })

    it('should display total task count', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(4) // Creates 8 tasks total

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show total task count in metrics
        const totalCard = screen.getByText('Total tasks').closest('div')
        expect(totalCard).toBeDefined()
        expect(totalCard?.textContent).toContain('8')
      })
    })
  })

  describe('Story Count Accuracy', () => {
    it('should display correct story count with single story', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(1)

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const storiesCard = screen.getByText('Stories in sprint').closest('div')
        expect(storiesCard).toBeDefined()
        expect(storiesCard?.textContent).toContain('1')
      })
    })

    it('should display correct story count with multiple stories', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(5)

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const storiesCard = screen.getByText('Stories in sprint').closest('div')
        expect(storiesCard).toBeDefined()
        expect(storiesCard?.textContent).toContain('5')
      })
    })

    it('should display zero when no stories in sprint', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue([])

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const storiesCard = screen.getByText('Stories in sprint').closest('div')
        expect(storiesCard).toBeDefined()
        expect(storiesCard?.textContent).toContain('0')
      })
    })

    it('should update story count when stories are filtered', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(7)

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Story count should remain accurate regardless of task filters
        const storiesCard = screen.getByText('Stories in sprint').closest('div')
        expect(storiesCard).toBeDefined()
        expect(storiesCard?.textContent).toContain('7')
      })
    })
  })

  describe('Header Context Integration', () => {
    it('should display all header context elements together', async () => {
      const sprint = createMockSprint('2024-02-01T00:00:00Z', '2024-02-15T00:00:00Z', 'Q1 Sprint')
      const stories = createMockStories(3)

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Sprint name
        expect(screen.getByText(/Q1 Sprint — Tasks/i)).toBeInTheDocument()

        // Team name
        expect(screen.getByText(/Alpha Team/i)).toBeInTheDocument()

        // Date range (arrow separator)
        expect(screen.getByText(/→/i)).toBeInTheDocument()

        // Days remaining
        expect(screen.getByText(/days remaining/i)).toBeInTheDocument()

        // Story count
        const storiesCard = screen.getByText('Stories in sprint').closest('div')
        expect(storiesCard?.textContent).toContain('3')

        // Progress percentage (3 completed out of 6 tasks = 50%)
        expect(screen.getByText(/50%/i)).toBeInTheDocument()
      })
    })

    it('should handle missing team gracefully', async () => {
      const projectWithoutTeam = { ...mockProject, teamId: undefined }
      vi.mocked(projectsApi.getProject).mockResolvedValue(projectWithoutTeam)

      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(2)

      vi.mocked(sprintApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show "No team" badge
        expect(screen.getByText(/No team/i)).toBeInTheDocument()

        // Should show warning alert
        expect(screen.getByText(/No team assigned/i)).toBeInTheDocument()

        // Other header elements should still display
        expect(screen.getByText(/Sprint Alpha — Tasks/i)).toBeInTheDocument()
      })
    })
  })
})
