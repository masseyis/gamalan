import { test, expect, Page } from '@playwright/test'

/**
 * E2E Tests for Sprint Context Header Display
 *
 * Tests AC5 (d4d41a1f): Sprint metadata in header
 *
 * Acceptance Criteria:
 * Given: I am viewing the sprint task board
 * When: I look at the page header or context section
 * Then: I should see:
 *   - Sprint name
 *   - Start date and end date
 *   - Days remaining
 *   - Progress indicator showing percentage of tasks completed
 *   - Total number of stories in the sprint
 *
 * Route: /projects/[id]/sprints/[sprintId]/tasks
 */

// Helper function to set up test sprint data
async function setupSprintData(page: Page) {
  const projectId = 'test-project-1'
  const sprintId = 'test-sprint-1'

  // Create sprint with specific dates for predictable testing
  const startDate = new Date('2024-01-01T00:00:00Z')
  const endDate = new Date('2024-01-14T23:59:59Z')

  const sprint = {
    id: sprintId,
    teamId: 'team-1',
    name: 'Sprint Alpha: Core Features',
    goal: 'Deliver authentication and dashboard features',
    status: 'active' as const,
    capacityPoints: 40,
    committedPoints: 30,
    completedPoints: 10,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-01-01').toISOString(),
  }

  const stories = [
    {
      id: 'story-1',
      projectId,
      title: 'User Authentication',
      description: 'Implement user login',
      status: 'inprogress' as const,
      priority: 'high' as const,
      storyPoints: 13,
      labels: ['auth'],
      sprintId,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      tasks: [
        {
          id: 'task-1',
          storyId: 'story-1',
          title: 'Setup JWT',
          description: 'Configure JWT tokens',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'available' as const,
          estimatedHours: 4,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-01').toISOString(),
        },
        {
          id: 'task-2',
          storyId: 'story-1',
          title: 'Create login form',
          description: 'Build login UI',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'completed' as const,
          ownerUserId: 'user-1',
          estimatedHours: 3,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-03').toISOString(),
          ownedAt: new Date('2024-01-02').toISOString(),
          completedAt: new Date('2024-01-03').toISOString(),
        },
      ],
    },
    {
      id: 'story-2',
      projectId,
      title: 'Project Dashboard',
      description: 'Build dashboard',
      status: 'committed' as const,
      priority: 'medium' as const,
      storyPoints: 8,
      labels: ['ui'],
      sprintId,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      tasks: [
        {
          id: 'task-3',
          storyId: 'story-2',
          title: 'Design layout',
          description: 'Create grid layout',
          acceptanceCriteriaRefs: ['AC1'],
          status: 'inprogress' as const,
          ownerUserId: 'user-2',
          estimatedHours: 4,
          createdAt: new Date('2024-01-01').toISOString(),
          updatedAt: new Date('2024-01-02').toISOString(),
          ownedAt: new Date('2024-01-02').toISOString(),
          inProgressAt: new Date('2024-01-02').toISOString(),
        },
      ],
    },
    {
      id: 'story-3',
      projectId,
      title: 'User Profile',
      description: 'User profile page',
      status: 'ready' as const,
      priority: 'low' as const,
      storyPoints: 5,
      labels: ['profile'],
      sprintId,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      tasks: [],
    },
  ]

  // Mock API endpoints
  await page.route(`**/api/v1/projects/${projectId}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: projectId,
        name: 'Test Project',
        teamId: 'team-1',
      }),
    })
  })

  await page.route(`**/api/v1/teams/team-1/sprints/${sprintId}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sprint),
    })
  })

  await page.route(`**/api/v1/projects/${projectId}/backlog/stories?sprintId=${sprintId}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(stories),
    })
  })

  return { projectId, sprintId, sprint, stories }
}

test.describe('Sprint Context Header Display - AC5', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'user-1', role: 'contributor' } }),
      })
    })
  })

  test('AC d4d41a1f: displays sprint name in header', async ({ page }) => {
    // Given I am a contributor viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    // When I navigate to the sprint tasks view
    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see the sprint name
    const sprintHeader = page.locator('[data-testid="sprint-header"]')
    await expect(sprintHeader).toBeVisible()

    const sprintName = page.locator('[data-testid="sprint-name"]')
    await expect(sprintName).toBeVisible()
    await expect(sprintName).toHaveText('Sprint Alpha: Core Features')
  })

  test('AC d4d41a1f: displays sprint goal', async ({ page }) => {
    // Given I am viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Then I should see the sprint goal
    const sprintGoal = page.locator('[data-testid="sprint-goal"]')
    await expect(sprintGoal).toBeVisible()
    await expect(sprintGoal).toHaveText('Deliver authentication and dashboard features')
  })

  test('AC d4d41a1f: displays start and end dates', async ({ page }) => {
    // Given I am viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see start and end dates
    const sprintDates = page.locator('[data-testid="sprint-dates"]')
    await expect(sprintDates).toBeVisible()

    // Verify date format matches expected pattern: "Jan 1, 2024 - Jan 14, 2024"
    const datesText = await sprintDates.textContent()
    expect(datesText).toMatch(/Jan\s+1,\s+2024\s+-\s+Jan\s+14,\s+2024/)
  })

  test('AC d4d41a1f: displays days remaining', async ({ page }) => {
    // Given I am viewing the sprint task board with a sprint ending in the future
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see days remaining
    const daysRemaining = page.locator('[data-testid="days-remaining"]')
    await expect(daysRemaining).toBeVisible()

    // Verify it shows a number of days with proper pluralization
    const daysText = await daysRemaining.textContent()
    expect(daysText).toMatch(/\d+\s+days?\s+remaining/)
  })

  test('AC d4d41a1f: displays total number of stories in sprint', async ({ page }) => {
    // Given I am viewing the sprint task board with 3 stories
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see the total number of stories
    const storyCount = page.locator('[data-testid="story-count"]')
    await expect(storyCount).toBeVisible()
    await expect(storyCount).toHaveText('3 stories')
  })

  test('AC d4d41a1f: displays progress indicator with completion percentage', async ({ page }) => {
    // Given I am viewing the sprint task board
    // With 3 total tasks: 1 available, 1 completed, 1 in progress
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see a progress indicator showing percentage of tasks completed
    const progressPercentage = page.locator('[data-testid="progress-percentage"]')
    await expect(progressPercentage).toBeVisible()

    // 1 completed out of 3 tasks = 33%
    await expect(progressPercentage).toHaveText('33%')
  })

  test('AC d4d41a1f: displays task progress count', async ({ page }) => {
    // Given I am viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see completed vs total task count
    const taskProgress = page.locator('[data-testid="task-progress"]')
    await expect(taskProgress).toBeVisible()

    // 1 completed out of 3 tasks
    await expect(taskProgress).toHaveText('1 of 3 tasks')
  })

  test('AC d4d41a1f: displays visual progress bar', async ({ page }) => {
    // Given I am viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header
    // Then I should see a visual progress bar
    const progressBar = page.locator('[data-testid="progress-bar"]')
    await expect(progressBar).toBeVisible()

    // Verify the progress bar has the correct value attribute (33%)
    const progressValue = await progressBar.getAttribute('aria-valuenow')
    expect(progressValue).toBe('33')
  })

  test('AC d4d41a1f: displays all header elements together', async ({ page }) => {
    // Given I am viewing the sprint task board
    const { projectId, sprintId } = await setupSprintData(page)

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // When I look at the page header or context section
    const sprintHeader = page.locator('[data-testid="sprint-header"]')
    await expect(sprintHeader).toBeVisible()

    // Then I should see all required elements together
    // Sprint name
    await expect(page.locator('[data-testid="sprint-name"]')).toBeVisible()

    // Sprint dates
    await expect(page.locator('[data-testid="sprint-dates"]')).toBeVisible()

    // Days remaining
    await expect(page.locator('[data-testid="days-remaining"]')).toBeVisible()

    // Story count
    await expect(page.locator('[data-testid="story-count"]')).toBeVisible()

    // Progress percentage
    await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible()

    // Task progress count
    await expect(page.locator('[data-testid="task-progress"]')).toBeVisible()

    // Progress bar
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible()
  })

  test('displays correct progress with no completed tasks', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'test-sprint-no-progress'

    const sprint = {
      id: sprintId,
      teamId: 'team-1',
      name: 'Sprint Beta',
      goal: 'Test sprint',
      status: 'active' as const,
      capacityPoints: 40,
      committedPoints: 30,
      completedPoints: 0,
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-01-14').toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    }

    const stories = [
      {
        id: 'story-1',
        projectId,
        title: 'Story 1',
        description: 'Test story',
        status: 'committed' as const,
        priority: 'high' as const,
        storyPoints: 5,
        labels: [],
        sprintId,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: 'Task 1',
            description: 'Test task',
            acceptanceCriteriaRefs: ['AC1'],
            status: 'available' as const,
            estimatedHours: 4,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-01').toISOString(),
          },
        ],
      },
    ]

    await page.route(`**/api/v1/projects/${projectId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: projectId, name: 'Test Project', teamId: 'team-1' }),
      })
    })

    await page.route(`**/api/v1/teams/team-1/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sprint),
      })
    })

    await page.route(`**/api/v1/projects/${projectId}/backlog/stories?sprintId=${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stories),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show 0% progress
    await expect(page.locator('[data-testid="progress-percentage"]')).toHaveText('0%')
    await expect(page.locator('[data-testid="task-progress"]')).toHaveText('0 of 1 tasks')
  })

  test('displays correct progress with all tasks completed', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'test-sprint-complete'

    const sprint = {
      id: sprintId,
      teamId: 'team-1',
      name: 'Sprint Gamma',
      goal: 'Complete sprint',
      status: 'active' as const,
      capacityPoints: 40,
      committedPoints: 30,
      completedPoints: 30,
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-01-14').toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    }

    const stories = [
      {
        id: 'story-1',
        projectId,
        title: 'Story 1',
        description: 'Test story',
        status: 'taskscomplete' as const,
        priority: 'high' as const,
        storyPoints: 5,
        labels: [],
        sprintId,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        tasks: [
          {
            id: 'task-1',
            storyId: 'story-1',
            title: 'Task 1',
            description: 'Test task',
            acceptanceCriteriaRefs: ['AC1'],
            status: 'completed' as const,
            ownerUserId: 'user-1',
            estimatedHours: 4,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-03').toISOString(),
            ownedAt: new Date('2024-01-02').toISOString(),
            completedAt: new Date('2024-01-03').toISOString(),
          },
          {
            id: 'task-2',
            storyId: 'story-1',
            title: 'Task 2',
            description: 'Test task 2',
            acceptanceCriteriaRefs: ['AC2'],
            status: 'completed' as const,
            ownerUserId: 'user-2',
            estimatedHours: 3,
            createdAt: new Date('2024-01-01').toISOString(),
            updatedAt: new Date('2024-01-04').toISOString(),
            ownedAt: new Date('2024-01-02').toISOString(),
            completedAt: new Date('2024-01-04').toISOString(),
          },
        ],
      },
    ]

    await page.route(`**/api/v1/projects/${projectId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: projectId, name: 'Test Project', teamId: 'team-1' }),
      })
    })

    await page.route(`**/api/v1/teams/team-1/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sprint),
      })
    })

    await page.route(`**/api/v1/projects/${projectId}/backlog/stories?sprintId=${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stories),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show 100% progress
    await expect(page.locator('[data-testid="progress-percentage"]')).toHaveText('100%')
    await expect(page.locator('[data-testid="task-progress"]')).toHaveText('2 of 2 tasks')
  })

  test('handles sprint with no stories', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'test-sprint-empty'

    const sprint = {
      id: sprintId,
      teamId: 'team-1',
      name: 'Empty Sprint',
      goal: 'Test empty sprint',
      status: 'active' as const,
      capacityPoints: 40,
      committedPoints: 0,
      completedPoints: 0,
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-01-14').toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    }

    await page.route(`**/api/v1/projects/${projectId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: projectId, name: 'Test Project', teamId: 'team-1' }),
      })
    })

    await page.route(`**/api/v1/teams/team-1/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sprint),
      })
    })

    await page.route(`**/api/v1/projects/${projectId}/backlog/stories?sprintId=${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show 0 stories
    await expect(page.locator('[data-testid="story-count"]')).toHaveText('0 stories')

    // Should show 0 progress
    await expect(page.locator('[data-testid="progress-percentage"]')).toHaveText('0%')
    await expect(page.locator('[data-testid="task-progress"]')).toHaveText('0 of 0 tasks')
  })

  test('correctly pluralizes story count', async ({ page }) => {
    const projectId = 'test-project-1'
    const sprintId = 'test-sprint-single'

    const sprint = {
      id: sprintId,
      teamId: 'team-1',
      name: 'Single Story Sprint',
      goal: 'Test single story',
      status: 'active' as const,
      capacityPoints: 40,
      committedPoints: 5,
      completedPoints: 0,
      startDate: new Date('2024-01-01').toISOString(),
      endDate: new Date('2024-01-14').toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
    }

    const stories = [
      {
        id: 'story-1',
        projectId,
        title: 'Only Story',
        description: 'Single story',
        status: 'committed' as const,
        priority: 'high' as const,
        storyPoints: 5,
        labels: [],
        sprintId,
        createdAt: new Date('2024-01-01').toISOString(),
        updatedAt: new Date('2024-01-01').toISOString(),
        tasks: [],
      },
    ]

    await page.route(`**/api/v1/projects/${projectId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: projectId, name: 'Test Project', teamId: 'team-1' }),
      })
    })

    await page.route(`**/api/v1/teams/team-1/sprints/${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sprint),
      })
    })

    await page.route(`**/api/v1/projects/${projectId}/backlog/stories?sprintId=${sprintId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stories),
      })
    })

    await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)

    // Should show singular "story" not "stories"
    await expect(page.locator('[data-testid="story-count"]')).toHaveText('1 story')
  })
})
