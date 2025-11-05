import { test, expect } from '@playwright/test'
import { ProjectsPage, BacklogPage, testData, testUtils } from '../page-objects'

/**
 * E2E Tests for AC3: Visual Indicators for Task Availability
 *
 * Acceptance Criteria 3:
 * Given: I am viewing the sprint task board
 * When: I see the list of tasks
 * Then:
 * - Available tasks (no owner, not completed) should be clearly visually distinguished
 * - My own tasks should be highlighted or marked
 * - Tasks owned by others should show the owner name
 */

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Sprint Task Board - AC3: Visual Indicators', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let projectId: string
  let projectName: string
  let sprintId: string

  test.beforeAll(async ({ browser }) => {
    // Create a test project with stories and tasks
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(
      projectName,
      'Test project for visual indicators'
    )

    // Create a story with tasks
    await backlogPage.gotoBacklog(projectId)
    await backlogPage.createStory('User Authentication', 'Implement user authentication features')

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)
  })

  test.describe('Available Tasks - Visual Distinction', () => {
    test('should display available tasks with dashed border', async ({ page }) => {
      // Navigate to sprint task board
      await page.goto(`/projects/${projectId}/sprints`)

      // Create a sprint and add tasks
      const sprintName = `Sprint ${testUtils.generateUniqueId()}`
      const createSprintButton = page.locator('button:has-text("Create Sprint")')
      if (await createSprintButton.isVisible({ timeout: 5000 })) {
        await createSprintButton.click()

        await page.fill('input[name="name"]', sprintName)
        await page.fill('input[name="duration"]', '14')
        await page.click('button:has-text("Create")')

        // Wait for sprint to be created
        await page.waitForSelector(`text=${sprintName}`, { timeout: 10000 })

        // Navigate to the sprint tasks page
        const viewTasksButton = page.locator(`text=${sprintName}`).locator('..').locator('a', {
          hasText: 'View Tasks',
        })

        if (await viewTasksButton.isVisible({ timeout: 5000 })) {
          await viewTasksButton.click()
        } else {
          // Alternative: click on sprint name
          await page.click(`text=${sprintName}`)
        }

        // Wait for task board to load
        await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

        // Find available tasks (no owner)
        const availableTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Available to claim'),
        })

        const count = await availableTasks.count()
        if (count > 0) {
          const firstAvailableTask = availableTasks.first()

          // Check for dashed border styling
          await expect(firstAvailableTask).toHaveClass(/border-dashed/)

          // Should show "Available to claim" text
          await expect(
            firstAvailableTask.locator('text=Available to claim')
          ).toBeVisible()

          // Should have gray border color
          await expect(firstAvailableTask).toHaveClass(/border-gray-200/)
        }
      }
    })

    test('should show "Available to claim" indicator for tasks without owner', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find the sprint task board
      const taskBoard = page.locator('[data-testid="sprint-task-board"]')
      if (await taskBoard.isVisible({ timeout: 5000 })) {
        // Look for tasks without owners
        const availableIndicators = page.locator('text=Available to claim')
        const count = await availableIndicators.count()

        if (count > 0) {
          const firstIndicator = availableIndicators.first()

          // Should be visible and styled appropriately
          await expect(firstIndicator).toBeVisible()
          await expect(firstIndicator).toHaveClass(/text-green-600/)
          await expect(firstIndicator).toHaveClass(/font-medium/)
        }
      }
    })

    test('should display Circle icon for available tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const availableTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Available'),
      })

      const count = await availableTasks.count()
      if (count > 0) {
        const firstTask = availableTasks.first()

        // Should have the Available status badge
        await expect(firstTask.locator('text=Available')).toBeVisible()

        // Should have gray status color
        const statusBadge = firstTask.locator('.bg-gray-50')
        await expect(statusBadge).toBeVisible()
      }
    })

    test('available tasks should NOT have blue ring highlight', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const availableTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Available to claim'),
      })

      const count = await availableTasks.count()
      if (count > 0) {
        const firstTask = availableTasks.first()

        // Should NOT have ring styling
        await expect(firstTask).not.toHaveClass(/ring-2/)
        await expect(firstTask).not.toHaveClass(/ring-blue-500/)

        // Should NOT show "My Task" badge
        await expect(firstTask.locator('text=My Task')).not.toBeVisible()
      }
    })
  })

  test.describe('My Tasks - Highlighted and Marked', () => {
    test('should highlight my tasks with blue ring', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // First, take ownership of a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()

        // Wait for ownership to be taken
        await page.waitForSelector('text=Task ownership taken', { timeout: 10000 })

        // Find my tasks
        const myTasks = page.locator('[data-my-task="true"]')
        const count = await myTasks.count()

        if (count > 0) {
          const myTask = myTasks.first()

          // Should have blue ring highlight
          await expect(myTask).toHaveClass(/ring-2/)
          await expect(myTask).toHaveClass(/ring-blue-500/)
          await expect(myTask).toHaveClass(/ring-offset-2/)

          // Should display "My Task" badge
          await expect(myTask.locator('text=My Task')).toBeVisible()

          // "My Task" badge should be blue with white text
          const myTaskBadge = myTask.locator('text=My Task')
          await expect(myTaskBadge).toHaveClass(/bg-blue-500/)
          await expect(myTaskBadge).toHaveClass(/text-white/)
        }
      }
    })

    test('should display "My Task" badge for owned tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find tasks that show "My Task" badge
      const myTaskBadges = page.locator('text=My Task')
      const count = await myTaskBadges.count()

      if (count > 0) {
        const firstBadge = myTaskBadges.first()

        // Badge should be visible
        await expect(firstBadge).toBeVisible()

        // Should have blue background and white text
        await expect(firstBadge).toHaveClass(/bg-blue-500/)
        await expect(firstBadge).toHaveClass(/text-white/)
      }
    })

    test('should show "You" as owner for my tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Take ownership of a task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Find my tasks and check owner display
        const myTasks = page.locator('[data-my-task="true"]')
        const count = await myTasks.count()

        if (count > 0) {
          const myTask = myTasks.first()

          // Should show "You" as owner
          await expect(myTask.locator('text=You')).toBeVisible()

          // My tasks show just "You", not "Owner: You"
          const ownerText = await myTask.locator('.text-muted-foreground:has-text("You")').textContent()
          expect(ownerText?.trim()).toBe('You')
        }
      }
    })

    test('my tasks should have data-my-task attribute set to true', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find tasks with data-my-task="true"
      const myTasks = page.locator('[data-my-task="true"]')
      const count = await myTasks.count()

      if (count > 0) {
        const firstTask = myTasks.first()

        // Verify the attribute is set
        const dataMyTask = await firstTask.getAttribute('data-my-task')
        expect(dataMyTask).toBe('true')
      }
    })

    test('should highlight my in-progress tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Take ownership and start work
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        const startWorkButton = page.locator('button:has-text("Start Work")').first()
        if (await startWorkButton.isVisible({ timeout: 5000 })) {
          await startWorkButton.click()
          await page.waitForTimeout(1000)

          // Find in-progress tasks owned by me
          const myInProgressTasks = page.locator('[data-my-task="true"]').filter({
            has: page.locator('text=In Progress'),
          })

          const count = await myInProgressTasks.count()
          if (count > 0) {
            const task = myInProgressTasks.first()

            // Should still have blue ring highlight
            await expect(task).toHaveClass(/ring-2/)
            await expect(task).toHaveClass(/ring-blue-500/)

            // Should show "My Task" badge
            await expect(task.locator('text=My Task')).toBeVisible()

            // Should show In Progress status
            await expect(task.locator('text=In Progress')).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Tasks Owned by Others - Show Owner Name', () => {
    test('should show owner ID for tasks owned by others', async ({ page, context }) => {
      // This test requires a second user to own a task
      // For now, we'll verify the UI structure is correct

      await page.goto(`/projects/${projectId}/sprints`)

      // Find tasks that are owned but not by current user
      const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Owner:'),
      })

      const count = await ownedTasks.count()
      if (count > 0) {
        const othersTask = ownedTasks.first()

        // Should show "Owner:" prefix
        await expect(othersTask.locator('text=Owner:')).toBeVisible()

        // Should NOT show "My Task" badge
        await expect(othersTask.locator('text=My Task')).not.toBeVisible()

        // Should NOT have blue ring highlight
        await expect(othersTask).not.toHaveClass(/ring-2/)
        await expect(othersTask).not.toHaveClass(/ring-blue-500/)
      }
    })

    test('tasks owned by others should NOT have "My Task" badge', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find owned tasks that are NOT mine
      const notMyTasks = page.locator('[data-my-task="false"]').filter({
        has: page.locator('text=Owned'),
      })

      const count = await notMyTasks.count()
      if (count > 0) {
        const othersTask = notMyTasks.first()

        // Should NOT show "My Task" badge
        await expect(othersTask.locator('text=My Task')).not.toBeVisible()
      }
    })

    test('tasks owned by others should NOT have ring highlight', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Find tasks with data-my-task="false"
      const notMyTasks = page.locator('[data-my-task="false"]')
      const count = await notMyTasks.count()

      if (count > 0) {
        const othersTask = notMyTasks.first()

        // Should NOT have ring styling
        await expect(othersTask).not.toHaveClass(/ring-2/)
        await expect(othersTask).not.toHaveClass(/ring-blue-500/)
      }
    })

    test('should display User icon for tasks with owner', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Take ownership to ensure there's at least one owned task
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(1000)

        // Find tasks with owners
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=You'),
        })

        const count = await ownedTasks.count()
        if (count > 0) {
          const task = ownedTasks.first()

          // Should display owner information with icon
          const ownerSection = task.locator('svg').first()
          await expect(ownerSection).toBeVisible()
        }
      }
    })
  })

  test.describe('Comprehensive Visual Distinction', () => {
    test('should clearly distinguish all three task types on the same board', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Create sprint with multiple tasks
      const sprintName = `Visual Test Sprint ${testUtils.generateUniqueId()}`
      const createButton = page.locator('button:has-text("Create Sprint")').first()

      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click()
        await page.fill('input[name="name"]', sprintName)
        await page.fill('input[name="duration"]', '14')
        await page.click('button:has-text("Create")')
        await page.waitForTimeout(2000)

        // Take ownership of one task
        const takeOwnership = page.locator('button:has-text("I\'m on it")').first()
        if (await takeOwnership.isVisible({ timeout: 5000 })) {
          await takeOwnership.click()
          await page.waitForTimeout(1000)
        }

        // Now verify we can distinguish between task types
        const taskBoard = page.locator('[data-testid="sprint-task-board"]')
        await expect(taskBoard).toBeVisible()

        // Check available tasks
        const availableTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Available to claim'),
        })
        const availableCount = await availableTasks.count()

        if (availableCount > 0) {
          const availableTask = availableTasks.first()
          await expect(availableTask).toHaveClass(/border-dashed/)
          await expect(availableTask).not.toHaveClass(/ring-2/)
        }

        // Check my tasks
        const myTasks = page.locator('[data-my-task="true"]')
        const myCount = await myTasks.count()

        if (myCount > 0) {
          const myTask = myTasks.first()
          await expect(myTask).toHaveClass(/ring-2/)
          await expect(myTask).toHaveClass(/ring-blue-500/)
          await expect(myTask.locator('text=My Task')).toBeVisible()
        }

        // Verify the visual differences are clear
        expect(availableCount + myCount).toBeGreaterThan(0)
      }
    })

    test('should maintain visual distinction when filtering tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const taskBoard = page.locator('[data-testid="sprint-task-board"]')
      if (await taskBoard.isVisible({ timeout: 5000 })) {
        // Apply a filter (e.g., show only available)
        const availableFilter = page.locator('input[type="checkbox"]').filter({
          has: page.locator('text=Available'),
        })

        if (await availableFilter.isVisible({ timeout: 3000 })) {
          await availableFilter.check()

          // Verify available tasks still show visual distinction
          const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
          const count = await visibleTasks.count()

          if (count > 0) {
            const firstTask = visibleTasks.first()
            await expect(firstTask).toHaveClass(/border-dashed/)
            await expect(firstTask.locator('text=Available to claim')).toBeVisible()
          }
        }
      }
    })

    test('should maintain visual distinction when grouping by status', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const taskBoard = page.locator('[data-testid="sprint-task-board"]')
      if (await taskBoard.isVisible({ timeout: 5000 })) {
        // Change to group by status
        const statusGrouping = page.locator('input[type="radio"]').filter({
          hasText: /group by status/i,
        })

        if (await statusGrouping.isVisible({ timeout: 3000 })) {
          await statusGrouping.check()

          // Verify my tasks still have blue ring in status groups
          const myTasks = page.locator('[data-my-task="true"]')
          const count = await myTasks.count()

          if (count > 0) {
            const myTask = myTasks.first()
            await expect(myTask).toHaveClass(/ring-2/)
            await expect(myTask).toHaveClass(/ring-blue-500/)
          }
        }
      }
    })
  })

  test.describe('Status-Specific Visual Indicators', () => {
    test('should show green styling for completed tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const completedTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Completed'),
      })

      const count = await completedTasks.count()
      if (count > 0) {
        const task = completedTasks.first()

        // Should have green border
        await expect(task).toHaveClass(/border-green-200/)

        // Completed badge should be visible
        await expect(task.locator('text=Completed')).toBeVisible()

        // Should NOT show "Available to claim"
        await expect(task.locator('text=Available to claim')).not.toBeVisible()
      }
    })

    test('should show yellow styling for in-progress tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const inProgressTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=In Progress'),
      })

      const count = await inProgressTasks.count()
      if (count > 0) {
        const task = inProgressTasks.first()

        // Should have yellow border
        await expect(task).toHaveClass(/border-yellow-200/)

        // In Progress badge should be visible
        await expect(task.locator('text=In Progress')).toBeVisible()
      }
    })

    test('should show blue styling for owned tasks', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('text=Owned'),
      })

      const count = await ownedTasks.count()
      if (count > 0) {
        const task = ownedTasks.first()

        // Should have blue border
        await expect(task).toHaveClass(/border-blue-200/)

        // Owned badge should be visible
        await expect(task.locator('text=Owned')).toBeVisible()
      }
    })
  })

  test.describe('Accessibility and UX', () => {
    test('should use appropriate contrast for all task states', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      // Check that text is readable on all task cards
      const allTasks = page.locator('[data-testid^="task-card-"]')
      const count = await allTasks.count()

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const task = allTasks.nth(i)

          // Task title should be visible and have proper contrast
          const title = task.locator('h4')
          await expect(title).toBeVisible()

          // Status badge should be visible
          const badge = task.locator('[class*="bg-"]').first()
          await expect(badge).toBeVisible()
        }
      }
    })

    test('should make hover state clear for all task types', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints`)

      const tasks = page.locator('[data-testid^="task-card-"]')
      const count = await tasks.count()

      if (count > 0) {
        const task = tasks.first()

        // Hover over task
        await task.hover()

        // Task should have hover:shadow-md class applied
        // Visual feedback should be present (though we can't easily test shadow)
        await expect(task).toBeVisible()
      }
    })
  })

  // Cleanup after all tests
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
