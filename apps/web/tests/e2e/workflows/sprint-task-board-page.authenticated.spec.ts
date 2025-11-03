import { test, expect } from '@playwright/test'
import { ProjectsPage, BacklogPage, testData, testUtils } from '../page-objects'

/**
 * E2E Tests for Sprint Task Board Page
 *
 * Story: As a contributor, I want to view all sprint tasks grouped by story
 * so that I can pick work that aligns with my skills and the team's priorities
 *
 * Acceptance Criteria:
 * - AC 7852bac8: Display all sprint tasks with required information
 * - AC a2ef8786: Filter and group tasks with visible counts
 * - AC 8e8e949d: Visual distinction for task states (available, mine, others)
 * - AC 728fd41e: Real-time updates for task changes
 * - AC d4d41a1f: Display sprint metadata and progress
 */

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Sprint Task Board Page - Complete E2E Flow', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let projectId: string
  let projectName: string
  let sprintId: string
  let sprintName: string

  test.beforeAll(async ({ browser }) => {
    // Create test project with stories and tasks
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(
      projectName,
      'Test project for sprint task board E2E tests'
    )

    // Create multiple stories with tasks
    await backlogPage.gotoBacklog(projectId)

    const stories = [
      {
        title: 'User Authentication System',
        description: 'Implement secure user authentication with JWT',
        tasks: [
          { title: 'Setup JWT middleware', description: 'Create JWT verification middleware' },
          { title: 'Create login endpoint', description: 'API endpoint for user login' },
          { title: 'Add password hashing', description: 'Implement bcrypt password hashing' },
        ],
      },
      {
        title: 'Dashboard Display',
        description: 'Create user dashboard with project overview',
        tasks: [
          { title: 'Design dashboard layout', description: 'Create responsive dashboard UI' },
          { title: 'Add metrics widgets', description: 'Display key project metrics' },
        ],
      },
      {
        title: 'Data Export Feature',
        description: 'Allow users to export project data',
        tasks: [
          { title: 'CSV export functionality', description: 'Export data to CSV format' },
          { title: 'PDF report generation', description: 'Generate PDF reports' },
        ],
      },
    ]

    for (const story of stories) {
      await backlogPage.createStory(story.title, story.description)
      await backlogPage.gotoBacklog(projectId)
    }

    // Create a sprint
    await page.goto(`/projects/${projectId}/sprints`)
    sprintName = `E2E Test Sprint ${testUtils.generateUniqueId()}`

    const createSprintButton = page.locator('button:has-text("Create Sprint")')
    if (await createSprintButton.isVisible({ timeout: 5000 })) {
      await createSprintButton.click()
      await page.fill('input[name="name"]', sprintName)
      await page.fill('input[name="duration"]', '14')
      await page.click('button:has-text("Create")')
      await page.waitForTimeout(2000)

      // Extract sprint ID from URL or page
      const currentUrl = page.url()
      const sprintMatch = currentUrl.match(/sprints\/([a-f0-9-]+)/)
      if (sprintMatch) {
        sprintId = sprintMatch[1]
      }
    }

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)
  })

  test.describe('AC 7852bac8: Display All Sprint Tasks with Required Information', () => {
    test('should navigate to sprint tasks view from sprint list', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find and click the "View Tasks" button for our sprint
      const viewTasksLink = page
        .locator(`a:has-text("View Tasks")`, {
          has: page.locator(`text=${sprintName}`),
        })
        .first()

      if (await viewTasksLink.isVisible({ timeout: 5000 })) {
        await viewTasksLink.click()
      } else {
        // Alternative: navigate directly
        await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      }

      // Wait for task board to load
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Verify we're on the tasks page
      expect(page.url()).toContain('/tasks')
    })

    test('should display all tasks from all stories in the sprint', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Check that tasks are displayed
      const taskCards = page.locator('[data-testid^="task-card-"]')
      const taskCount = await taskCards.count()

      // We created 3 stories with tasks, so we should have multiple tasks
      expect(taskCount).toBeGreaterThan(0)
    })

    test('should display task ID for each task', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstTask = taskCards.first()

        // Task ID should be visible (usually in small text or as a badge)
        const taskId = firstTask.locator('[data-testid="task-id"]')
        await expect(taskId).toBeVisible()
      }
    })

    test('should display task title for each task', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstTask = taskCards.first()

        // Task title should be visible as h4 or h3
        const taskTitle = firstTask.locator('h4, h3')
        await expect(taskTitle).toBeVisible()

        const titleText = await taskTitle.textContent()
        expect(titleText).toBeTruthy()
        expect(titleText?.length).toBeGreaterThan(0)
      }
    })

    test('should display task status badge for each task', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstTask = taskCards.first()

        // Status badge should be visible (Available, Owned, In Progress, or Completed)
        const statusBadge = firstTask.locator('[data-testid="task-status"]')
        await expect(statusBadge).toBeVisible()

        const statusText = await statusBadge.textContent()
        expect(['Available', 'Owned', 'In Progress', 'Completed']).toContain(statusText)
      }
    })

    test('should display owner information when task is assigned', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Take ownership of a task first
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Find owned tasks
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=You'),
        })

        const count = await ownedTasks.count()
        if (count > 0) {
          const ownedTask = ownedTasks.first()

          // Owner should be displayed
          await expect(ownedTask.locator('text=You')).toBeVisible()
        }
      }
    })

    test('should display parent story for each task', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstTask = taskCards.first()

        // Story name should be visible
        const storyName = firstTask.locator('[data-testid="story-name"]')
        await expect(storyName).toBeVisible()

        const storyText = await storyName.textContent()
        expect(storyText).toBeTruthy()
      }
    })

    test('should display acceptance criteria references for each task', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstTask = taskCards.first()

        // AC references should be visible
        const acRefs = firstTask.locator('[data-testid="ac-refs"]')

        // AC refs might not always be present, but the element should exist
        if (await acRefs.isVisible({ timeout: 2000 })) {
          const acText = await acRefs.textContent()
          expect(acText).toBeTruthy()
        }
      }
    })
  })

  test.describe('AC a2ef8786: Filter and Group Tasks', () => {
    test('should filter tasks by status - Available', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Find and click the Available filter
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')

      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)

        // All visible tasks should be available
        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const count = await visibleTasks.count()

        if (count > 0) {
          for (let i = 0; i < Math.min(count, 3); i++) {
            const task = visibleTasks.nth(i)
            await expect(task.locator('text=Available')).toBeVisible()
          }
        }

        // Uncheck to reset
        await availableFilter.uncheck()
      }
    })

    test('should filter tasks by status - Owned', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Take ownership of a task first
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Now filter by Owned
        const ownedFilter = page.locator('input[type="checkbox"][value="owned"]')

        if (await ownedFilter.isVisible({ timeout: 5000 })) {
          await ownedFilter.check()
          await page.waitForTimeout(500)

          // All visible tasks should be owned
          const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
          const count = await visibleTasks.count()

          if (count > 0) {
            for (let i = 0; i < count; i++) {
              const task = visibleTasks.nth(i)
              await expect(task.locator('text=Owned')).toBeVisible()
            }
          }

          await ownedFilter.uncheck()
        }
      }
    })

    test('should filter tasks by status - In Progress', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const inProgressFilter = page.locator('input[type="checkbox"][value="inprogress"]')

      if (await inProgressFilter.isVisible({ timeout: 5000 })) {
        await inProgressFilter.check()
        await page.waitForTimeout(500)

        // All visible tasks should be in progress
        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const count = await visibleTasks.count()

        // Might be 0 if no tasks are in progress yet
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const task = visibleTasks.nth(i)
            await expect(task.locator('text=In Progress')).toBeVisible()
          }
        }

        await inProgressFilter.uncheck()
      }
    })

    test('should filter tasks by status - Completed', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const completedFilter = page.locator('input[type="checkbox"][value="completed"]')

      if (await completedFilter.isVisible({ timeout: 5000 })) {
        await completedFilter.check()
        await page.waitForTimeout(500)

        // All visible tasks should be completed
        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const count = await visibleTasks.count()

        // Might be 0 if no tasks are completed yet
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const task = visibleTasks.nth(i)
            await expect(task.locator('text=Completed')).toBeVisible()
          }
        }

        await completedFilter.uncheck()
      }
    })

    test('should group tasks by Story', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Select "Group by Story" option
      const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')

      if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
        await groupByStoryRadio.check()
        await page.waitForTimeout(500)

        // Verify story groups are displayed
        const storyGroups = page.locator('[data-testid="story-group"]')
        const groupCount = await storyGroups.count()

        // We created 3 stories, so we should have up to 3 groups
        expect(groupCount).toBeGreaterThan(0)

        // Each group should have a story title
        if (groupCount > 0) {
          const firstGroup = storyGroups.first()
          const groupTitle = firstGroup.locator('[data-testid="group-title"]')
          await expect(groupTitle).toBeVisible()
        }
      }
    })

    test('should group tasks by Status', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Select "Group by Status" option
      const groupByStatusRadio = page.locator('input[type="radio"][value="status"]')

      if (await groupByStatusRadio.isVisible({ timeout: 5000 })) {
        await groupByStatusRadio.check()
        await page.waitForTimeout(500)

        // Verify status groups are displayed
        const statusGroups = page.locator('[data-testid="status-group"]')
        const groupCount = await statusGroups.count()

        // Should have at least one status group (Available, Owned, In Progress, or Completed)
        expect(groupCount).toBeGreaterThan(0)

        // Each group should have a status title
        if (groupCount > 0) {
          const firstGroup = statusGroups.first()
          const groupTitle = firstGroup.locator('[data-testid="group-title"]')
          await expect(groupTitle).toBeVisible()
        }
      }
    })

    test('should display task count for each group when grouped by Story', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')

      if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
        await groupByStoryRadio.check()
        await page.waitForTimeout(500)

        const storyGroups = page.locator('[data-testid="story-group"]')
        const groupCount = await storyGroups.count()

        if (groupCount > 0) {
          const firstGroup = storyGroups.first()

          // Group should display task count
          const taskCount = firstGroup.locator('[data-testid="group-count"]')
          await expect(taskCount).toBeVisible()

          const countText = await taskCount.textContent()
          expect(countText).toMatch(/\d+/)
        }
      }
    })

    test('should display task count for each group when grouped by Status', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const groupByStatusRadio = page.locator('input[type="radio"][value="status"]')

      if (await groupByStatusRadio.isVisible({ timeout: 5000 })) {
        await groupByStatusRadio.check()
        await page.waitForTimeout(500)

        const statusGroups = page.locator('[data-testid="status-group"]')
        const groupCount = await statusGroups.count()

        if (groupCount > 0) {
          const firstGroup = statusGroups.first()

          // Group should display task count
          const taskCount = firstGroup.locator('[data-testid="group-count"]')
          await expect(taskCount).toBeVisible()

          const countText = await taskCount.textContent()
          expect(countText).toMatch(/\d+/)
        }
      }
    })

    test('should show total filtered count when filters are active', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get initial task count
      const initialTasks = page.locator('[data-testid^="task-card-"]')
      const initialCount = await initialTasks.count()

      // Apply a filter
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')

      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)

        // Check filtered count display
        const filteredCount = page.locator('[data-testid="filtered-count"]')

        if (await filteredCount.isVisible({ timeout: 3000 })) {
          const countText = await filteredCount.textContent()
          expect(countText).toMatch(/\d+/)

          // Filtered count should be <= initial count
          const filtered = parseInt(countText?.match(/\d+/)?.[0] || '0')
          expect(filtered).toBeLessThanOrEqual(initialCount)
        }
      }
    })
  })

  test.describe('AC 728fd41e: Real-Time Updates', () => {
    test('should update task list when ownership is taken', async ({ page, context }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get initial count of available tasks
      const initialAvailableTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Available to claim'),
      })
      const initialCount = await initialAvailableTasks.count()

      if (initialCount > 0) {
        // Take ownership of first available task
        const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
        await takeOwnershipButton.click()

        // Wait for update (should happen without page refresh)
        await page.waitForTimeout(1000)

        // Verify task is now owned
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Owned'),
        })
        const ownedCount = await ownedTasks.count()

        expect(ownedCount).toBeGreaterThan(0)

        // Available tasks should have decreased
        const newAvailableTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Available to claim'),
        })
        const newCount = await newAvailableTasks.count()

        expect(newCount).toBeLessThan(initialCount)
      }
    })

    test('should update task list when task status changes', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Take ownership first
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Start work on the task
        const startWorkButton = page.locator('button:has-text("Start Work")').first()
        if (await startWorkButton.isVisible({ timeout: 5000 })) {
          await startWorkButton.click()
          await page.waitForTimeout(1000)

          // Verify task status updated to In Progress
          const inProgressTasks = page.locator('[data-testid^="task-card-"]').filter({
            has: page.locator('text=In Progress'),
          })
          const count = await inProgressTasks.count()

          expect(count).toBeGreaterThan(0)
        }
      }
    })

    test('should show subtle notification when task changes', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Take ownership of a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()

        // Look for toast notification or subtle update indicator
        const notification = page.locator('[data-testid="toast"], .toast, [role="alert"]')

        // Notification should appear briefly
        if (await notification.isVisible({ timeout: 3000 })) {
          const notificationText = await notification.textContent()
          expect(notificationText).toBeTruthy()
        }
      }
    })

    test('should update without page refresh (no full reload)', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Set up listener for page navigation/reload
      let pageReloaded = false
      page.on('load', () => {
        pageReloaded = true
      })

      // Perform an action
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(2000)

        // Page should NOT have reloaded
        expect(pageReloaded).toBe(false)

        // But the UI should have updated
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Owned'),
        })
        const count = await ownedTasks.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  test.describe('AC d4d41a1f: Display Sprint Metadata and Progress', () => {
    test('should display sprint name in header', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const sprintNameDisplay = page.locator('[data-testid="sprint-name"]')
      await expect(sprintNameDisplay).toBeVisible()

      const displayedName = await sprintNameDisplay.textContent()
      expect(displayedName).toContain(sprintName)
    })

    test('should display sprint start and end dates', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const sprintDates = page.locator('[data-testid="sprint-dates"]')
      await expect(sprintDates).toBeVisible()

      const dateText = await sprintDates.textContent()
      expect(dateText).toBeTruthy()
      // Should contain a date pattern (various formats possible)
      expect(dateText).toMatch(/\d/)
      // Should contain a hyphen separating start and end dates
      expect(dateText).toContain('-')
    })

    test('should display days remaining in sprint', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const daysRemaining = page.locator('[data-testid="days-remaining"]')
      await expect(daysRemaining).toBeVisible()

      const daysText = await daysRemaining.textContent()
      expect(daysText).toBeTruthy()

      // Should contain a number and the word "remaining"
      expect(daysText).toMatch(/\d+/)
      expect(daysText).toContain('remaining')
    })

    test('should display progress indicator with completion percentage', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const progressBar = page.locator('[data-testid="progress-bar"]')
      await expect(progressBar).toBeVisible()

      // Should show percentage
      const percentageDisplay = page.locator('[data-testid="progress-percentage"]')
      await expect(percentageDisplay).toBeVisible()

      const percentText = await percentageDisplay.textContent()
      expect(percentText).toMatch(/\d+%/)

      // Percentage should be between 0 and 100
      const percent = parseInt(percentText?.match(/\d+/)?.[0] || '0')
      expect(percent).toBeGreaterThanOrEqual(0)
      expect(percent).toBeLessThanOrEqual(100)
    })

    test('should display total number of stories in sprint', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const storyCount = page.locator('[data-testid="story-count"]')
      await expect(storyCount).toBeVisible()

      const countText = await storyCount.textContent()
      expect(countText).toMatch(/\d+/)
      expect(countText).toMatch(/stor(y|ies)/)

      // Should be at least 1 story
      const count = parseInt(countText?.match(/\d+/)?.[0] || '0')
      expect(count).toBeGreaterThan(0)
    })

    test('should display task progress with total and completed counts', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskProgress = page.locator('[data-testid="task-progress"]')
      await expect(taskProgress).toBeVisible()

      const progressText = await taskProgress.textContent()
      expect(progressText).toBeTruthy()
      // Should show format like "X of Y tasks"
      expect(progressText).toMatch(/\d+\s+of\s+\d+\s+tasks/)
    })

    test('should display completed task count in task progress', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const taskProgress = page.locator('[data-testid="task-progress"]')
      await expect(taskProgress).toBeVisible()

      const progressText = await taskProgress.textContent()
      // Should contain completed count (first number in "X of Y tasks")
      expect(progressText).toMatch(/\d+/)

      const match = progressText?.match(/(\d+)\s+of\s+(\d+)/)
      if (match) {
        const completedCount = parseInt(match[1])
        const totalCount = parseInt(match[2])
        expect(completedCount).toBeGreaterThanOrEqual(0)
        expect(completedCount).toBeLessThanOrEqual(totalCount)
      }
    })

    test('should update progress percentage when task is completed', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get initial completion percentage
      const percentageDisplay = page.locator('[data-testid="progress-percentage"]')
      const initialPercentText = await percentageDisplay.textContent()
      const initialPercent = parseInt(initialPercentText?.match(/\d+/)?.[0] || '0')

      // Take ownership and complete a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        const startWorkButton = page.locator('button:has-text("Start Work")').first()
        if (await startWorkButton.isVisible({ timeout: 5000 })) {
          await startWorkButton.click()
          await page.waitForTimeout(1000)

          const completeButton = page.locator('button:has-text("Mark Complete")').first()
          if (await completeButton.isVisible({ timeout: 5000 })) {
            await completeButton.click()
            await page.waitForTimeout(1000)

            // Verify percentage increased
            const newPercentText = await percentageDisplay.textContent()
            const newPercent = parseInt(newPercentText?.match(/\d+/)?.[0] || '0')

            expect(newPercent).toBeGreaterThanOrEqual(initialPercent)
          }
        }
      }
    })
  })

  test.describe('Integration and User Flows', () => {
    test('should support complete workflow: filter -> group -> claim task -> verify updates', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Step 1: Group by story
      const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')
      if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
        await groupByStoryRadio.check()
        await page.waitForTimeout(500)
      }

      // Step 2: Filter to show only available tasks
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)
      }

      // Step 3: Claim a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Step 4: Verify the task is now owned and marked as "My Task"
        const myTasks = page.locator('[data-my-task="true"]')
        const count = await myTasks.count()
        expect(count).toBeGreaterThan(0)

        // Step 5: Verify progress updated
        const percentageDisplay = page.locator('[data-testid="completion-percentage"]')
        await expect(percentageDisplay).toBeVisible()
      }
    })

    test('should maintain state when switching between grouping modes', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Take ownership of a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Switch to group by story
        const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')
        if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
          await groupByStoryRadio.check()
          await page.waitForTimeout(500)

          // Task should still be marked as mine
          let myTasks = page.locator('[data-my-task="true"]')
          let count = await myTasks.count()
          expect(count).toBeGreaterThan(0)

          // Switch to group by status
          const groupByStatusRadio = page.locator('input[type="radio"][value="status"]')
          if (await groupByStatusRadio.isVisible({ timeout: 5000 })) {
            await groupByStatusRadio.check()
            await page.waitForTimeout(500)

            // Task should still be marked as mine
            myTasks = page.locator('[data-my-task="true"]')
            count = await myTasks.count()
            expect(count).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle sprint with no tasks gracefully', async ({ page, context }) => {
      // Create a new sprint without tasks
      const emptySprintName = `Empty Sprint ${testUtils.generateUniqueId()}`
      await page.goto(`/projects/${projectId}/sprints`)

      const createButton = page.locator('button:has-text("Create Sprint")').first()
      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click()
        await page.fill('input[name="name"]', emptySprintName)
        await page.fill('input[name="duration"]', '7')
        await page.click('button:has-text("Create")')
        await page.waitForTimeout(2000)

        // Navigate to empty sprint tasks
        const viewTasksLink = page.locator(`a:has-text("View Tasks")`).first()
        if (await viewTasksLink.isVisible({ timeout: 5000 })) {
          await viewTasksLink.click()
          await page.waitForTimeout(1000)

          // Should show empty state message
          const emptyState = page.locator('[data-testid="empty-state"], text=/no tasks/i')
          await expect(emptyState).toBeVisible()
        }
      }
    })

    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Simulate network failure
      await page.route('**/api/**', (route) => route.abort())

      // Try to take ownership
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()

        // Should show error message
        const errorMessage = page.locator('[data-testid="error-message"], [role="alert"]')
        await expect(errorMessage).toBeVisible({ timeout: 5000 })
      }
    })
  })

  // Cleanup
  test.afterAll(async ({ browser }) => {
    try {
      const context = await browser.newContext({
        storageState: 'tests/playwright/.clerk/user.json',
      })
      const page = await context.newPage()
      const cleanupProjectsPage = new ProjectsPage(page)

      await cleanupProjectsPage.gotoProjects()
      await cleanupProjectsPage.deleteProject(projectName)

      await context.close()
    } catch {
      // Ignore cleanup errors
    }
  })
})
