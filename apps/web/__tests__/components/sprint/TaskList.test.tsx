import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TaskList } from '@/components/sprint/TaskList'
import { Story, Task } from '@/lib/types/story'

describe('TaskList', () => {
  const mockStories: Story[] = [
    {
      id: 'story-1',
      projectId: 'project-1',
      title: 'Story 1',
      status: 'inprogress',
      labels: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tasks: [
        {
          id: 'task-1',
          storyId: 'story-1',
          title: 'Task 1',
          acceptanceCriteriaRefs: ['ac-1'],
          status: 'available',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 'task-2',
          storyId: 'story-1',
          title: 'Task 2',
          acceptanceCriteriaRefs: ['ac-2'],
          status: 'owned',
          ownerUserId: 'user-1',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    },
    {
      id: 'story-2',
      projectId: 'project-1',
      title: 'Story 2',
      status: 'inprogress',
      labels: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tasks: [
        {
          id: 'task-3',
          storyId: 'story-2',
          title: 'Task 3',
          acceptanceCriteriaRefs: ['ac-3'],
          status: 'completed',
          ownerUserId: 'user-2',
          completedAt: '2025-01-02T00:00:00Z',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    },
  ]

  it('renders all tasks when no filters applied', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
  })

  it('filters tasks by selected status', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={['available']}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.queryByText('Task 2')).not.toBeInTheDocument()
    expect(screen.queryByText('Task 3')).not.toBeInTheDocument()
  })

  it('filters tasks by multiple statuses', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={['owned', 'completed']}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
  })

  it('groups tasks by story', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    expect(screen.getByText('Story 1')).toBeInTheDocument()
    expect(screen.getByText('Story 2')).toBeInTheDocument()
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument() // Story 1 has 2 tasks
    expect(screen.getByText(/1 task/i)).toBeInTheDocument() // Story 2 has 1 task
  })

  it('groups tasks by status', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="status"
        currentUserId="user-current"
      />
    )

    // Check for group headings (CardTitle elements)
    expect(screen.getByTestId('group-available')).toBeInTheDocument()
    expect(screen.getByTestId('group-owned')).toBeInTheDocument()
    expect(screen.getByTestId('group-completed')).toBeInTheDocument()
  })

  it('shows task counts in groups when grouped by story', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    // Story 1 has 2 tasks
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument()
    // Story 2 has 1 task
    expect(screen.getByText(/1 task/i)).toBeInTheDocument()
  })

  it('shows task counts in groups when grouped by status', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="status"
        currentUserId="user-current"
      />
    )

    // Use testids for more specific assertions
    expect(screen.getByTestId('group-count-available')).toHaveTextContent('1 task')
    expect(screen.getByTestId('group-count-owned')).toHaveTextContent('1 task')
    expect(screen.getByTestId('group-count-completed')).toHaveTextContent('1 task')
  })

  it('displays filtered task counts in groups', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={['available', 'owned']}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    // Story 1 has 2 tasks that match filters (available + owned)
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument()
    // Story 2 has 0 tasks that match filters (only completed)
    expect(screen.queryByText('Story 2')).not.toBeInTheDocument()
  })

  it('shows empty state when no tasks match filters', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={['inprogress']}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    expect(screen.getByText(/No tasks match your filters/i)).toBeInTheDocument()
  })

  it('displays task details correctly', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    // Check task IDs are displayed
    expect(screen.getByText(/task-1/i)).toBeInTheDocument()
    expect(screen.getByText(/task-2/i)).toBeInTheDocument()
    expect(screen.getByText(/task-3/i)).toBeInTheDocument()

    // Check AC references are shown (use getAllByText since multiple tasks have 1 AC)
    const acElements = screen.getAllByText(/1 AC/i)
    expect(acElements.length).toBeGreaterThan(0)
  })

  it('highlights tasks owned by current user', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-1"
      />
    )

    const task2Element = screen.getByText('Task 2').closest('[data-testid^="task-card"]')
    expect(task2Element).toHaveAttribute('data-my-task', 'true')
  })

  it('shows owner name for tasks owned by others', () => {
    render(
      <TaskList
        stories={mockStories}
        selectedStatuses={[]}
        groupBy="story"
        currentUserId="user-current"
      />
    )

    // Task 2 owned by user-1
    const task2Card = screen.getByText('Task 2').closest('[data-testid^="task-card"]')
    expect(task2Card).toHaveTextContent('user-1')

    // Task 3 owned by user-2
    const task3Card = screen.getByText('Task 3').closest('[data-testid^="task-card"]')
    expect(task3Card).toHaveTextContent('user-2')
  })
})
