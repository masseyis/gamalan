import { test, expect } from '@playwright/test'
import { loginAs, createTestProject, createTestStory, createTestTask } from './helpers/test-utils'

test.describe('Task Ownership Self-Selection Workflow', () => {
  test.describe('As a Contributor', () => {
    test('I can take ownership of an available task ("I\'m on it")', async ({ page }) => {
      // Given I am logged in as a contributor
      await loginAs(page, 'contributor')

      // And there is a story with an available task
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      // When I navigate to the story detail page
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should see the task with "Available" status
      await expect(page.locator(`[data-testid="task-${taskId}"]`)).toContainText('Available')

      // And I should see an "I'm on it" button
      const takeOwnershipBtn = page.locator(`[data-testid="take-ownership-${taskId}"]`)
      await expect(takeOwnershipBtn).toBeVisible()
      await expect(takeOwnershipBtn).toHaveText("I'm on it")

      // When I click "I'm on it"
      await takeOwnershipBtn.click()

      // Then the task status should change to "Owned"
      await expect(page.locator(`[data-testid="task-status-${taskId}"]`)).toContainText('Owned')

      // And I should see my name as the owner
      await expect(page.locator(`[data-testid="task-owner-${taskId}"]`)).toContainText(
        'Test Contributor'
      )

      // And I should see a timestamp of when I took ownership
      await expect(page.locator(`[data-testid="task-owned-since-${taskId}"]`)).toBeVisible()

      // And the "I'm on it" button should be replaced with ownership actions
      await expect(takeOwnershipBtn).not.toBeVisible()
      await expect(page.locator(`[data-testid="start-work-${taskId}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="release-ownership-${taskId}"]`)).toBeVisible()
    })

    test('I can release ownership of a task I own', async ({ page }) => {
      // Given I am logged in as a contributor
      await loginAs(page, 'contributor')

      // And I own a task
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()

      // When I click "Release"
      await page.locator(`[data-testid="release-ownership-${taskId}"]`).click()

      // Then I should see a confirmation dialog
      await expect(page.locator('[data-testid="confirm-release-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="confirm-release-dialog"]')).toContainText(
        'Are you sure you want to release ownership?'
      )

      // When I confirm the release
      await page.locator('[data-testid="confirm-release-btn"]').click()

      // Then the task should return to "Available" status
      await expect(page.locator(`[data-testid="task-status-${taskId}"]`)).toContainText('Available')

      // And ownership information should be cleared
      await expect(page.locator(`[data-testid="task-owner-${taskId}"]`)).not.toBeVisible()

      // And the "I'm on it" button should be available again
      await expect(page.locator(`[data-testid="take-ownership-${taskId}"]`)).toBeVisible()
    })

    test('I can start work on a task I own', async ({ page }) => {
      // Given I own a task
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()

      // When I click "Start Work"
      await page.locator(`[data-testid="start-work-${taskId}"]`).click()

      // Then the task status should change to "In Progress"
      await expect(page.locator(`[data-testid="task-status-${taskId}"]`)).toContainText(
        'In Progress'
      )

      // And I should see work started timestamp
      await expect(page.locator(`[data-testid="task-in-progress-since-${taskId}"]`)).toBeVisible()

      // And the "Start Work" button should be replaced with "Complete"
      await expect(page.locator(`[data-testid="start-work-${taskId}"]`)).not.toBeVisible()
      await expect(page.locator(`[data-testid="complete-work-${taskId}"]`)).toBeVisible()
    })

    test('I can complete work on a task I am working on', async ({ page }) => {
      // Given I am working on a task
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()
      await page.locator(`[data-testid="start-work-${taskId}"]`).click()

      // When I click "Complete"
      await page.locator(`[data-testid="complete-work-${taskId}"]`).click()

      // Then the task status should change to "Completed"
      await expect(page.locator(`[data-testid="task-status-${taskId}"]`)).toContainText('Completed')

      // And I should see completion timestamp
      await expect(page.locator(`[data-testid="task-completed-at-${taskId}"]`)).toBeVisible()

      // And no action buttons should be available
      await expect(page.locator(`[data-testid="complete-work-${taskId}"]`)).not.toBeVisible()
      await expect(page.locator(`[data-testid="start-work-${taskId}"]`)).not.toBeVisible()
      await expect(page.locator(`[data-testid="take-ownership-${taskId}"]`)).not.toBeVisible()
    })

    test('I can estimate hours for a task I own', async ({ page }) => {
      // Given I own a task
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()

      // When I set an estimate
      await page.locator(`[data-testid="estimate-hours-${taskId}"]`).click()
      await page.fill('[data-testid="hours-input"]', '8')
      await page.click('[data-testid="save-estimate-btn"]')

      // Then I should see the estimate displayed
      await expect(page.locator(`[data-testid="task-estimate-${taskId}"]`)).toContainText('8h')

      // And the estimate should be within valid range (1-40 hours)
      await page.locator(`[data-testid="estimate-hours-${taskId}"]`).click()
      await page.fill('[data-testid="hours-input"]', '50')
      await page.click('[data-testid="save-estimate-btn"]')

      // Then I should see a validation error
      await expect(page.locator('[data-testid="estimate-error"]')).toContainText(
        'Task cannot exceed 40 hours'
      )
    })
  })

  test.describe('Workflow Restrictions', () => {
    test('Non-contributors cannot take task ownership', async ({ page }) => {
      // Given I am logged in as a sponsor (read-only role)
      await loginAs(page, 'sponsor')

      // When I navigate to a story with available tasks
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should NOT see the "I'm on it" button
      await expect(page.locator(`[data-testid="take-ownership-${taskId}"]`)).not.toBeVisible()

      // And I should see a tooltip explaining the restriction
      await page.hover(`[data-testid="task-${taskId}"]`)
      await expect(page.locator('[data-testid="ownership-restriction-tooltip"]')).toContainText(
        'Only contributors can take task ownership'
      )
    })

    test('Users cannot take ownership of already owned tasks', async ({ page }) => {
      // Given there is a task owned by another user
      await loginAs(page, 'contributor-alice')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()

      // When I log in as a different contributor
      await loginAs(page, 'contributor-bob')
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should NOT see the "I'm on it" button
      await expect(page.locator(`[data-testid="take-ownership-${taskId}"]`)).not.toBeVisible()

      // And I should see who owns the task
      await expect(page.locator(`[data-testid="task-owner-${taskId}"]`)).toContainText('Alice')

      // And I should see a tooltip explaining why I can't take it
      await page.hover(`[data-testid="task-${taskId}"]`)
      await expect(page.locator('[data-testid="task-owned-tooltip"]')).toContainText(
        'This task is already owned by Alice'
      )
    })

    test('Users can only start/complete work on tasks they own', async ({ page }) => {
      // Given there is a task owned by another user
      await loginAs(page, 'contributor-alice')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()
      await page.locator(`[data-testid="start-work-${taskId}"]`).click()

      // When I log in as a different contributor
      await loginAs(page, 'contributor-bob')
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should NOT see work action buttons
      await expect(page.locator(`[data-testid="start-work-${taskId}"]`)).not.toBeVisible()
      await expect(page.locator(`[data-testid="complete-work-${taskId}"]`)).not.toBeVisible()

      // And the task should show as "In Progress" by Alice
      await expect(page.locator(`[data-testid="task-status-${taskId}"]`)).toContainText(
        'In Progress'
      )
      await expect(page.locator(`[data-testid="task-owner-${taskId}"]`)).toContainText('Alice')
    })
  })

  test.describe('User Guidance', () => {
    test('Shows tooltip explaining one task limitation', async ({ page }) => {
      // Given I am a contributor who already owns a task
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId1 = await createTestTask(page, storyId, 'Implement login endpoint')
      const taskId2 = await createTestTask(page, storyId, 'Add password validation')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId1}"]`).click()

      // When I hover over another available task
      await page.hover(`[data-testid="take-ownership-${taskId2}"]`)

      // Then I should see guidance about the one-task limitation
      await expect(page.locator('[data-testid="one-task-limit-tooltip"]')).toContainText(
        'Complete your current task before taking ownership of another'
      )

      // And the button should be disabled
      await expect(page.locator(`[data-testid="take-ownership-${taskId2}"]`)).toBeDisabled()
    })

    test('Shows workflow guidance for task progression', async ({ page }) => {
      // Given I own a task
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')
      const taskId = await createTestTask(page, storyId, 'Implement login endpoint')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.locator(`[data-testid="take-ownership-${taskId}"]`).click()

      // When I hover over workflow elements
      await page.hover(`[data-testid="task-workflow-help-${taskId}"]`)

      // Then I should see workflow guidance
      await expect(page.locator('[data-testid="workflow-guidance-tooltip"]')).toContainText(
        'Owned → Start Work → Complete'
      )
    })
  })
})
