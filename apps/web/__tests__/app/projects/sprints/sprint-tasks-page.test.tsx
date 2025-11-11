import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParams } from 'next/navigation'
import SprintTasksPage from '@/app/projects/[id]/sprints/[sprintId]/tasks/page'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { sprintsApi } from '@/lib/api/teams'
import { useRoles } from '@/components/providers/UserContextProvider'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useUser: vi.fn(() => ({
    user: { id: 'user-1', firstName: 'Test', lastName: 'User' },
    isLoaded: true,
  })),
  useAuth: vi.fn(() => ({
    getToken: vi.fn(() => Promise.resolve('mock-token')),
    userId: 'user-1',
    isLoaded: true,
  })),
}))

// Mock API modules
vi.mock('@/lib/api/projects')
vi.mock('@/lib/api/backlog')
vi.mock('@/lib/api/teams')
vi.mock('@/components/providers/UserContextProvider', () => ({
  useRoles: vi.fn(),
  useUserContext: vi.fn(),
  useTeamContext: vi.fn(),
  UserContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock WebSocket hook to avoid connection attempts in tests
vi.mock('@/lib/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: vi.fn(() => ({
    isConnected: false,
    sendMessage: vi.fn(),
  })),
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
  name: 'Test Team',
  organizationId: 'org-1',
  velocityHistory: [30, 35, 40],
  members: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  goal: 'Complete initial features',
  status: 'active' as const,
  capacityPoints: 40,
  committedPoints: 30,
  completedPoints: 10,
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-14T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockStories = [
  {
    id: 'story-1',
    projectId: 'project-1',
    title: 'User Authentication',
    description: 'Implement user authentication',
    status: 'inprogress' as const,
    priority: 'high' as const,
    storyPoints: 8,
    labels: ['auth'],
    sprintId: 'sprint-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tasks: [
      {
        id: 'task-1',
        storyId: 'story-1',
        title: 'Setup JWT authentication',
        description: 'Configure JWT tokens',
        acceptanceCriteriaRefs: ['AC1', 'AC2'],
        status: 'available' as const,
        estimatedHours: 4,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'task-2',
        storyId: 'story-1',
        title: 'Create login form',
        description: 'Build login UI',
        acceptanceCriteriaRefs: ['AC3'],
        status: 'owned' as const,
        ownerUserId: 'user-1',
        estimatedHours: 3,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ownedAt: '2024-01-02T00:00:00Z',
      },
    ],
  },
  {
    id: 'story-2',
    projectId: 'project-1',
    title: 'Project Dashboard',
    description: 'Build project dashboard',
    status: 'committed' as const,
    priority: 'medium' as const,
    storyPoints: 5,
    labels: ['ui'],
    sprintId: 'sprint-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tasks: [
      {
        id: 'task-3',
        storyId: 'story-2',
        title: 'Design dashboard layout',
        description: 'Create wireframes',
        acceptanceCriteriaRefs: ['AC1'],
        status: 'completed' as const,
        ownerUserId: 'user-2',
        estimatedHours: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ownedAt: '2024-01-02T00:00:00Z',
        completedAt: '2024-01-03T00:00:00Z',
      },
    ],
  },
]

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

describe('SprintTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useParams).mockReturnValue({ id: 'project-1', sprintId: 'sprint-1' })
    vi.mocked(useRoles).mockReturnValue({
      user: { id: 'user-1', role: 'contributor' },
      isContributor: true,
      isManager: false,
    } as any)
    vi.mocked(projectsApi.getProject).mockResolvedValue(mockProject)
    vi.mocked(sprintsApi.getSprint).mockResolvedValue(mockSprint)
    vi.mocked(backlogApi.getStories).mockResolvedValue(mockStories)
  })

  it('AC 7852bac8: displays all sprint tasks with required information', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Check sprint context is displayed
    expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    expect(screen.getByTestId('sprint-goal')).toHaveTextContent('Complete initial features')
    expect(screen.getByText(/Sprint Task Board/i)).toBeInTheDocument()

    // Check all tasks are displayed
    expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    expect(screen.getByText('Create login form')).toBeInTheDocument()
    expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()

    // Check task details are shown
    expect(screen.getByText(/2 ACs/i)).toBeInTheDocument() // AC refs for task-1
    expect(screen.getByText(/User Authentication/i)).toBeInTheDocument() // Parent story

    // Check task status badges
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Owned/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
  })

  it('AC a2ef8786: filters tasks by status', async () => {
    const user = userEvent.setup()
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Initially shows all tasks
    expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    expect(screen.getByText('Create login form')).toBeInTheDocument()
    expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()
    expect(screen.getByText(/Showing 3 of 3 tasks/i)).toBeInTheDocument()

    // Filter by 'available' status
    const availableFilter = screen.getByLabelText('Available')
    await user.click(availableFilter)

    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 3 tasks/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    expect(screen.queryByText('Create login form')).not.toBeInTheDocument()
  })

  it('AC a2ef8786: groups tasks by story', async () => {
    const user = userEvent.setup()
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Default grouping is by story
    expect(screen.getByRole('heading', { name: /User Authentication/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Project Dashboard/i })).toBeInTheDocument()

    // Change grouping to status
    const groupByStatus = screen.getByLabelText('Group by Status')
    await user.click(groupByStatus)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Available/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Owned/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Completed/i })).toBeInTheDocument()
    })
  })

  it('AC a2ef8786: displays task counts in groups', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Check badge counts for story groups
    const badges = screen.getAllByTestId(/badge/i)
    expect(badges.some((badge) => badge.textContent?.includes('2 tasks'))).toBeTruthy() // User Authentication has 2 tasks
    expect(badges.some((badge) => badge.textContent?.includes('1 task'))).toBeTruthy() // Project Dashboard has 1 task
  })

  it('AC 8e8e949d: visually distinguishes available tasks', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    })

    // Available task should have "Available to claim" badge
    expect(screen.getByText('Available to claim')).toBeInTheDocument()
  })

  it('AC 8e8e949d: highlights user own tasks', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Create login form')).toBeInTheDocument()
    })

    // User's own task (task-2 owned by user-1) should have "My Task" badge
    expect(screen.getByText('My Task')).toBeInTheDocument()
  })

  it('AC 8e8e949d: shows owner for tasks owned by others', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()
    })

    // Task owned by user-2 should show owner
    expect(screen.getByText(/Owned by user-2/i)).toBeInTheDocument()
  })

  it('AC d4d41a1f: displays sprint name in header', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify sprint name is prominently displayed
    const heading = screen.getByRole('heading', { level: 1, name: /Sprint 1/i })
    expect(heading).toBeInTheDocument()
    expect(heading.className).toContain('text-4xl')
  })

  it('AC d4d41a1f: displays sprint start and end dates', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify date range is displayed with formatted dates
    const sprintDates = screen.getByTestId('sprint-dates')
    expect(sprintDates).toBeInTheDocument()
    // Dates should be formatted as "MMM D, YYYY - MMM D, YYYY"
    expect(sprintDates).toHaveTextContent(/Jan\s+1,\s+2024\s+-\s+Jan\s+14,\s+2024/)
  })

  it('AC d4d41a1f: displays days remaining in sprint', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify days remaining is displayed
    expect(screen.getByText(/\d+ days remaining/i)).toBeInTheDocument()
  })

  it('AC d4d41a1f: displays progress indicator with percentage of completed tasks', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify completion percentage is calculated correctly
    // 1 completed out of 3 tasks = 33%
    expect(screen.getByText(/33%/i)).toBeInTheDocument()

    // Verify it's labeled as "Tasks progress"
    expect(screen.getByText('Tasks progress')).toBeInTheDocument()
  })

  it('AC d4d41a1f: displays total number of stories in sprint', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify story count is displayed correctly
    expect(screen.getByText('Stories in sprint')).toBeInTheDocument()

    // Mock data has 2 stories
    const storyCards = screen.getAllByText('Stories in sprint')
    expect(storyCards).toHaveLength(1)

    // Find the card that displays story count
    const storyCountCard = storyCards[0].parentElement
    expect(storyCountCard).toHaveTextContent('2')
  })

  it('AC d4d41a1f: displays all sprint context metrics together', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // Verify all key metrics are present
    expect(screen.getByText(/Sprint 1/i)).toBeInTheDocument()
    expect(screen.getByText(/days remaining/i)).toBeInTheDocument()
    expect(screen.getByText('Stories in sprint')).toBeInTheDocument()
    expect(screen.getByText('Total tasks')).toBeInTheDocument()
    expect(screen.getByTestId('task-progress')).toBeInTheDocument()
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent(/\d+%/)
  })

  it('AC d4d41a1f: calculates progress percentage correctly with no tasks', async () => {
    vi.mocked(backlogApi.getStories).mockResolvedValue([
      {
        ...mockStories[0],
        tasks: [],
      },
    ])

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // With 0 tasks, percentage should be 0%
    expect(screen.getByText(/0%/i)).toBeInTheDocument()
  })

  it('AC d4d41a1f: calculates progress percentage correctly with all tasks completed', async () => {
    const allCompletedStories = mockStories.map((story) => ({
      ...story,
      tasks: story.tasks?.map((task) => ({
        ...task,
        status: 'completed' as const,
      })),
    }))

    vi.mocked(backlogApi.getStories).mockResolvedValue(allCompletedStories)

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-name')).toHaveTextContent('Sprint 1')
    })

    // With all tasks completed, percentage should be 100%
    expect(screen.getByText(/100%/i)).toBeInTheDocument()
  })

  it('handles take ownership action', async () => {
    const user = userEvent.setup()
    const takeOwnershipMock = vi.fn().mockResolvedValue({ success: true, message: 'Success' })
    vi.mocked(backlogApi.takeTaskOwnership).mockImplementation(takeOwnershipMock)

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    })

    // Click "I'm on it" button for available task
    const claimButton = screen.getByRole('button', { name: /I'm on it/i })
    await user.click(claimButton)

    await waitFor(() => {
      expect(takeOwnershipMock).toHaveBeenCalledWith('task-1')
    })
  })

  it('handles loading state', () => {
    vi.mocked(projectsApi.getProject).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    expect(screen.getByText(/Loading sprint tasks.../i)).toBeInTheDocument()
  })

  it('handles error state', async () => {
    vi.mocked(sprintsApi.getSprint).mockRejectedValue(new Error('Failed to load'))

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Sprint/i)).toBeInTheDocument()
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument()
    })
  })

  it('displays empty state when no tasks exist', async () => {
    vi.mocked(backlogApi.getStories).mockResolvedValue([
      {
        ...mockStories[0],
        tasks: [],
      },
    ])

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/No tasks found/i)).toBeInTheDocument()
    })
  })
})
