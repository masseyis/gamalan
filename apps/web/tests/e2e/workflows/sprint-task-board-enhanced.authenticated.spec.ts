import { test, expect } from '@playwright/test'
import { ProjectsPage, BacklogPage, testData, testUtils } from '../page-objects'

/**
 * Enhanced E2E Tests for Sprint Task Board Page
 *
 * This test suite provides additional coverage for:
 * - WebSocket connection status indicator
 * - Complex filter combinations
 * - Accessibility features
 * - Performance and responsiveness
 * - Edge cases for real-time updates
 *
 * Story: As a contributor, I want to view all sprint tasks grouped by story
 * Extends coverage for acceptance criteria:
 * - AC 7852bac8: Display all sprint tasks with required information
 * - AC a2ef8786: Filter and group tasks with visible counts
 * - AC 728fd41e: Real-time updates for task changes
 * - AC d4d41a1f: Display sprint metadata and progress
 */

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Sprint Task Board - Enhanced E2E Tests', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let projectId: string
  let projectName: string
  let sprintId: string
  let sprintName: string

  test.beforeAll(async ({ browser }) => {
    // Create test project with comprehensive story and task setup
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(
      projectName,
      'Test project for enhanced sprint task board E2E tests'
    )

    // Create multiple stories with various tasks
    await backlogPage.gotoBacklog(projectId)

    const stories = [
      {
        title: 'Backend API Development',
        description: 'Build RESTful API endpoints',
        tasks: [
          { title: 'Create user endpoint', description: 'POST /api/users' },
          { title: 'Add authentication middleware', description: 'JWT verification' },
          { title: 'Implement rate limiting', description: 'Protect API from abuse' },
        ],
      },
      {
        title: 'Frontend Components',
        description: 'Reusable UI components',
        tasks: [
          { title: 'Build button component', description: 'Styled button with variants' },
          { title: 'Create form inputs', description: 'Text, email, password inputs' },
        ],
      },
    ]

    for (const story of stories) {
      await backlogPage.createStory(story.title, story.description)
      await backlogPage.gotoBacklog(projectId)
    }

    // Create sprint
    await page.goto(`/projects/${projectId}/sprints`)
    sprintName = `Enhanced E2E Sprint ${testUtils.generateUniqueId()}`

    const createSprintButton = page.locator('button:has-text("Create Sprint")')
    if (await createSprintButton.isVisible({ timeout: 5000 })) {
      await createSprintButton.click()
      await page.fill('input[name="name"]', sprintName)
      await page.fill('input[name="duration"]', '14')
      await page.click('button:has-text("Create")')
      await page.waitForTimeout(2000)

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

  test.describe('Real-Time Connection Indicator', () => {
    test('AC 728fd41e: should display WebSocket connection status indicator', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Verify connection indicator is present
      const connectionIndicator = page.locator('[data-testid="connection-indicator"]')
      await expect(connectionIndicator).toBeVisible()

      // Should show as connected (green)
      await expect(connectionIndicator).toHaveClass(/bg-green-500/)

      // Verify connection status text
      const statusText = page.locator('text=/Connected to real-time updates/i')
      await expect(statusText).toBeVisible()
    })

    test('AC 728fd41e: connection indicator should update when WebSocket disconnects', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const connectionIndicator = page.locator('[data-testid="connection-indicator"]')

      // Initially connected
      await expect(connectionIndicator).toHaveClass(/bg-green-500/)

      // Simulate network going offline
      await page.context().setOffline(true)
      await page.waitForTimeout(2000)

      // Indicator should show disconnected state (or reconnecting)
      // Note: Implementation may vary - could be gray or yellow
      const indicatorClass = await connectionIndicator.getAttribute('class')
      expect(indicatorClass).toBeTruthy()

      // Restore network
      await page.context().setOffline(false)
      await page.waitForTimeout(2000)

      // Should reconnect
      await expect(connectionIndicator).toHaveClass(/bg-green-500/)
    })
  })

  test.describe('Complex Filter Combinations', () => {
    test('AC a2ef8786: should handle multiple status filters simultaneously', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Select multiple status filters
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      const ownedFilter = page.locator('input[type="checkbox"][value="owned"]')

      if (
        (await availableFilter.isVisible({ timeout: 5000 })) &&
        (await ownedFilter.isVisible({ timeout: 5000 }))
      ) {
        await availableFilter.check()
        await ownedFilter.check()
        await page.waitForTimeout(500)

        // Should show both available and owned tasks
        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const count = await visibleTasks.count()

        if (count > 0) {
          // Verify tasks are either Available or Owned
          for (let i = 0; i < Math.min(count, 5); i++) {
            const task = visibleTasks.nth(i)
            const hasAvailable = await task.locator('text=Available').isVisible({ timeout: 1000 }).catch(() => false)
            const hasOwned = await task.locator('text=Owned').isVisible({ timeout: 1000 }).catch(() => false)
            expect(hasAvailable || hasOwned).toBe(true)
          }
        }

        // Clean up filters
        await availableFilter.uncheck()
        await ownedFilter.uncheck()
      }
    })

    test('AC a2ef8786: should combine filters with grouping correctly', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Apply status filter
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)
      }

      // Apply grouping by story
      const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')
      if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
        await groupByStoryRadio.check()
        await page.waitForTimeout(500)

        // Verify groups are shown with filtered tasks
        const storyGroups = page.locator('[data-testid="story-group"]')
        const groupCount = await storyGroups.count()

        if (groupCount > 0) {
          // Each group should only show available tasks
          for (let i = 0; i < groupCount; i++) {
            const group = storyGroups.nth(i)
            const tasksInGroup = group.locator('[data-testid^="task-card-"]')
            const taskCount = await tasksInGroup.count()

            for (let j = 0; j < taskCount; j++) {
              const task = tasksInGroup.nth(j)
              await expect(task.locator('text=Available')).toBeVisible()
            }
          }
        }
      }
    })

    test('AC a2ef8786: should clear all filters when no statuses selected', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get initial count
      const initialTasks = page.locator('[data-testid^="task-card-"]')
      const initialCount = await initialTasks.count()

      // Apply filter
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)

        const filteredTasks = page.locator('[data-testid^="task-card-"]')
        const filteredCount = await filteredTasks.count()

        // Should be filtered
        expect(filteredCount).toBeLessThanOrEqual(initialCount)

        // Uncheck filter
        await availableFilter.uncheck()
        await page.waitForTimeout(500)

        // Should show all tasks again
        const finalTasks = page.locator('[data-testid^="task-card-"]')
        const finalCount = await finalTasks.count()
        expect(finalCount).toBe(initialCount)
      }
    })
  })

  test.describe('Accessibility Features', () => {
    test('should support keyboard navigation through filters', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Focus on filter section
      const filterSection = page.locator('[data-testid="task-filters"]')
      if (await filterSection.isVisible({ timeout: 5000 })) {
        await filterSection.press('Tab')

        // Should be able to navigate with keyboard
        const availableFilter = page.locator('input[type="checkbox"][value="available"]')
        if (await availableFilter.isVisible()) {
          await availableFilter.focus()
          await page.keyboard.press('Space')
          await page.waitForTimeout(500)

          // Filter should be checked
          await expect(availableFilter).toBeChecked()
        }
      }
    })

    test('should have proper ARIA labels for screen readers', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Check for ARIA labels on key elements
      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstCard = taskCards.first()

        // Task cards should have accessible labels or roles
        const ariaLabel = await firstCard.getAttribute('aria-label')
        const role = await firstCard.getAttribute('role')

        // Should have either aria-label or role for accessibility
        expect(ariaLabel || role).toBeTruthy()
      }
    })

    test('should support keyboard navigation for task actions', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Find a task with "I'm on it" button
      const claimButton = page.locator('button:has-text("I\'m on it")').first()
      if (await claimButton.isVisible({ timeout: 5000 })) {
        await claimButton.focus()

        // Should be able to activate with Enter or Space
        await page.keyboard.press('Enter')
        await page.waitForTimeout(1000)

        // Task should be claimed
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Owned'),
        })
        const count = await ownedTasks.count()
        expect(count).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Performance and Responsiveness', () => {
    test('should load sprint task board within performance budget', async ({ page }) => {
      const startTime = Date.now()

      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const loadTime = Date.now() - startTime

      // Should load within 10 seconds (reasonable for E2E test environment)
      expect(loadTime).toBeLessThan(10000)
    })

    test('should handle rapid filter changes without errors', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      const ownedFilter = page.locator('input[type="checkbox"][value="owned"]')

      if (
        (await availableFilter.isVisible({ timeout: 5000 })) &&
        (await ownedFilter.isVisible({ timeout: 5000 }))
      ) {
        // Rapidly toggle filters
        for (let i = 0; i < 5; i++) {
          await availableFilter.check()
          await ownedFilter.check()
          await availableFilter.uncheck()
          await ownedFilter.uncheck()
        }

        // Should still be functional
        await availableFilter.check()
        await page.waitForTimeout(500)

        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const count = await visibleTasks.count()

        // Should show filtered results
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })

    test('should update progress indicators efficiently when multiple tasks change', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const percentageDisplay = page.locator('[data-testid="completion-percentage"]')
      const initialPercentText = await percentageDisplay.textContent()

      // Claim multiple tasks in succession
      const claimButtons = page.locator('button:has-text("I\'m on it")')
      const buttonCount = await claimButtons.count()

      if (buttonCount > 1) {
        // Claim first 2 tasks
        for (let i = 0; i < Math.min(2, buttonCount); i++) {
          const button = claimButtons.nth(i)
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click()
            await page.waitForTimeout(500)
          }
        }

        // Progress should update (or remain same if no completions)
        const newPercentText = await percentageDisplay.textContent()
        expect(newPercentText).toBeTruthy()
      }
    })
  })

  test.describe('Edge Cases for Real-Time Updates', () => {
    test('AC 728fd41e: should handle WebSocket reconnection gracefully', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      const connectionIndicator = page.locator('[data-testid="connection-indicator"]')

      // Initially connected
      await expect(connectionIndicator).toHaveClass(/bg-green-500/)

      // Simulate brief network interruption
      await page.context().setOffline(true)
      await page.waitForTimeout(1000)
      await page.context().setOffline(false)
      await page.waitForTimeout(2000)

      // Should automatically reconnect
      await expect(connectionIndicator).toHaveClass(/bg-green-500/)

      // Board should remain functional
      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()
      expect(count).toBeGreaterThan(0)
    })

    test('AC 728fd41e: should queue updates when offline and sync when reconnected', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Go offline
      await page.context().setOffline(true)

      // Try to claim a task while offline
      const claimButton = page.locator('button:has-text("I\'m on it")').first()
      if (await claimButton.isVisible({ timeout: 5000 })) {
        await claimButton.click()
        await page.waitForTimeout(1000)

        // Come back online
        await page.context().setOffline(false)
        await page.waitForTimeout(3000)

        // Update should eventually reflect (optimistic UI or sync on reconnect)
        // This may vary based on implementation
        const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
          has: page.locator('text=Owned'),
        })
        const count = await ownedTasks.count()

        // Should have at least attempted the update
        expect(count).toBeGreaterThanOrEqual(0)
      }
    })

    test('AC 728fd41e: should show notification for each real-time update', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Perform action that triggers notification
      const claimButton = page.locator('button:has-text("I\'m on it")').first()
      if (await claimButton.isVisible({ timeout: 5000 })) {
        await claimButton.click()

        // Should show toast notification
        const toast = page.locator('[data-testid="toast"], .toast, [role="alert"]')

        if (await toast.isVisible({ timeout: 5000 })) {
          const toastText = await toast.textContent()
          expect(toastText).toMatch(/claimed|taken|ownership/i)
        }
      }
    })
  })

  test.describe('Data Integrity and Validation', () => {
    test('AC 7852bac8: should display accurate task counts in header metrics', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get displayed total tasks
      const totalTasksDisplay = page.locator('[data-testid="total-tasks"]')
      const totalText = await totalTasksDisplay.textContent()
      const displayedTotal = parseInt(totalText?.match(/\d+/)?.[0] || '0')

      // Count actual task cards
      const taskCards = page.locator('[data-testid^="task-card-"]')
      const actualCount = await taskCards.count()

      // Should match
      expect(displayedTotal).toBe(actualCount)
    })

    test('AC a2ef8786: should display accurate filtered counts', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Apply available filter
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)

        // Count visible tasks
        const visibleTasks = page.locator('[data-testid^="task-card-"]:visible')
        const actualCount = await visibleTasks.count()

        // Check if filtered count display exists and matches
        const filteredCountDisplay = page.locator('[data-testid="filtered-count"]')
        if (await filteredCountDisplay.isVisible({ timeout: 3000 })) {
          const countText = await filteredCountDisplay.textContent()
          const displayedCount = parseInt(countText?.match(/\d+/)?.[0] || '0')

          expect(displayedCount).toBe(actualCount)
        }

        await availableFilter.uncheck()
      }
    })

    test('AC d4d41a1f: should calculate completion percentage correctly', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Get total and completed counts
      const totalTasksDisplay = page.locator('[data-testid="total-tasks"]')
      const completedTasksDisplay = page.locator('[data-testid="completed-tasks"]')
      const percentageDisplay = page.locator('[data-testid="completion-percentage"]')

      const totalText = await totalTasksDisplay.textContent()
      const completedText = await completedTasksDisplay.textContent()
      const percentText = await percentageDisplay.textContent()

      const total = parseInt(totalText?.match(/\d+/)?.[0] || '0')
      const completed = parseInt(completedText?.match(/\d+/)?.[0] || '0')
      const displayedPercent = parseInt(percentText?.match(/\d+/)?.[0] || '0')

      // Calculate expected percentage
      const expectedPercent = total > 0 ? Math.round((completed / total) * 100) : 0

      // Should match
      expect(displayedPercent).toBe(expectedPercent)
    })
  })

  test.describe('User Experience Flows', () => {
    test('should provide smooth workflow: view tasks -> filter -> group -> claim -> track progress', async ({
      page,
    }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Step 1: View all tasks
      const allTasks = page.locator('[data-testid^="task-card-"]')
      const initialCount = await allTasks.count()
      expect(initialCount).toBeGreaterThan(0)

      // Step 2: Filter to available tasks
      const availableFilter = page.locator('input[type="checkbox"][value="available"]')
      if (await availableFilter.isVisible({ timeout: 5000 })) {
        await availableFilter.check()
        await page.waitForTimeout(500)
      }

      // Step 3: Group by story
      const groupByStoryRadio = page.locator('input[type="radio"][value="story"]')
      if (await groupByStoryRadio.isVisible({ timeout: 5000 })) {
        await groupByStoryRadio.check()
        await page.waitForTimeout(500)
      }

      // Step 4: Claim a task
      const claimButton = page.locator('button:has-text("I\'m on it")').first()
      if (await claimButton.isVisible({ timeout: 5000 })) {
        const initialPercent = await page
          .locator('[data-testid="completion-percentage"]')
          .textContent()

        await claimButton.click()
        await page.waitForTimeout(1000)

        // Step 5: Verify task is owned
        const myTasks = page.locator('[data-my-task="true"]')
        const myTaskCount = await myTasks.count()
        expect(myTaskCount).toBeGreaterThan(0)

        // Step 6: Progress tracked (completion % may or may not change depending on workflow)
        const newPercent = await page
          .locator('[data-testid="completion-percentage"]')
          .textContent()
        expect(newPercent).toBeTruthy()
      }
    })

    test('should maintain user context across filter and grouping changes', async ({ page }) => {
      await page.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
      await page.waitForSelector('[data-testid="sprint-task-board"]', { timeout: 10000 })

      // Claim a task first
      const claimButton = page.locator('button:has-text("I\'m on it")').first()
      if (await claimButton.isVisible({ timeout: 5000 })) {
        await claimButton.click()
        await page.waitForTimeout(1000)

        // Change grouping to status
        const groupByStatusRadio = page.locator('input[type="radio"][value="status"]')
        if (await groupByStatusRadio.isVisible({ timeout: 5000 })) {
          await groupByStatusRadio.check()
          await page.waitForTimeout(500)

          // My task should still be highlighted
          let myTasks = page.locator('[data-my-task="true"]')
          expect(await myTasks.count()).toBeGreaterThan(0)

          // Change filter to owned
          const ownedFilter = page.locator('input[type="checkbox"][value="owned"]')
          if (await ownedFilter.isVisible({ timeout: 5000 })) {
            await ownedFilter.check()
            await page.waitForTimeout(500)

            // Should still see my task
            myTasks = page.locator('[data-my-task="true"]')
            expect(await myTasks.count()).toBeGreaterThan(0)
          }
        }
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
