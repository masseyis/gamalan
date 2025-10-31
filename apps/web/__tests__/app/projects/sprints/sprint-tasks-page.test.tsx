import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useParams } from 'next/navigation'
import SprintTasksPage from '@/app/projects/[id]/sprints/[sprint_id]/tasks/page'
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
    vi.mocked(useParams).mockReturnValue({ id: 'project-1', sprint_id: 'sprint-1' })
    vi.mocked(useRoles).mockReturnValue({
      user: { id: 'user-1', role: 'contributor' },
      isContributor: true,
      isManager: false,
    } as any)
    vi.mocked(projectsApi.getProject).mockResolvedValue(mockProject)
    vi.mocked(teamsApi.getTeam).mockResolvedValue(mockTeam)
    vi.mocked(sprintApi.getSprint).mockResolvedValue(mockSprint)
    vi.mocked(backlogApi.getStories).mockResolvedValue(mockStories)
  })

  it('AC 7852bac8: displays all sprint tasks with required information', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // Check sprint context is displayed
    expect(screen.getByText(/Sprint 1 — Tasks/i)).toBeInTheDocument()
    expect(screen.getByText(/Complete initial features/i)).toBeInTheDocument()
    expect(screen.getByText(/Test Team/i)).toBeInTheDocument()

    // Check all tasks are displayed
    expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    expect(screen.getByText('Create login form')).toBeInTheDocument()
    expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()

    // Check task details are shown
    expect(screen.getByText(/AC1, AC2/i)).toBeInTheDocument() // AC refs for task-1
    expect(screen.getByText(/User Authentication/i)).toBeInTheDocument() // Parent story

    // Check task status badges
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Owned')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('AC a2ef8786: filters tasks by status', async () => {
    const user = userEvent.setup()
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // Initially shows all tasks
    expect(screen.getByText('Setup JWT authentication')).toBeInTheDocument()
    expect(screen.getByText('Create login form')).toBeInTheDocument()
    expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()
    expect(screen.getByText(/Showing 3 of 3 tasks/i)).toBeInTheDocument()

    // Filter by 'available' status
    const statusFilter = screen.getByLabelText(/Filter by status/i)
    await user.click(statusFilter)
    await user.click(screen.getByRole('option', { name: 'Available' }))

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
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // Default grouping is by story
    expect(screen.getByRole('heading', { name: /User Authentication/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Project Dashboard/i })).toBeInTheDocument()

    // Change grouping to status
    const groupBySelect = screen.getByLabelText(/Group by/i)
    await user.click(groupBySelect)
    await user.click(screen.getByRole('option', { name: 'By Status' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Available/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Owned/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Completed/i })).toBeInTheDocument()
    })
  })

  it('AC a2ef8786: displays task counts in groups', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // Check badge counts for story groups
    const badges = screen.getAllByTestId(/badge/i)
    expect(badges.some((badge) => badge.textContent === '2')).toBeTruthy() // User Authentication has 2 tasks
    expect(badges.some((badge) => badge.textContent === '1')).toBeTruthy() // Project Dashboard has 1 task
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
    expect(screen.getByText(/Owner: user-2/i)).toBeInTheDocument()
  })

  it('AC d4d41a1f: displays sprint metrics in header', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // Check sprint name, dates, and days remaining
    expect(screen.getByText(/Sprint 1 — Tasks/i)).toBeInTheDocument()
    expect(screen.getByText(/days remaining/i)).toBeInTheDocument()

    // Check progress metrics
    expect(screen.getByText('2')).toBeInTheDocument() // 2 stories
    expect(screen.getByText('3')).toBeInTheDocument() // 3 total tasks
    expect(screen.getByText('1')).toBeInTheDocument() // 1 completed task
    expect(screen.getByText('1')).toBeInTheDocument() // 1 my task
  })

  it('AC d4d41a1f: displays completion percentage', async () => {
    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Sprint 1 — Tasks')).toBeInTheDocument()
    })

    // 1 completed out of 3 tasks = 33%
    expect(screen.getByText(/33%/i)).toBeInTheDocument()
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

    expect(screen.getByText(/Loading sprint task board.../i)).toBeInTheDocument()
  })

  it('handles error state', async () => {
    vi.mocked(sprintApi.getSprint).mockRejectedValue(new Error('Failed to load'))

    render(<SprintTasksPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(
        screen.getByText(/Sprint not found or failed to load/i)
      ).toBeInTheDocument()
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
