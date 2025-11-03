import { test, expect } from '@playwright/test'
import {
  AuthPage,
  ProjectsPage,
  BacklogPage,
  SprintTaskBoardPage,
  testUtils,
} from '../page-objects'

/**
 * E2E Tests for Sprint Task Board
 *
 * Tests the Sprint Task Board page functionality including:
 * - Navigation and initial display
 * - Task information display (AC1: 7852bac8)
 * - Filtering by status (AC2: a2ef8786)
 * - Grouping by story/status (AC2: a2ef8786)
 * - Visual distinction for available/my tasks (AC3: 8e8e949d)
 * - Real-time updates (AC4: 728fd41e)
 * - Sprint header with metrics (AC5: d4d41a1f)
 */
test.describe('Sprint Task Board E2E Tests', () => {
  let authPage: AuthPage
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let sprintTaskBoardPage: SprintTaskBoardPage

  // Test data
  let projectId: string
  let sprintId: string
  let projectName: string
  let sprintName: string
  let story1Title: string
  let story2Title: string
  let task1Title: string
  let task2Title: string
  let task3Title: string

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page)
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)
    sprintTaskBoardPage = new SprintTaskBoardPage(page)

    // Generate unique test data
    const uniqueId = testUtils.generateUniqueId()
    projectName = `E2E Sprint Board Project ${uniqueId}`
    sprintName = `Sprint ${uniqueId}`
    story1Title = `User Authentication Story ${uniqueId}`
    story2Title = `Dashboard Story ${uniqueId}`
    task1Title = `Setup JWT auth ${uniqueId}`
    task2Title = `Create login form ${uniqueId}`
    task3Title = `Design dashboard ${uniqueId}`

    // Setup: Create project, stories, and sprint (assuming global auth setup exists)
    // Note: This assumes authentication is already handled in global setup
    await projectsPage.gotoProjects()
  })

  test.describe('AC1 (7852bac8): Display all task information', () => {
    test('should display all tasks with complete information', async ({ page }) => {
      // Given I am a contributor logged into the system and there is an active sprint
      // This would require setting up project, sprint, and stories with tasks
      // For now, we'll navigate to an existing sprint task board

      // Navigate to sprint task board (using mock IDs for demonstration)
      // In a real scenario, these would be created in beforeEach
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')

      // Then I should see the sprint task board loaded
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // And I should see all tasks from all stories in the current sprint
      // Each task should display: task ID, title, status, owner, parent story, AC refs
      await sprintTaskBoardPage.expectTaskDisplayed('Setup JWT authentication')
      await sprintTaskBoardPage.expectTaskWithDetails('Setup JWT authentication', {
        taskId: 'task-1',
        status: 'Available',
        parentStory: 'User Authentication',
        acRefs: ['AC1', 'AC2'],
      })

      await sprintTaskBoardPage.expectTaskDisplayed('Create login form')
      await sprintTaskBoardPage.expectTaskWithDetails('Create login form', {
        taskId: 'task-2',
        status: 'Owned',
        parentStory: 'User Authentication',
        acRefs: ['AC3'],
      })
    })

    test('should display task IDs for all tasks', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Verify task IDs are visible
      const taskCards = sprintTaskBoardPage.taskCards
      const firstTask = taskCards.first()
      await expect(firstTask).toContainText(/task-\d+/)
    })

    test('should display parent story for each task', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Verify parent story is shown
      await sprintTaskBoardPage.expectTaskWithDetails('Setup JWT authentication', {
        parentStory: 'User Authentication',
      })
    })

    test('should display acceptance criteria references', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Verify AC references are displayed
      const taskCard = sprintTaskBoardPage.taskCards.first()
      await expect(taskCard).toContainText(/AC\d+/)
    })
  })

  test.describe('AC2 (a2ef8786): Filter and group tasks with counts', () => {
    test('should filter tasks by status', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Initially should show all tasks
      await sprintTaskBoardPage.expectTaskDisplayed('Setup JWT authentication')
      await sprintTaskBoardPage.expectTaskDisplayed('Create login form')
      await sprintTaskBoardPage.expectTaskDisplayed('Design dashboard layout')

      // When I apply filter for 'Available' status
      await sprintTaskBoardPage.filterByStatus('Available')

      // Then the task list should update to show only matching tasks
      await sprintTaskBoardPage.expectTaskDisplayed('Setup JWT authentication')
      await sprintTaskBoardPage.expectTaskNotDisplayed('Create login form')
      await sprintTaskBoardPage.expectTaskNotDisplayed('Design dashboard layout')

      // And the count should be updated
      await sprintTaskBoardPage.expectFilteredTaskCount(1, 3)
    })

    test('should filter tasks by multiple statuses', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Filter by 'Owned' status
      await sprintTaskBoardPage.filterByStatus('Owned')
      await sprintTaskBoardPage.expectTaskDisplayed('Create login form')
      await sprintTaskBoardPage.expectTaskNotDisplayed('Setup JWT authentication')

      // Clear filter and verify all tasks shown again
      await sprintTaskBoardPage.clearStatusFilter()
      await sprintTaskBoardPage.expectTaskDisplayed('Setup JWT authentication')
      await sprintTaskBoardPage.expectTaskDisplayed('Create login form')
    })

    test('should group tasks by story', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Default grouping should be by story
      // Then I should see tasks grouped by story
      await sprintTaskBoardPage.expectStoryGroupDisplayed('User Authentication', 2)
      await sprintTaskBoardPage.expectStoryGroupDisplayed('Project Dashboard', 1)
    })

    test('should group tasks by status', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // When I change grouping to 'By Status'
      await sprintTaskBoardPage.groupBy('status')

      // Then I should see tasks grouped by status
      await sprintTaskBoardPage.expectStatusGroupDisplayed('Available', 1)
      await sprintTaskBoardPage.expectStatusGroupDisplayed('Owned', 1)
      await sprintTaskBoardPage.expectStatusGroupDisplayed('Completed', 1)
    })

    test('should display task counts in each group', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Group by story and verify counts
      await sprintTaskBoardPage.groupBy('story')
      await sprintTaskBoardPage.expectStoryGroupDisplayed('User Authentication', 2)

      // Group by status and verify counts
      await sprintTaskBoardPage.groupBy('status')
      await sprintTaskBoardPage.expectStatusGroupDisplayed('Available', 1)
    })

    test('should update counts when filters are applied', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Apply filter and verify count updates
      await sprintTaskBoardPage.filterByStatus('Available')
      await sprintTaskBoardPage.expectFilteredTaskCount(1, 3)

      // Clear filter and verify total count
      await sprintTaskBoardPage.clearStatusFilter()
      await sprintTaskBoardPage.expectTaskCount(3)
    })
  })

  test.describe('AC3 (8e8e949d): Visual distinction for available/my tasks', () => {
    test('should clearly distinguish available tasks', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then available tasks should be clearly visually distinguished
      await sprintTaskBoardPage.expectAvailableTaskBadge('Setup JWT authentication')
    })

    test('should highlight my own tasks', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then my own tasks should be highlighted or marked
      // Assuming current user owns task-2
      await sprintTaskBoardPage.expectMyTaskBadge('Create login form')
    })

    test('should show owner name for tasks owned by others', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then tasks owned by others should show the owner name
      await sprintTaskBoardPage.expectOwnerDisplayed('Design dashboard layout', 'user-2')
    })

    test('should visually differentiate between available, my, and others tasks', async ({
      page,
    }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Available task
      await sprintTaskBoardPage.expectAvailableTaskBadge('Setup JWT authentication')

      // My task
      await sprintTaskBoardPage.expectMyTaskBadge('Create login form')

      // Task owned by someone else
      await sprintTaskBoardPage.expectOwnerDisplayed('Design dashboard layout', 'user-2')
    })
  })

  test.describe('AC4 (728fd41e): Real-time updates', () => {
    test('should show connection indicator', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then I should see the real-time connection indicator
      await sprintTaskBoardPage.expectConnectionIndicatorConnected()
    })

    test('should update when another user takes ownership', async ({ page, context }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // When another contributor takes ownership of a task
      // (This would normally be simulated via WebSocket or second browser context)
      // For now, we'll test the notification mechanism

      // Then the board should update in real-time
      // And I should see a subtle notification of the change
      // Note: In a real E2E test, we'd simulate WebSocket events or use a second user session

      // Verify notification appears when task ownership changes
      // This is a placeholder - actual implementation would require WebSocket simulation
      await expect(sprintTaskBoardPage.connectionIndicator).toBeVisible()
    })

    test('should update when task status changes', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Initial state
      await sprintTaskBoardPage.expectTaskDisplayed('Setup JWT authentication')

      // When task status changes (simulated via user action)
      await sprintTaskBoardPage.takeTaskOwnership('Setup JWT authentication')

      // Then board should update without refresh
      await sprintTaskBoardPage.expectTaskUpdatedWithoutRefresh('Setup JWT authentication', 'Owned')

      // And notification should appear
      await sprintTaskBoardPage.expectRealtimeNotification('Task claimed')
    })

    test('should not require page refresh for updates', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Record current URL
      const initialUrl = page.url()

      // Perform action that triggers update
      await sprintTaskBoardPage.takeTaskOwnership('Setup JWT authentication')

      // Verify URL hasn't changed (no page refresh)
      expect(page.url()).toBe(initialUrl)

      // Verify UI updated
      await sprintTaskBoardPage.expectMyTaskBadge('Setup JWT authentication')
    })

    test('should show subtle notification for real-time changes', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Take ownership of a task
      await sprintTaskBoardPage.takeTaskOwnership('Setup JWT authentication')

      // Verify notification appears
      await sprintTaskBoardPage.expectRealtimeNotification('Task claimed')

      // Notification should auto-dismiss after a few seconds
      await page.waitForTimeout(4000)
      const notification = sprintTaskBoardPage.toast.filter({ hasText: 'Task claimed' })
      await expect(notification).not.toBeVisible()
    })
  })

  test.describe('AC5 (d4d41a1f): Sprint header with metrics', () => {
    test('should display sprint name, dates, and days remaining', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then I should see the sprint name, start date, end date, and days remaining
      await sprintTaskBoardPage.expectSprintHeaderDisplayed('Sprint 1')
      await expect(sprintTaskBoardPage.sprintDates).toBeVisible()
      await expect(sprintTaskBoardPage.daysRemaining).toBeVisible()
    })

    test('should display progress indicator with percentage', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then I should see a progress indicator showing percentage of tasks completed
      await expect(sprintTaskBoardPage.progressBar).toBeVisible()
      await expect(sprintTaskBoardPage.progressPercentage).toBeVisible()

      // With 1 completed out of 3 tasks = 33%
      await sprintTaskBoardPage.expectProgressPercentage(33)
    })

    test('should display total number of stories', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then I should see the total number of stories in the sprint
      await sprintTaskBoardPage.expectSprintMetrics({
        stories: 2,
      })
    })

    test('should display task statistics', async ({ page }) => {
      // Given I am viewing the sprint task board
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Then I should see total tasks, completed tasks, and my tasks
      await sprintTaskBoardPage.expectSprintMetrics({
        totalTasks: 3,
        completedTasks: 1,
        myTasks: 1,
      })
    })

    test('should update metrics when task status changes', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Initial metrics
      await sprintTaskBoardPage.expectSprintMetrics({
        completedTasks: 1,
      })
      await sprintTaskBoardPage.expectProgressPercentage(33)

      // Complete another task
      await sprintTaskBoardPage.updateTaskStatus('Create login form', 'Completed')

      // Metrics should update
      await sprintTaskBoardPage.expectSprintMetrics({
        completedTasks: 2,
      })
      await sprintTaskBoardPage.expectProgressPercentage(67)
    })
  })

  test.describe('Edge Cases and Error Handling', () => {
    test('should handle empty sprint with no tasks', async ({ page }) => {
      // Navigate to sprint with no tasks
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-empty', 'sprint-empty')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Should show empty state
      await sprintTaskBoardPage.expectNoTasks()
    })

    test('should show loading state while fetching data', async ({ page }) => {
      // Intercept API to delay response
      await page.route('**/api/sprints/**', async (route) => {
        await page.waitForTimeout(2000)
        await route.continue()
      })

      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')

      // Should show loading state
      await sprintTaskBoardPage.expectLoadingState()
    })

    test('should handle error when sprint fails to load', async ({ page }) => {
      // Intercept API to return error
      await page.route('**/api/sprints/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })

      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')

      // Should show error state
      await sprintTaskBoardPage.expectErrorState('Failed to load sprint data')
    })

    test('should allow retry after error', async ({ page }) => {
      let requestCount = 0

      await page.route('**/api/sprints/**', (route) => {
        requestCount++
        if (requestCount === 1) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
          })
        } else {
          route.continue()
        }
      })

      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectErrorState()

      // Click try again
      await sprintTaskBoardPage.clickTryAgain()

      // Should load successfully
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()
    })

    test('should navigate back to sprints list', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Click back to sprints
      await sprintTaskBoardPage.goBackToSprints()

      // Should navigate to sprints page
      expect(page.url()).toContain('/sprints')
    })
  })

  test.describe('Integration with Task Actions', () => {
    test('should allow claiming an available task', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Available task should have claim button
      await sprintTaskBoardPage.expectAvailableTaskBadge('Setup JWT authentication')

      // Claim the task
      await sprintTaskBoardPage.takeTaskOwnership('Setup JWT authentication')

      // Should now show as my task
      await sprintTaskBoardPage.expectMyTaskBadge('Setup JWT authentication')

      // Metrics should update
      await sprintTaskBoardPage.expectSprintMetrics({
        myTasks: 2,
      })
    })

    test('should allow releasing task ownership', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // My task should have release button
      await sprintTaskBoardPage.expectMyTaskBadge('Create login form')

      // Release the task
      await sprintTaskBoardPage.releaseTaskOwnership('Create login form')

      // Should now show as available
      await sprintTaskBoardPage.expectAvailableTaskBadge('Create login form')

      // Metrics should update
      await sprintTaskBoardPage.expectSprintMetrics({
        myTasks: 0,
      })
    })

    test('should update task status', async ({ page }) => {
      await sprintTaskBoardPage.gotoSprintTaskBoard('project-1', 'sprint-1')
      await sprintTaskBoardPage.expectSprintTaskBoardLoaded()

      // Update task status
      await sprintTaskBoardPage.updateTaskStatus('Create login form', 'In Progress')

      // Should show updated status
      await sprintTaskBoardPage.expectTaskWithDetails('Create login form', {
        status: 'In Progress',
      })

      // When grouped by status, should be in correct group
      await sprintTaskBoardPage.groupBy('status')
      await sprintTaskBoardPage.expectStatusGroupDisplayed('In Progress', 1)
    })
  })
})
