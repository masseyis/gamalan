import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParams } from 'next/navigation'
import SprintTasksPage from '@/app/projects/[id]/sprints/[sprintId]/tasks/page'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { sprintsApi } from '@/lib/api/teams'
import { useRoles } from '@/components/providers/UserContextProvider'

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({
    user: { id: 'user-1' },
    isLoaded: true,
  })),
  useAuth: vi.fn(() => ({
    getToken: vi.fn(() => Promise.resolve('mock-token')),
    userId: 'user-1',
    isLoaded: true,
  })),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

// Mock WebSocket hook
vi.mock('@/lib/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: vi.fn(() => ({
    isConnected: true,
  })),
}))

// Mock API modules
vi.mock('@/lib/api/projects')
vi.mock('@/lib/api/backlog')
vi.mock('@/lib/api/teams')
vi.mock('@/components/providers/UserContextProvider', () => ({
  useRoles: vi.fn(() => ({
    user: { id: 'user-1', role: 'contributor' },
    isContributor: true,
    isProductOwner: false,
    isSponsor: false,
    isManagingContributor: false,
  })),
  useUserContext: vi.fn(() => ({
    user: { id: 'user-1', role: 'contributor' },
    isLoading: false,
    error: null,
  })),
  useTeamContext: vi.fn(() => ({
    teamMemberships: [],
    getTeamRole: vi.fn(),
  })),
  UserContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

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
    vi.mocked(useParams).mockReturnValue({ id: 'project-1', sprintId: 'sprint-1' })
    vi.mocked(useRoles).mockReturnValue({
      user: { id: 'user-1', role: 'contributor' },
      isContributor: true,
      isManager: false,
    } as any)
    vi.mocked(projectsApi.getProject).mockResolvedValue(mockProject)
  })

  describe('Sprint Information Display', () => {
    it('should display sprint name in the header', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z', 'Sprint Alpha')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(3))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const sprintName = screen.getByTestId('sprint-name')
        expect(sprintName).toBeInTheDocument()
        expect(sprintName).toHaveTextContent('Sprint Alpha')
      })
    })

    it('should display sprint goal when present', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('sprint-goal')).toHaveTextContent('Deliver core features')
      })
    })

    it('should display sprint header with all elements', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      })
    })
  })

  describe('Date Range Display', () => {
    it('should display start and end dates', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const sprintDates = screen.getByTestId('sprint-dates')
        expect(sprintDates).toBeInTheDocument()
        expect(sprintDates.textContent).toMatch(/Jan\s+1,\s+2024\s+-\s+Jan\s+14,\s+2024/)
      })
    })

    it('should display correct date format', async () => {
      const sprint = createMockSprint('2024-03-15T00:00:00Z', '2024-03-29T00:00:00Z')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const sprintDates = screen.getByTestId('sprint-dates')
        expect(sprintDates.textContent).toMatch(/Mar\s+15,\s+2024\s+-\s+Mar\s+29,\s+2024/)
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
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(2))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const daysRemaining = screen.getByTestId('days-remaining')
        expect(daysRemaining).toBeInTheDocument()
        expect(daysRemaining.textContent).toMatch(/(9|10|11) days remaining/i)
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
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(createMockStories(1))

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('days-remaining')).toHaveTextContent(/0 days remaining/i)
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

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 0 completed out of 2 tasks = 0%
        expect(screen.getByTestId('progress-percentage')).toHaveTextContent('0%')
      })
    })

    it('should display correct completion percentage with some completed tasks', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(2) // Creates 4 tasks total, 2 completed

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 2 completed out of 4 tasks = 50%
        expect(screen.getByTestId('progress-percentage')).toHaveTextContent('50%')
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
          status: 'taskscomplete' as const,
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

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // 2 completed out of 2 tasks = 100%
        expect(screen.getByTestId('progress-percentage')).toHaveTextContent('100%')
      })
    })

    it('should display completed task count', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(3) // Creates 6 tasks total, 3 completed

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show completed task count "3 of 6 tasks"
        expect(screen.getByTestId('task-progress')).toHaveTextContent('3 of 6 tasks')
      })
    })

    it('should display total task count', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(4) // Creates 8 tasks total

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Should show total task count "4 of 8 tasks"
        expect(screen.getByTestId('task-progress')).toHaveTextContent('4 of 8 tasks')
      })
    })
  })

  describe('Story Count Accuracy', () => {
    it('should display correct story count with single story', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(1)

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('story-count')).toHaveTextContent('1 story')
      })
    })

    it('should display correct story count with multiple stories', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(5)

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('story-count')).toHaveTextContent('5 stories')
      })
    })

    it('should display zero when no stories in sprint', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue([])

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByTestId('story-count')).toHaveTextContent('0 stories')
      })
    })

    it('should update story count when stories are filtered', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(7)

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Story count should remain accurate regardless of task filters
        expect(screen.getByTestId('story-count')).toHaveTextContent('7 stories')
      })
    })
  })

  describe('Header Context Integration', () => {
    it('should display all header context elements together', async () => {
      const sprint = createMockSprint('2024-02-01T00:00:00Z', '2024-02-15T00:00:00Z', 'Q1 Sprint')
      const stories = createMockStories(3)

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Sprint name
        expect(screen.getByTestId('sprint-name')).toHaveTextContent('Q1 Sprint')

        // Sprint dates
        expect(screen.getByTestId('sprint-dates')).toBeInTheDocument()

        // Days remaining
        expect(screen.getByTestId('days-remaining')).toBeInTheDocument()

        // Story count
        expect(screen.getByTestId('story-count')).toHaveTextContent('3 stories')

        // Progress percentage (3 completed out of 6 tasks = 50%)
        expect(screen.getByTestId('progress-percentage')).toHaveTextContent('50%')
      })
    })

    it('should display sprint header with all AC5 requirements', async () => {
      const sprint = createMockSprint('2024-01-01T00:00:00Z', '2024-01-14T00:00:00Z')
      const stories = createMockStories(2)

      vi.mocked(sprintsApi.getSprint).mockResolvedValue(sprint)
      vi.mocked(backlogApi.getStories).mockResolvedValue(stories)

      render(<SprintTasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        // Verify all AC5 requirements are present
        expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
        expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint Alpha')
        expect(screen.getByTestId('sprint-dates')).toBeInTheDocument()
        expect(screen.getByTestId('days-remaining')).toBeInTheDocument()
        expect(screen.getByTestId('story-count')).toBeInTheDocument()
        expect(screen.getByTestId('task-progress')).toBeInTheDocument()
        expect(screen.getByTestId('progress-percentage')).toBeInTheDocument()
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
      })
    })
  })
})
