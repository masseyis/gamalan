import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SprintTaskBoard } from '@/components/sprint/SprintTaskBoard'
import { Story } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'

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

// Mock UserContext provider
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
  UserContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock TanStack Query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('SprintTaskBoard Integration', () => {
  let mockStories: Story[]
  let mockSprint: Sprint

  beforeEach(() => {
    mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      goal: 'Test sprint goal',
      startDate: '2024-12-01',
      endDate: '2024-12-14',
      status: 'active',
      capacityPoints: 20,
      committedPoints: 15,
      completedPoints: 5,
      createdAt: '2024-11-20T00:00:00Z',
      updatedAt: '2024-11-20T00:00:00Z',
    }

    mockStories = [
      {
        id: 'story-1',
        projectId: 'project-1',
        title: 'User Authentication',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: '[Frontend] Login form',
            status: 'completed',
            acceptanceCriteriaRefs: ['ac-1'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-2',
            storyId: 'story-1',
            title: '[Backend] JWT implementation',
            status: 'inprogress',
            ownerUserId: 'user-1',
            acceptanceCriteriaRefs: ['ac-1', 'ac-2'],
            createdAt: '2024-12-20T00:00:00Z',
            updatedAt: '2024-12-20T00:00:00Z',
          },
          {
            id: 'task-3',
            storyId: 'story-1',
            title: '[QA] Auth tests',
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
        title: 'Dashboard Widgets',
        status: 'inprogress',
        labels: [],
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: '2024-12-20T00:00:00Z',
        tasks: [
          {
            id: 'task-4',
            storyId: 'story-2',
            title: '[Frontend] Widget components',
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

  describe('Full integration', () => {
    it('should render all main components', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Sprint header should be visible
      expect(screen.getByText('Sprint 1')).toBeInTheDocument()

      // Filters should be visible
      expect(screen.getByTestId('sprint-task-filters')).toBeInTheDocument()

      // Task list should be visible
      expect(screen.getByTestId('sprint-task-list')).toBeInTheDocument()

      // Connection indicator should be visible
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument()
    })

    it('should show correct task counts in filter controls', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Check task counts (1 available, 1 owned, 1 inprogress, 1 completed)
      const countElements = screen.getAllByText('1')
      expect(countElements.length).toBeGreaterThanOrEqual(4) // At least 4 counts of "1"
    })

    it('should filter tasks when status filter is applied', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // All tasks should be visible initially
      expect(screen.getByText('[Frontend] Login form')).toBeInTheDocument()
      expect(screen.getByText('[Backend] JWT implementation')).toBeInTheDocument()
      expect(screen.getByText('[QA] Auth tests')).toBeInTheDocument()
      expect(screen.getByText('[Frontend] Widget components')).toBeInTheDocument()

      // Apply available filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Only available tasks should be visible
      expect(screen.queryByText('[Frontend] Login form')).not.toBeInTheDocument()
      expect(screen.queryByText('[Backend] JWT implementation')).not.toBeInTheDocument()
      expect(screen.getByText('[QA] Auth tests')).toBeInTheDocument()
      expect(screen.queryByText('[Frontend] Widget components')).not.toBeInTheDocument()
    })

    it('should change grouping when group by option is changed', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Initially grouped by story
      expect(screen.getByText('User Authentication')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument()

      // Change to group by status
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Should now show status groups
      expect(screen.getByTestId('status-group-available')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-owned')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-inprogress')).toBeInTheDocument()
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()
    })

    it('should apply both filter and grouping together', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Apply completed filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i })
      fireEvent.click(completedCheckbox)

      // Change to group by status
      const statusRadio = screen.getByRole('radio', { name: /group by status/i })
      fireEvent.click(statusRadio)

      // Should only show completed status group
      expect(screen.getByTestId('status-group-completed')).toBeInTheDocument()
      expect(screen.queryByTestId('status-group-available')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-group-owned')).not.toBeInTheDocument()
      expect(screen.queryByTestId('status-group-inprogress')).not.toBeInTheDocument()

      // Should show only the completed task
      expect(screen.getByText('[Frontend] Login form')).toBeInTheDocument()
      expect(screen.queryByText('[Backend] JWT implementation')).not.toBeInTheDocument()
    })

    it('should clear filters when clear filters button is clicked', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Apply a filter
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // Clear filters button should appear
      expect(screen.getByText(/clear filters/i)).toBeInTheDocument()

      // Click clear filters
      const clearButton = screen.getByText(/clear filters/i)
      fireEvent.click(clearButton)

      // All tasks should be visible again
      expect(screen.getByText('[Frontend] Login form')).toBeInTheDocument()
      expect(screen.getByText('[Backend] JWT implementation')).toBeInTheDocument()
      expect(screen.getByText('[QA] Auth tests')).toBeInTheDocument()
      expect(screen.getByText('[Frontend] Widget components')).toBeInTheDocument()
    })
  })

  describe('AC2: Task counts are visible in filters', () => {
    it('should display accurate task counts for each status', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Each status should show count badge
      const filters = screen.getByTestId('status-filters')
      expect(filters).toBeInTheDocument()

      // Counts should be visible (1 available, 1 owned, 1 inprogress, 1 completed)
      const countBadges = screen.getAllByText('1')
      expect(countBadges.length).toBeGreaterThanOrEqual(4)
    })

    it('should update task counts when filters change the visible tasks', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      // Initial counts should be correct
      const filters = screen.getByTestId('status-filters')
      expect(filters).toHaveTextContent('1') // Should appear multiple times

      // Apply filter (counts in filter component don't change, but displayed groups do)
      const availableCheckbox = screen.getByRole('checkbox', { name: /available/i })
      fireEvent.click(availableCheckbox)

      // The filter counts remain the same (showing total counts)
      // but the displayed groups show filtered counts
      expect(screen.getByText('1 task')).toBeInTheDocument()
    })
  })

  describe('AC5: Sprint header information', () => {
    it('should display sprint name, dates, and progress', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />)

      // Sprint name
      expect(screen.getByText('Sprint 1')).toBeInTheDocument()

      // Progress percentage (1 completed out of 4 tasks = 25%)
      expect(screen.getByText('25%')).toBeInTheDocument()

      // Total stories count
      expect(screen.getByText('2 stories')).toBeInTheDocument()
    })
  })

  describe('Connection status', () => {
    it('should show connected status indicator', () => {
      render(
        <SprintTaskBoard sprint={mockSprint} stories={mockStories} currentUserId="user-1" />
      )

      expect(screen.getByText(/connected to real-time updates/i)).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should handle sprint with no tasks', () => {
      const emptyStories: Story[] = [
        {
          id: 'story-1',
          projectId: 'project-1',
          title: 'Empty Story',
          status: 'inprogress',
          labels: [],
          createdAt: '2024-12-20T00:00:00Z',
          updatedAt: '2024-12-20T00:00:00Z',
          tasks: [],
        } as Story,
      ]

      render(<SprintTaskBoard sprint={mockSprint} stories={emptyStories} currentUserId="user-1" />)

      expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
    })

    it('should handle sprint with no stories', () => {
      render(<SprintTaskBoard sprint={mockSprint} stories={[]} currentUserId="user-1" />)

      expect(screen.getByText('0 stories')).toBeInTheDocument()
      expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
    })
  })
})
