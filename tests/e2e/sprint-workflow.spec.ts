import { test, expect } from '@playwright/test'
import { loginAs, createTestTeam } from './helpers/test-utils'

test.describe('Sprint Workflow Management', () => {
  test.describe('Sprint Creation and Planning', () => {
    test('Product Owner can create a sprint with required fields', async ({ page }) => {
      // Given I am a Product Owner with a team
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')

      // When I navigate to sprint planning
      await page.goto(`/teams/${teamId}/sprints`)
      await page.click('[data-testid="create-sprint-btn"]')

      // And I fill in sprint details
      await page.fill('[data-testid="sprint-name"]', 'Sprint 1: Authentication')
      await page.fill('[data-testid="sprint-goal"]', 'Implement user authentication system')
      await page.fill('[data-testid="capacity-points"]', '25')

      // Set sprint dates (2-week sprint)
      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)
      await page.fill('[data-testid="start-date"]', startDate.toISOString().split('T')[0])
      await page.fill('[data-testid="end-date"]', endDate.toISOString().split('T')[0])

      await page.click('[data-testid="create-sprint-btn-submit"]')

      // Then the sprint should be created successfully
      await expect(page.locator('[data-testid="sprint-list"]')).toContainText(
        'Sprint 1: Authentication'
      )
      await expect(page.locator('[data-testid="sprint-status"]')).toContainText('Planning')
      await expect(page.locator('[data-testid="sprint-capacity"]')).toContainText('25 points')
    })

    test('Sprint validation enforces constraints', async ({ page }) => {
      // Given I am creating a sprint
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      await page.goto(`/teams/${teamId}/sprints`)
      await page.click('[data-testid="create-sprint-btn"]')

      // When I try to create a sprint longer than 4 weeks
      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000) // 35 days
      await page.fill('[data-testid="start-date"]', startDate.toISOString().split('T')[0])
      await page.fill('[data-testid="end-date"]', endDate.toISOString().split('T')[0])

      await page.fill('[data-testid="sprint-name"]', 'Long Sprint')
      await page.fill('[data-testid="sprint-goal"]', 'Too long goal')
      await page.fill('[data-testid="capacity-points"]', '25')

      await page.click('[data-testid="create-sprint-btn-submit"]')

      // Then I should see a validation error
      await expect(page.locator('[data-testid="date-error"]')).toContainText(
        'Sprint cannot exceed 28 days (4 weeks)'
      )

      // When I try to set end date before start date
      const invalidEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000) // 1 day before
      await page.fill('[data-testid="end-date"]', invalidEndDate.toISOString().split('T')[0])
      await page.click('[data-testid="create-sprint-btn-submit"]')

      // Then I should see appropriate error
      await expect(page.locator('[data-testid="date-error"]')).toContainText(
        'End date must be after start date'
      )

      // When I set zero capacity
      await page.fill('[data-testid="capacity-points"]', '0')
      await page.click('[data-testid="create-sprint-btn-submit"]')

      // Then I should see capacity validation
      await expect(page.locator('[data-testid="capacity-error"]')).toContainText(
        'Sprint capacity must be greater than 0'
      )
    })

    test('Sprint goal is required and provides guidance', async ({ page }) => {
      // Given I am creating a sprint
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      await page.goto(`/teams/${teamId}/sprints`)
      await page.click('[data-testid="create-sprint-btn"]')

      // When I try to create a sprint without a goal
      await page.fill('[data-testid="sprint-name"]', 'Sprint 1')
      await page.fill('[data-testid="sprint-goal"]', '') // Empty goal
      await page.fill('[data-testid="capacity-points"]', '25')

      const startDate = new Date()
      const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)
      await page.fill('[data-testid="start-date"]', startDate.toISOString().split('T')[0])
      await page.fill('[data-testid="end-date"]', endDate.toISOString().split('T')[0])

      await page.click('[data-testid="create-sprint-btn-submit"]')

      // Then I should see a validation error
      await expect(page.locator('[data-testid="goal-error"]')).toContainText(
        'Sprint goal is required'
      )

      // And I should see guidance about good goals
      await expect(page.locator('[data-testid="goal-help"]')).toContainText(
        'A good sprint goal describes the value being delivered, not just features'
      )

      // When I hover over the goal help icon
      await page.hover('[data-testid="goal-help-icon"]')

      // Then I should see examples
      await expect(page.locator('[data-testid="goal-examples"]')).toContainText(
        'Good: "Users can securely authenticate" Bad: "Build login page"'
      )
    })
  })

  test.describe('Sprint Status Transitions', () => {
    test('Sprint follows proper lifecycle: Planning → Active → Review → Completed', async ({
      page,
    }) => {
      // Given I have a sprint in Planning status
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createTestSprint(page, teamId, 'Sprint 1: Auth')

      await page.goto(`/teams/${teamId}/sprints/${sprintId}`)

      // When I start the sprint
      await page.click('[data-testid="start-sprint-btn"]')

      // Then the status should change to Active
      await expect(page.locator('[data-testid="sprint-status"]')).toContainText('Active')

      // And the start button should be replaced with management actions
      await expect(page.locator('[data-testid="start-sprint-btn"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="sprint-actions"]')).toBeVisible()

      // When the sprint period ends, I can transition to Review
      await page.click('[data-testid="end-sprint-btn"]')
      await page.click('[data-testid="confirm-end-sprint"]')

      // Then the status should change to Review
      await expect(page.locator('[data-testid="sprint-status"]')).toContainText('Review')

      // And I should see sprint retrospective options
      await expect(page.locator('[data-testid="retrospective-section"]')).toBeVisible()

      // When I complete the retrospective
      await page.click('[data-testid="complete-retrospective-btn"]')

      // Then the status should change to Completed
      await expect(page.locator('[data-testid="sprint-status"]')).toContainText('Completed')

      // And the sprint should be locked from further changes
      await expect(page.locator('[data-testid="sprint-locked-notice"]')).toContainText(
        'This sprint is completed and cannot be modified'
      )
    })

    test('Active sprints prevent team from starting new sprints', async ({ page }) => {
      // Given I have an active sprint
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createTestSprint(page, teamId, 'Sprint 1: Auth')

      await page.goto(`/teams/${teamId}/sprints/${sprintId}`)
      await page.click('[data-testid="start-sprint-btn"]')

      // When I try to create another sprint
      await page.goto(`/teams/${teamId}/sprints`)

      // Then the create sprint button should be disabled
      await expect(page.locator('[data-testid="create-sprint-btn"]')).toBeDisabled()

      // And I should see explanation
      await expect(page.locator('[data-testid="active-sprint-notice"]')).toContainText(
        'Complete the current sprint before starting a new one'
      )

      // When I hover over the disabled button
      await page.hover('[data-testid="create-sprint-btn"]')

      // Then I should see the restriction tooltip
      await expect(page.locator('[data-testid="one-sprint-restriction-tooltip"]')).toContainText(
        'Teams focus on one sprint at a time to maintain commitment and flow'
      )
    })
  })

  test.describe('Sprint Capacity and Story Management', () => {
    test('Stories can be committed to sprint within capacity', async ({ page }) => {
      // Given I have a sprint and ready stories
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createTestSprint(page, teamId, 'Sprint 1: Auth', 20) // 20 point capacity

      // And I have stories in the backlog
      await createReadyStory(page, 'User Login', 5)
      await createReadyStory(page, 'Password Reset', 8)
      await createReadyStory(page, 'User Registration', 13) // Would exceed capacity

      // When I go to sprint planning
      await page.goto(`/teams/${teamId}/sprints/${sprintId}/planning`)

      // Then I should see available stories
      await expect(page.locator('[data-testid="available-stories"]')).toContainText(
        'User Login (5 pts)'
      )
      await expect(page.locator('[data-testid="available-stories"]')).toContainText(
        'Password Reset (8 pts)'
      )

      // When I commit stories to sprint
      await page.dragAndDrop('[data-testid="story-user-login"]', '[data-testid="sprint-backlog"]')
      await page.dragAndDrop(
        '[data-testid="story-password-reset"]',
        '[data-testid="sprint-backlog"]'
      )

      // Then capacity should be updated
      await expect(page.locator('[data-testid="committed-points"]')).toContainText('13')
      await expect(page.locator('[data-testid="remaining-capacity"]')).toContainText('7')

      // When I try to add a story that would exceed capacity
      await page.dragAndDrop(
        '[data-testid="story-user-registration"]',
        '[data-testid="sprint-backlog"]'
      )

      // Then I should see a capacity warning
      await expect(page.locator('[data-testid="capacity-warning"]')).toContainText(
        'Adding this story would exceed sprint capacity (26/20 points)'
      )

      // And I should be able to proceed with warning or cancel
      await expect(page.locator('[data-testid="proceed-over-capacity"]')).toBeVisible()
      await expect(page.locator('[data-testid="cancel-add-story"]')).toBeVisible()
    })

    test('Velocity tracking updates after sprint completion', async ({ page }) => {
      // Given I have a completed sprint
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createTestSprint(page, teamId, 'Sprint 1: Auth', 20)

      // With committed and completed stories
      await commitStoriestoSprint(page, sprintId, [
        { name: 'User Login', points: 5, completed: true },
        { name: 'Password Reset', points: 8, completed: true },
        { name: 'User Profile', points: 3, completed: false },
      ])

      // When I complete the sprint
      await page.goto(`/teams/${teamId}/sprints/${sprintId}`)
      await page.click('[data-testid="start-sprint-btn"]')
      await page.click('[data-testid="end-sprint-btn"]')
      await page.click('[data-testid="confirm-end-sprint"]')
      await page.click('[data-testid="complete-retrospective-btn"]')

      // Then velocity should be recorded
      await page.goto(`/teams/${teamId}`)
      await expect(page.locator('[data-testid="latest-velocity"]')).toContainText('13') // 5+8 completed points

      // And velocity history should be updated
      await expect(page.locator('[data-testid="velocity-chart"]')).toContainText('Sprint 1: 13 pts')

      // And team capacity planning should use this data
      await expect(page.locator('[data-testid="recommended-capacity"]')).toContainText(
        'Based on recent velocity: 13 points'
      )
    })
  })

  test.describe('Sprint Board and Daily Management', () => {
    test('Sprint board shows task progress across workflow', async ({ page }) => {
      // Given I have an active sprint with stories and tasks
      await loginAs(page, 'contributor')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createActiveSprintWithTasks(page, teamId)

      // When I view the sprint board
      await page.goto(`/teams/${teamId}/sprint`)

      // Then I should see columns for task statuses
      await expect(page.locator('[data-testid="available-column"]')).toBeVisible()
      await expect(page.locator('[data-testid="owned-column"]')).toBeVisible()
      await expect(page.locator('[data-testid="in-progress-column"]')).toBeVisible()
      await expect(page.locator('[data-testid="completed-column"]')).toBeVisible()

      // And I should see tasks in appropriate columns
      await expect(page.locator('[data-testid="available-column"]')).toContainText(
        'Implement API endpoint'
      )
      await expect(page.locator('[data-testid="owned-column"]')).toContainText('Create login form')

      // When I take ownership of an available task
      await page.click('[data-testid="task-implement-api"] [data-testid="take-ownership"]')

      // Then the task should move to Owned column
      await expect(page.locator('[data-testid="owned-column"]')).toContainText(
        'Implement API endpoint'
      )
      await expect(page.locator('[data-testid="available-column"]')).not.toContainText(
        'Implement API endpoint'
      )
    })

    test('Sprint burndown chart tracks daily progress', async ({ page }) => {
      // Given I have an active sprint with committed work
      await loginAs(page, 'product_owner')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createActiveSprintWithTasks(page, teamId)

      // When I view the sprint dashboard
      await page.goto(`/teams/${teamId}/sprint/dashboard`)

      // Then I should see burndown chart
      await expect(page.locator('[data-testid="burndown-chart"]')).toBeVisible()

      // And sprint progress metrics
      await expect(page.locator('[data-testid="days-remaining"]')).toBeVisible()
      await expect(page.locator('[data-testid="points-remaining"]')).toBeVisible()
      await expect(page.locator('[data-testid="stories-completed"]')).toBeVisible()

      // And trend indicators
      await expect(page.locator('[data-testid="sprint-health"]')).toBeVisible()
    })
  })

  test.describe('Role-Based Sprint Permissions', () => {
    test('Only Product Owners can manage sprint lifecycle', async ({ page }) => {
      // Given I am a contributor with an active sprint
      await loginAs(page, 'contributor')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createTestSprint(page, teamId, 'Sprint 1')

      await page.goto(`/teams/${teamId}/sprints/${sprintId}`)

      // Then I should NOT see sprint management actions
      await expect(page.locator('[data-testid="start-sprint-btn"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="edit-sprint-btn"]')).not.toBeVisible()

      // But I should see sprint information
      await expect(page.locator('[data-testid="sprint-goal"]')).toBeVisible()
      await expect(page.locator('[data-testid="sprint-capacity"]')).toBeVisible()

      // When I log in as Product Owner
      await loginAs(page, 'product_owner')
      await page.goto(`/teams/${teamId}/sprints/${sprintId}`)

      // Then I should see management actions
      await expect(page.locator('[data-testid="start-sprint-btn"]')).toBeVisible()
      await expect(page.locator('[data-testid="edit-sprint-btn"]')).toBeVisible()
    })

    test('Contributors can participate in active sprints', async ({ page }) => {
      // Given I am a contributor with an active sprint
      await loginAs(page, 'contributor')
      const teamId = await createTestTeam(page, 'Dev Team')
      const sprintId = await createActiveSprintWithTasks(page, teamId)

      // When I view the sprint board
      await page.goto(`/teams/${teamId}/sprint`)

      // Then I should see and can interact with tasks
      await expect(page.locator('[data-testid="take-ownership"]')).toBeVisible()
      await expect(page.locator('[data-testid="start-work"]')).toBeVisible()

      // And I should see my personal task view
      await expect(page.locator('[data-testid="my-tasks-sidebar"]')).toBeVisible()
      await expect(page.locator('[data-testid="my-tasks-sidebar"]')).toContainText('Your Tasks')
    })
  })
})

// Helper functions
async function createTestSprint(page: any, teamId: string, name: string, capacity = 20) {
  // Implementation for creating a test sprint
}

async function createReadyStory(page: any, title: string, points: number) {
  // Implementation for creating a ready story with given points
}

async function commitStoriestoSprint(page: any, sprintId: string, stories: any[]) {
  // Implementation for committing stories to sprint
}

async function createActiveSprintWithTasks(page: any, teamId: string) {
  // Implementation for creating an active sprint with tasks
}
