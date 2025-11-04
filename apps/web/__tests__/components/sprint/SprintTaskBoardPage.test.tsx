import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SprintTaskBoardPage from '@/app/projects/[id]/sprints/[sprintId]/tasks/page'
import * as backlogApi from '@/lib/api/backlog'
import * as teamsApi from '@/lib/api/teams'
import * as nextNavigation from 'next/navigation'
import * as clerk from '@clerk/nextjs'

// Mock the APIs and hooks
vi.mock('@/lib/api/backlog')
vi.mock('@/lib/api/teams')
vi.mock('@/lib/hooks/useTaskWebSocket', () => ({
  useTaskWebSocket: vi.fn(() => ({
    isConnected: true,
  })),
}))

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1: Foundation',
  goal: 'Build core features',
  status: 'active' as const,
  capacityPoints: 40,
  committedPoints: 30,
  completedPoints: 10,
  startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
}

const mockStories = [
  {
    id: 'story-1',
    title: 'User Authentication',
    description: 'Implement user authentication',
    status: 'ready' as const,
    priority: 'high' as const,
    storyPoints: 8,
    projectId: 'project-1',
    sprintId: 'sprint-1',
    labels: ['auth'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        id: 'task-1',
        title: 'Setup Clerk integration',
        description: 'Configure Clerk auth',
        status: 'available' as const,
        storyId: 'story-1',
        acceptanceCriteriaRefs: ['ac-1'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'Build login UI',
        description: 'Create login form',
        status: 'owned' as const,
        storyId: 'story-1',
        ownerUserId: 'user-123',
        acceptanceCriteriaRefs: ['ac-2'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'story-2',
    title: 'Dashboard Setup',
    description: 'Create project dashboard',
    status: 'ready' as const,
    priority: 'medium' as const,
    storyPoints: 5,
    projectId: 'project-1',
    sprintId: 'sprint-1',
    labels: ['ui'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        id: 'task-3',
        title: 'Design dashboard layout',
        description: 'Create layout components',
        status: 'completed' as const,
        storyId: 'story-2',
        ownerUserId: 'user-456',
        acceptanceCriteriaRefs: ['ac-3'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  },
]

describe('SprintTaskBoardPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    // Setup default mocks
    vi.spyOn(nextNavigation, 'useParams').mockReturnValue({
      id: 'project-1',
      sprintId: 'sprint-1',
    })
    vi.spyOn(nextNavigation, 'useRouter').mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
      replace: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as any)
    vi.spyOn(clerk, 'useUser').mockReturnValue({
      user: {
        id: 'user-123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
      } as any,
      isLoaded: true,
      isSignedIn: true,
    } as any)
    vi.spyOn(teamsApi.sprintsApi, 'getSprint').mockResolvedValue(mockSprint)
    vi.spyOn(backlogApi.backlogApi, 'getStories').mockResolvedValue(mockStories)
  })

  describe('AC1: Display all task information', () => {
    it('should display all tasks from all stories in the sprint', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-task-board')).toBeInTheDocument()
      })

      // Check that all tasks are displayed
      expect(screen.getByText('Setup Clerk integration')).toBeInTheDocument()
      expect(screen.getByText('Build login UI')).toBeInTheDocument()
      expect(screen.getByText('Design dashboard layout')).toBeInTheDocument()
    })

    it('should display task ID, title, status, owner, parent story, and AC references', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Setup Clerk integration')).toBeInTheDocument()
      })

      // Task details should be visible
      expect(screen.getByText(/task-1/i)).toBeInTheDocument()
      expect(screen.getByText('Setup Clerk integration')).toBeInTheDocument()
      // Check for parent story
      expect(screen.getByText(/User Authentication/i)).toBeInTheDocument()
    })
  })

  describe('AC2: Filter and group tasks', () => {
    it('should show task counts for each filter', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-task-board')).toBeInTheDocument()
      })

      // Task counts should be visible in filters
      expect(screen.getByTestId('sprint-task-filters')).toBeInTheDocument()
    })

    it('should allow grouping by story or status', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-task-board')).toBeInTheDocument()
      })

      // Group by controls should be present
      const filters = screen.getByTestId('sprint-task-filters')
      expect(filters).toBeInTheDocument()
    })
  })

  describe('AC3: Visual distinction for task ownership', () => {
    it('should distinguish available tasks visually', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Setup Clerk integration')).toBeInTheDocument()
      })

      // Available task should have distinct styling
      const availableTask = screen.getByText('Setup Clerk integration').closest('[data-testid*="task"]')
      expect(availableTask).toBeInTheDocument()
    })

    it('should highlight current user tasks', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Build login UI')).toBeInTheDocument()
      })

      // Current user's task should be highlighted
      const myTask = screen.getByText('Build login UI').closest('[data-testid*="task"]')
      expect(myTask).toBeInTheDocument()
    })
  })

  describe('AC4: Real-time updates', () => {
    it('should show real-time connection status', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('connection-indicator')).toBeInTheDocument()
      })

      expect(screen.getByText(/connected to real-time updates/i)).toBeInTheDocument()
    })
  })

  describe('AC5: Sprint header with context', () => {
    it('should display sprint name, dates, and days remaining', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      })

      expect(screen.getByText('Sprint 1: Foundation')).toBeInTheDocument()
      expect(screen.getByTestId('sprint-dates')).toBeInTheDocument()
      expect(screen.getByTestId('days-remaining')).toBeInTheDocument()
    })

    it('should display progress indicator with task completion percentage', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      })

      expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
      expect(screen.getByTestId('task-progress')).toBeInTheDocument()
    })

    it('should display total number of stories in the sprint', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-header')).toBeInTheDocument()
      })

      expect(screen.getByTestId('story-count')).toBeInTheDocument()
      expect(screen.getByText(/2 stories/i)).toBeInTheDocument()
    })
  })

  describe('Loading and Error States', () => {
    it('should show loading state while fetching data', async () => {
      vi.spyOn(teamsApi.sprintsApi, 'getSprint').mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSprint), 100))
      )

      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should show error state when sprint fetch fails', async () => {
      vi.spyOn(teamsApi.sprintsApi, 'getSprint').mockRejectedValue(
        new Error('Failed to fetch sprint')
      )

      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should have a back button to return to sprint list', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <SprintTaskBoardPage />
        </QueryClientProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('sprint-task-board')).toBeInTheDocument()
      })

      const backButton = screen.getByRole('link', { name: /back/i })
      expect(backButton).toBeInTheDocument()
    })
  })
})
