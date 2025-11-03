import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Sprint Task Board Page
 *
 * Tests all acceptance criteria for the Sprint Tasks View story:
 * - AC1 (7852bac8): Display all tasks with required information
 * - AC2 (a2ef8786): Filter by status and group by story/status with counts
 * - AC3 (8e8e949d): Visual distinction for available tasks and user's tasks
 * - AC4 (728fd41e): Real-time updates without page refresh
 * - AC5 (d4d41a1f): Sprint metadata in header
 *
 * Route: /projects/[id]/sprints/[sprintId]/tasks
 */

// Helper function to set up test data via API
async function setupSprintWithTasks(page: Page) {
  // This would normally call API endpoints to create test data
  // For now, we'll mock the API responses using page.route()

  const projectId = 'test-project-1'
  const sprintId = 'test-sprint-1'
  const currentUserId = 'user-contributor-1'

  const sprint = {
    id: sprintId,
    teamId: 'team-1',
    name: 'Sprint 1: Authentication',
    goal: 'Complete user authentication features',
    status: 'active',
    capacityPoints: 40,
    committedPoints: 30,
    completedPoints: 10,
    startDate: new Date('2024-01-01').toISOString(),
    endDate: new Date('2024-01-14').toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  }

  const stories = [
    {
      id: 'story-1',
      projectId,
      title: 'User Authentication',
      description: 'Implement user login and signup',
      status: 'inprogress',
      priority: 'high',
      storyPoints: 13,
      labels: ['auth', 'backend'],
      sprintId,
      acceptanceCriteria: [
        {
          id: 'AC1',
          given: 'a user with valid credentials',
          when: 'they submit the login form',
          then: 'they should be authenticated and redirected to dashboard',
        },
        {
          id: 'AC2',
          given: 'a user with invalid credentials',
          when: 'they submit the login form',
          then: 'they should see an error message',
        },
      ],
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-02').toISOString(),
      tasks: [
        {
          id: 'task-1',
          storyId: 'story-1',
          title: 'Setup JWT authentication',
          description: 'Configure JWT token generation and validation',
          acceptanceCriteriaRefs: ['AC1', 'AC2'],
          status: 'available',
          estimatedHours: 4,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-01').toISOString(),
        },
        {
          id: 'task-2',
          storyId: 'story-1',
          title: 'Create login form',
          description: 'Build login UI with form validation',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'owned',
          ownerUserId: currentUserId,
          estimatedHours: 3,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-02').toISOString(),
          ownedAt: new Date('2024-01-02').toISOString(),
        },
        {
          id: 'task-3',
          storyId: 'story-1',
          title: 'Add password validation',
          description: 'Implement password strength requirements',
          acceptanceCriteriaRefs: ['AC2'],
          status: 'inprogress',
          ownerUserId: currentUserId,
          estimatedHours: 2,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-03').toISOString(),
          ownedAt: new Date('2024-01-02').toISOString(),
          inProgressAt: new Date('2024-01-03').toISOString(),
        },
      ],
    },
    {
      id: 'story-2',
      projectId,
      title: 'Project Dashboard',
      description: 'Build project overview dashboard',
      status: 'committed',
      priority: 'medium',
      storyPoints: 8,
      labels: ['ui', 'frontend'],
      sprintId,
      acceptanceCriteria: [
        {
          id: 'AC1',
          given: 'a user views the dashboard',
          when: 'they navigate to the project page',
          then: 'they should see project statistics and recent activity',
        },
      ],
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      tasks: [
        {
          id: 'task-4',
          storyId: 'story-2',
          title: 'Design dashboard layout',
          description: 'Create responsive dashboard grid layout',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'completed',
          ownerUserId: 'user-contributor-2',
          estimatedHours: 4,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-04').toISOString(),
          ownedAt: new Date('2024-01-02').toISOString(),
          completedAt: new Date('2024-01-04').toISOString(),
        },
        {
          id: 'task-5',
          storyId: 'story-2',
          title: 'Implement statistics widgets',
          description: 'Build widgets for project metrics',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'owned',
          ownerUserId: 'user-contributor-2',
          estimatedHours: 5,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-04').toISOString(),
          ownedAt: new Date('2024-01-04').toISOString(),
        },
      ],
    },
  ]

  // Mock API endpoints
  await page.route(`**/api/projects/${projectId}/sprints/${sprintId}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sprint),
    })
  })

  await page.route(`**/api/projects/${projectId}/backlog/stories*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stories),
    })
  })

  return { projectId, sprintId, sprint, stories, currentUserId }
}

test.describe('Sprint Task Board - Navigation and Display', () => {
  test('AC 7852bac8: displays all sprint tasks with required information', async ({ page }) => {
    // Given I am a contributor logged into the system
    // And there is an active sprint for my project
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    // When I navigate to the Sprint Tasks view
    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see all tasks from all stories in the current sprint
    await expect(page.locator('[data-testid="sprint-task-board"]')).toBeVisible()

    // And each task should display: task ID, title, status, owner (if assigned), parent story, and AC refs
    // Task 1 - Available task
    const task1 = page.locator('[data-testid="task-card-task-1"]')
    await expect(task1).toBeVisible()
    await expect(task1).toContainText('task-1') // Task ID
    await expect(task1).toContainText('Setup JWT authentication') // Title
    await expect(task1).toContainText('Available') // Status
    await expect(task1).toContainText('User Authentication') // Parent story
    await expect(task1).toContainText('AC1, AC2') // AC refs

    // Task 2 - Owned by current user
    const task2 = page.locator('[data-testid="task-card-task-2"]')
    await expect(task2).toBeVisible()
    await expect(task2).toContainText('task-2')
    await expect(task2).toContainText('Create login form')
    await expect(task2).toContainText('Owned')
    await expect(task2).toContainText('User Authentication')
    await expect(task2).toContainText('AC1')

    // Task 3 - In Progress by current user
    const task3 = page.locator('[data-testid="task-card-task-3"]')
    await expect(task3).toBeVisible()
    await expect(task3).toContainText('In Progress')

    // Task 4 - Completed by another user
    const task4 = page.locator('[data-testid="task-card-task-4"]')
    await expect(task4).toBeVisible()
    await expect(task4).toContainText('Design dashboard layout')
    await expect(task4).toContainText('Completed')
    await expect(task4).toContainText('user-contributor-2') // Owner

    // Task 5 - Owned by another user
    const task5 = page.locator('[data-testid="task-card-task-5"]')
    await expect(task5).toBeVisible()
    await expect(task5).toContainText('Implement statistics widgets')
    await expect(task5).toContainText('Owned')
    await expect(task5).toContainText('user-contributor-2')
  })

  test('navigates from sprint list to task board', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    // Given I am viewing the sprints list
    await page.route(`**/api/projects/${projectId}/sprints`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: sprintId,
            name: 'Sprint 1: Authentication',
            status: 'active',
          },
        ]),
      })
    })

    await page.goto(`/projects/${projectId}/sprints`)

    // When I click on a sprint to view its tasks
    await page.click('[data-testid="view-sprint-tasks-' + sprintId + '"]')

    // Then I should navigate to the sprint task board
    await expect(page).toHaveURL(`/projects/${projectId}/sprints/${sprintId}/tasks`)
    await expect(page.locator('[data-testid="sprint-task-board"]')).toBeVisible()
  })

  test('displays back navigation to sprints list', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see a back link
    const backLink = page.locator('[data-testid="back-to-sprints"]')
    await expect(backLink).toBeVisible()
    await expect(backLink).toContainText('Back to Sprints')

    // When I click the back link
    await backLink.click()

    // Then I should navigate back to the sprints list
    await expect(page).toHaveURL(`/projects/${projectId}/sprints`)
  })
})

test.describe('Sprint Task Board - Filtering and Grouping', () => {
  test('AC a2ef8786: filters tasks by status', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    // Given I am viewing the sprint task board
    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
    await expect(page.locator('[data-testid="sprint-task-board"]')).toBeVisible()

    // Then I should see all 5 tasks initially
    await expect(page.locator('[data-testid^="task-card-"]')).toHaveCount(5)
    await expect(page.locator('[data-testid="task-count-display"]')).toContainText(
      'Showing 5 of 5 tasks'
    )

    // When I apply filter for "available" status
    await page.click('[data-testid="filter-status"]')
    await page.click('[data-testid="status-option-available"]')

    // Then the task list should update to show only matching tasks
    await expect(page.locator('[data-testid^="task-card-"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="task-count-display"]')).toContainText(
      'Showing 1 of 5 tasks'
    )

    // When I apply additional filter for "owned" status
    await page.click('[data-testid="status-option-owned"]')

    // Then the task list should show both available and owned tasks (3 total)
    await expect(page.locator('[data-testid^="task-card-"]')).toHaveCount(3)
    await expect(page.locator('[data-testid="task-count-display"]')).toContainText(
      'Showing 3 of 5 tasks'
    )

    // When I clear all filters
    await page.click('[data-testid="clear-filters"]')

    // Then all tasks should be visible again
    await expect(page.locator('[data-testid^="task-card-"]')).toHaveCount(5)
  })

  test('AC a2ef8786: groups tasks by story', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Given I am viewing the sprint task board
    // Then tasks should be grouped by story by default
    await expect(page.locator('[data-testid="group-by-select"]')).toHaveValue('story')

    // And I should see story group headers
    const story1Group = page.locator('[data-testid="story-group-story-1"]')
    await expect(story1Group).toBeVisible()
    await expect(story1Group).toContainText('User Authentication')
    await expect(story1Group).toContainText('3 tasks') // Task count

    const story2Group = page.locator('[data-testid="story-group-story-2"]')
    await expect(story2Group).toBeVisible()
    await expect(story2Group).toContainText('Project Dashboard')
    await expect(story2Group).toContainText('2 tasks')

    // And tasks should be displayed under their parent story
    const story1Tasks = page.locator(
      '[data-testid="story-group-story-1"] [data-testid^="task-card-"]'
    )
    await expect(story1Tasks).toHaveCount(3)

    const story2Tasks = page.locator(
      '[data-testid="story-group-story-2"] [data-testid^="task-card-"]'
    )
    await expect(story2Tasks).toHaveCount(2)
  })

  test('AC a2ef8786: groups tasks by status', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I change grouping to "By Status"
    await page.click('[data-testid="group-by-select"]')
    await page.click('[data-testid="group-option-status"]')

    // Then I should see status group headers with counts
    const availableGroup = page.locator('[data-testid="status-group-available"]')
    await expect(availableGroup).toBeVisible()
    await expect(availableGroup).toContainText('Available')
    await expect(availableGroup).toContainText('1 task')

    const ownedGroup = page.locator('[data-testid="status-group-owned"]')
    await expect(ownedGroup).toBeVisible()
    await expect(ownedGroup).toContainText('Owned')
    await expect(ownedGroup).toContainText('2 tasks')

    const inProgressGroup = page.locator('[data-testid="status-group-inprogress"]')
    await expect(inProgressGroup).toBeVisible()
    await expect(inProgressGroup).toContainText('In Progress')
    await expect(inProgressGroup).toContainText('1 task')

    const completedGroup = page.locator('[data-testid="status-group-completed"]')
    await expect(completedGroup).toBeVisible()
    await expect(completedGroup).toContainText('Completed')
    await expect(completedGroup).toContainText('1 task')

    // And tasks should be displayed under their status group
    const availableTasks = page.locator(
      '[data-testid="status-group-available"] [data-testid^="task-card-"]'
    )
    await expect(availableTasks).toHaveCount(1)

    const ownedTasks = page.locator(
      '[data-testid="status-group-owned"] [data-testid^="task-card-"]'
    )
    await expect(ownedTasks).toHaveCount(2)
  })

  test('AC a2ef8786: displays task counts in filter badges', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see task count badges for each status
    await expect(page.locator('[data-testid="filter-badge-available"]')).toContainText('1')
    await expect(page.locator('[data-testid="filter-badge-owned"]')).toContainText('2')
    await expect(page.locator('[data-testid="filter-badge-inprogress"]')).toContainText('1')
    await expect(page.locator('[data-testid="filter-badge-completed"]')).toContainText('1')
  })

  test('combines filtering and grouping', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I filter by "owned" status and group by story
    await page.click('[data-testid="filter-status"]')
    await page.click('[data-testid="status-option-owned"]')

    // Then I should see only stories that have owned tasks
    await expect(page.locator('[data-testid="story-group-story-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="story-group-story-2"]')).toBeVisible()

    // And each story group should show only owned tasks
    const story1Tasks = page.locator(
      '[data-testid="story-group-story-1"] [data-testid^="task-card-"]'
    )
    await expect(story1Tasks).toHaveCount(1) // Only task-2

    const story2Tasks = page.locator(
      '[data-testid="story-group-story-2"] [data-testid^="task-card-"]'
    )
    await expect(story2Tasks).toHaveCount(1) // Only task-5
  })
})

test.describe('Sprint Task Board - Visual Distinction', () => {
  test('AC 8e8e949d: visually distinguishes available tasks', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I see the list of tasks
    // Then available tasks (no owner, not completed) should be clearly visually distinguished
    const availableTask = page.locator('[data-testid="task-card-task-1"]')

    // Should have a visual indicator (badge or highlight)
    await expect(availableTask.locator('[data-testid="task-available-badge"]')).toBeVisible()
    await expect(availableTask.locator('[data-testid="task-available-badge"]')).toContainText(
      'Available to claim'
    )

    // Should have distinct styling
    await expect(availableTask).toHaveClass(/border-blue-500|bg-blue-50/)

    // Should show "I'm on it" button for contributors
    await expect(availableTask.locator('[data-testid="take-ownership-task-1"]')).toBeVisible()
    await expect(availableTask.locator('[data-testid="take-ownership-task-1"]')).toContainText(
      "I'm on it"
    )
  })

  test('AC 8e8e949d: highlights current user own tasks', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I see the list of tasks
    // Then my own tasks should be highlighted or marked
    const myOwnedTask = page.locator('[data-testid="task-card-task-2"]')

    // Should have "My Task" indicator
    await expect(myOwnedTask.locator('[data-testid="my-task-badge"]')).toBeVisible()
    await expect(myOwnedTask.locator('[data-testid="my-task-badge"]')).toContainText('My Task')

    // Should have distinct highlighting
    await expect(myOwnedTask).toHaveClass(/border-green-500|bg-green-50/)

    const myInProgressTask = page.locator('[data-testid="task-card-task-3"]')
    await expect(myInProgressTask.locator('[data-testid="my-task-badge"]')).toBeVisible()
  })

  test('AC 8e8e949d: shows owner name for tasks owned by others', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I see tasks owned by others
    // Then they should show the owner name
    const otherUserTask = page.locator('[data-testid="task-card-task-4"]')

    await expect(otherUserTask.locator('[data-testid="task-owner"]')).toBeVisible()
    await expect(otherUserTask.locator('[data-testid="task-owner"]')).toContainText(
      'Owner: user-contributor-2'
    )

    // Should not show "My Task" badge
    await expect(otherUserTask.locator('[data-testid="my-task-badge"]')).not.toBeVisible()

    // Should not show action buttons for other users' tasks
    await expect(otherUserTask.locator('[data-testid="take-ownership-task-4"]')).not.toBeVisible()
  })

  test('displays task cards with proper visual hierarchy', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const taskCard = page.locator('[data-testid="task-card-task-1"]')

    // Should display all information in clear hierarchy
    // Title should be prominent
    await expect(taskCard.locator('[data-testid="task-title"]')).toHaveClass(
      /text-lg|font-semibold/
    )

    // Metadata should be visible but secondary
    await expect(taskCard.locator('[data-testid="task-metadata"]')).toBeVisible()

    // Status badge should be clearly visible
    await expect(taskCard.locator('[data-testid="task-status-badge"]')).toBeVisible()

    // AC refs should be easily scannable
    await expect(taskCard.locator('[data-testid="task-ac-refs"]')).toBeVisible()
  })
})

test.describe('Sprint Task Board - Real-time Updates', () => {
  test('AC 728fd41e: shows real-time connection status', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    // Mock WebSocket connection
    await page.route('**/ws/**', (route) => {
      route.fulfill({ status: 101 }) // WebSocket upgrade
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see connection indicator
    const connectionIndicator = page.locator('[data-testid="connection-indicator"]')
    await expect(connectionIndicator).toBeVisible()

    // Should show connected status
    await expect(page.locator('text=Connected to real-time updates')).toBeVisible()
    await expect(connectionIndicator).toHaveClass(/bg-green-500/)
  })

  test('AC 728fd41e: updates board when another contributor takes ownership', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Given I am viewing the sprint task board
    // And task-1 is available
    const task1 = page.locator('[data-testid="task-card-task-1"]')
    await expect(task1.locator('[data-testid="task-status-badge"]')).toContainText('Available')

    // When another contributor takes ownership via WebSocket event
    await page.evaluate(() => {
      // Simulate WebSocket event
      window.dispatchEvent(
        new CustomEvent('task-event', {
          detail: {
            type: 'ownership_taken',
            task_id: 'task-1',
            story_id: 'story-1',
            owner_user_id: 'user-contributor-3',
          },
        })
      )
    })

    // Then the board should update in real-time without page refresh
    await expect(task1.locator('[data-testid="task-status-badge"]')).toContainText('Owned', {
      timeout: 5000,
    })
    await expect(task1.locator('[data-testid="task-owner"]')).toContainText('user-contributor-3')

    // And I should see a subtle notification of the change
    await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible()
    await expect(page.locator('[data-testid="toast-notification"]')).toContainText('Task claimed')
  })

  test('AC 728fd41e: updates board when task status changes', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Given task-2 is in "owned" status
    const task2 = page.locator('[data-testid="task-card-task-2"]')
    await expect(task2.locator('[data-testid="task-status-badge"]')).toContainText('Owned')

    // When the task status changes to "In Progress" via WebSocket
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('task-event', {
          detail: {
            type: 'status_changed',
            task_id: 'task-2',
            story_id: 'story-1',
            old_status: 'owned',
            new_status: 'inprogress',
          },
        })
      )
    })

    // Then the status should update without page refresh
    await expect(task2.locator('[data-testid="task-status-badge"]')).toContainText('In Progress', {
      timeout: 5000,
    })

    // And I should see a notification
    await expect(page.locator('[data-testid="toast-notification"]')).toContainText('Task updated')
  })

  test('AC 728fd41e: updates board when ownership is released', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Given task-5 is owned by user-contributor-2
    const task5 = page.locator('[data-testid="task-card-task-5"]')
    await expect(task5.locator('[data-testid="task-status-badge"]')).toContainText('Owned')
    await expect(task5.locator('[data-testid="task-owner"]')).toContainText('user-contributor-2')

    // When ownership is released via WebSocket
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('task-event', {
          detail: {
            type: 'ownership_released',
            task_id: 'task-5',
            story_id: 'story-2',
          },
        })
      )
    })

    // Then the task should become available
    await expect(task5.locator('[data-testid="task-status-badge"]')).toContainText('Available', {
      timeout: 5000,
    })
    await expect(task5.locator('[data-testid="task-owner"]')).not.toBeVisible()

    // And I should see a notification
    await expect(page.locator('[data-testid="toast-notification"]')).toContainText('Task released')
  })

  test('handles WebSocket disconnection gracefully', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Initially connected
    const connectionIndicator = page.locator('[data-testid="connection-indicator"]')
    await expect(connectionIndicator).toHaveClass(/bg-green-500/)

    // Simulate disconnection
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ws-disconnect'))
    })

    // Should show disconnected status
    await expect(connectionIndicator).toHaveClass(/bg-gray-400/, { timeout: 3000 })
    await expect(page.locator('text=Connecting...')).toBeVisible()

    // Board should still be functional (show stale data)
    await expect(page.locator('[data-testid="sprint-task-board"]')).toBeVisible()
  })
})

test.describe('Sprint Task Board - Sprint Metadata', () => {
  test('AC d4d41a1f: displays sprint name, dates, and days remaining', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    const sprintHeader = page.locator('[data-testid="sprint-header"]')
    await expect(sprintHeader).toBeVisible()

    // Then I should see the sprint name
    await expect(sprintHeader).toContainText('Sprint 1: Authentication')

    // And I should see start and end dates
    await expect(sprintHeader.locator('[data-testid="sprint-start-date"]')).toContainText('Jan 1')
    await expect(sprintHeader.locator('[data-testid="sprint-end-date"]')).toContainText('Jan 14')

    // And I should see days remaining
    await expect(sprintHeader.locator('[data-testid="sprint-days-remaining"]')).toBeVisible()
    await expect(sprintHeader.locator('[data-testid="sprint-days-remaining"]')).toContainText(
      /\d+ days? remaining/
    )
  })

  test('AC d4d41a1f: displays progress indicator with completion percentage', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const sprintHeader = page.locator('[data-testid="sprint-header"]')

    // Then I should see a progress indicator
    const progressBar = sprintHeader.locator('[data-testid="sprint-progress-bar"]')
    await expect(progressBar).toBeVisible()

    // And I should see percentage of tasks completed (1 completed out of 5 = 20%)
    await expect(sprintHeader.locator('[data-testid="sprint-progress-percentage"]')).toContainText(
      '20%'
    )

    // Should show completed vs total tasks
    await expect(sprintHeader.locator('[data-testid="sprint-progress-text"]')).toContainText(
      '1 of 5 tasks completed'
    )
  })

  test('AC d4d41a1f: displays total number of stories in sprint', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const sprintHeader = page.locator('[data-testid="sprint-header"]')

    // Then I should see the total number of stories
    await expect(sprintHeader.locator('[data-testid="sprint-story-count"]')).toBeVisible()
    await expect(sprintHeader.locator('[data-testid="sprint-story-count"]')).toContainText(
      '2 stories'
    )
  })

  test('displays sprint goal', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const sprintHeader = page.locator('[data-testid="sprint-header"]')

    // Should display sprint goal
    await expect(sprintHeader.locator('[data-testid="sprint-goal"]')).toBeVisible()
    await expect(sprintHeader.locator('[data-testid="sprint-goal"]')).toContainText(
      'Complete user authentication features'
    )
  })

  test('displays sprint capacity and commitment', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const sprintHeader = page.locator('[data-testid="sprint-header"]')

    // Should show capacity and committed points
    await expect(sprintHeader.locator('[data-testid="sprint-capacity"]')).toContainText(
      '30 / 40 points'
    )
  })

  test('updates progress when tasks complete', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    const sprintHeader = page.locator('[data-testid="sprint-header"]')

    // Initially 20% complete (1 of 5)
    await expect(sprintHeader.locator('[data-testid="sprint-progress-percentage"]')).toContainText(
      '20%'
    )

    // When another task completes
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('task-event', {
          detail: {
            type: 'status_changed',
            task_id: 'task-2',
            story_id: 'story-1',
            old_status: 'owned',
            new_status: 'completed',
          },
        })
      )
    })

    // Progress should update to 40% (2 of 5)
    await expect(sprintHeader.locator('[data-testid="sprint-progress-percentage"]')).toContainText(
      '40%',
      { timeout: 5000 }
    )
    await expect(sprintHeader.locator('[data-testid="sprint-progress-text"]')).toContainText(
      '2 of 5 tasks completed'
    )
  })
})

test.describe('Sprint Task Board - Error Handling', () => {
  test('displays error state when sprint not found', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'invalid-sprint'

    // Mock API to return 404
    await page.route(`**/api/projects/${projectId}/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Sprint not found' }),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should display error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Error Loading Sprint'
    )

    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  })

  test('displays loading state while fetching data', async ({ page }) => {
    const { projectId, sprintId } = await setupSprintWithTasks(page)

    // Mock delayed response
    await page.route(`**/api/projects/${projectId}/sprints/${sprintId}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: sprintId,
          name: 'Sprint 1',
          status: 'active',
        }),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show loading state
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
    await expect(page.locator('text=Loading sprint tasks...')).toBeVisible()
  })

  test('displays empty state when sprint has no tasks', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'empty-sprint'

    // Mock sprint with no stories
    await page.route(`**/api/projects/${projectId}/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: sprintId,
          name: 'Empty Sprint',
          status: 'active',
        }),
      })
    })

    await page.route(`**/api/projects/${projectId}/backlog/stories*`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show empty state
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible()
    await expect(page.locator('[data-testid="empty-state"]')).toContainText('No tasks found')
  })
})
