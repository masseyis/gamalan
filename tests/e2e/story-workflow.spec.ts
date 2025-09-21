import { test, expect } from '@playwright/test'
import { loginAs, createTestProject, createTestStory } from './helpers/test-utils'

test.describe('Enhanced Story Workflow (9-Stage Process)', () => {

  test.describe('Story Status Transitions', () => {

    test('Story follows the complete workflow: Draft → Accepted', async ({ page }) => {
      // Given I am logged in as a Product Owner
      await loginAs(page, 'product_owner')

      // And I have a project with a draft story
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then the story should start in Draft status
      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText('Draft')

      // When I transition to Needs Refinement
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'needsrefinement')
      await page.click('[data-testid="save-status-btn"]')

      // Then the status should update
      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText('Needs Refinement')

      // When I add required acceptance criteria (minimum 3)
      await page.click('[data-testid="add-acceptance-criteria"]')
      await page.fill('[data-testid="ac-given"]', 'Given a user wants to log in')
      await page.fill('[data-testid="ac-when"]', 'When they enter valid credentials')
      await page.fill('[data-testid="ac-then"]', 'Then they should be authenticated')
      await page.click('[data-testid="save-ac-btn"]')

      // Add second AC
      await page.click('[data-testid="add-acceptance-criteria"]')
      await page.fill('[data-testid="ac-given"]', 'Given a user enters invalid credentials')
      await page.fill('[data-testid="ac-when"]', 'When they attempt to log in')
      await page.fill('[data-testid="ac-then"]', 'Then they should see an error message')
      await page.click('[data-testid="save-ac-btn"]')

      // Add third AC
      await page.click('[data-testid="add-acceptance-criteria"]')
      await page.fill('[data-testid="ac-given"]', 'Given a user is locked out')
      await page.fill('[data-testid="ac-when"]', 'When they attempt to log in')
      await page.fill('[data-testid="ac-then"]', 'Then they should be notified about account status')
      await page.click('[data-testid="save-ac-btn"]')

      // When I transition to Ready (should be available now with 3+ ACs)
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'ready')
      await page.click('[data-testid="save-status-btn"]')

      // Then the status should update to Ready
      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText('Ready')

      // Continue through remaining statuses...
      const statusFlow = [
        { from: 'ready', to: 'committed', label: 'Committed' },
        { from: 'committed', to: 'inprogress', label: 'In Progress' },
        { from: 'inprogress', to: 'taskscomplete', label: 'Tasks Complete' },
        { from: 'taskscomplete', to: 'deployed', label: 'Deployed' },
        { from: 'deployed', to: 'awaitingacceptance', label: 'Awaiting Acceptance' },
        { from: 'awaitingacceptance', to: 'accepted', label: 'Accepted' }
      ]

      for (const transition of statusFlow) {
        await page.click(`[data-testid="update-status-${storyId}"]`)
        await page.selectOption('[data-testid="status-select"]', transition.to)
        await page.click('[data-testid="save-status-btn"]')
        await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText(transition.label)
      }
    })

    test('Invalid status transitions are prevented', async ({ page }) => {
      // Given I am a Product Owner with a draft story
      await loginAs(page, 'product_owner')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // When I try to jump directly from Draft to Committed
      await page.click(`[data-testid="update-status-${storyId}"]`)

      // Then Committed should not be available in the dropdown
      const committedOption = page.locator('[data-testid="status-select"] option[value="committed"]')
      await expect(committedOption).toBeDisabled()

      // And I should see guidance about valid transitions
      await expect(page.locator('[data-testid="valid-transitions-help"]'))
        .toContainText('From Draft, you can only transition to: Needs Refinement')
    })

    test('Stories can go backwards in workflow for refinement', async ({ page }) => {
      // Given I have a story in Ready status
      await loginAs(page, 'product_owner')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Transition to Needs Refinement then Ready
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'needsrefinement')
      await page.click('[data-testid="save-status-btn"]')

      // Add minimum ACs to allow Ready transition
      await addMinimumAcceptanceCriteria(page)

      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'ready')
      await page.click('[data-testid="save-status-btn"]')

      // When I need to go back for refinement
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'needsrefinement')
      await page.click('[data-testid="save-status-btn"]')

      // Then the status should update successfully
      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText('Needs Refinement')

      // And I can even go back to Draft if needed
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'draft')
      await page.click('[data-testid="save-status-btn"]')

      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toContainText('Draft')
    })
  })

  test.describe('Story Readiness Gates', () => {

    test('Stories require minimum 3 acceptance criteria to become Ready', async ({ page }) => {
      // Given I have a story in Needs Refinement
      await loginAs(page, 'product_owner')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await page.selectOption('[data-testid="status-select"]', 'needsrefinement')
      await page.click('[data-testid="save-status-btn"]')

      // When I try to transition to Ready without enough ACs
      await page.click(`[data-testid="update-status-${storyId}"]`)

      // Then Ready should be disabled
      const readyOption = page.locator('[data-testid="status-select"] option[value="ready"]')
      await expect(readyOption).toBeDisabled()

      // And I should see guidance about requirements
      await expect(page.locator('[data-testid="readiness-requirements"]'))
        .toContainText('Requires: 3+ acceptance criteria, test prompts, demo script')

      // When I add only 2 acceptance criteria
      await addAcceptanceCriteria(page, 'User wants to log in', 'They enter credentials', 'They are authenticated')
      await addAcceptanceCriteria(page, 'User enters invalid data', 'They submit form', 'They see error')

      // Then Ready should still be disabled
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await expect(readyOption).toBeDisabled()

      // When I add the third acceptance criteria
      await addAcceptanceCriteria(page, 'User account is locked', 'They attempt login', 'They see lockout message')

      // Then Ready should become available
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await expect(readyOption).not.toBeDisabled()
    })

    test('Stories have story point limits (max 8 points)', async ({ page }) => {
      // Given I have a story
      await loginAs(page, 'product_owner')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // When I try to set story points above 8
      await page.click(`[data-testid="edit-story-points-${storyId}"]`)
      await page.fill('[data-testid="story-points-input"]', '13')
      await page.click('[data-testid="save-points-btn"]')

      // Then I should see a validation error
      await expect(page.locator('[data-testid="points-error"]'))
        .toContainText('Story points cannot exceed 8. Consider splitting this story.')

      // And I should see guidance about story splitting
      await expect(page.locator('[data-testid="split-story-help"]'))
        .toContainText('Large stories should be split for better predictability')

      // When I set valid story points
      await page.fill('[data-testid="story-points-input"]', '5')
      await page.click('[data-testid="save-points-btn"]')

      // Then the points should be saved successfully
      await expect(page.locator(`[data-testid="story-points-${storyId}"]`)).toContainText('5')
    })
  })

  test.describe('Role-Based Permissions', () => {

    test('Only Product Owners can accept completed stories', async ({ page }) => {
      // Given I am a contributor with a story awaiting acceptance
      await loginAs(page, 'contributor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      // Story is set to Awaiting Acceptance by PO (simulate this)
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // When I try to accept the story
      await page.click(`[data-testid="update-status-${storyId}"]`)

      // Then Accepted should not be available to me
      const acceptedOption = page.locator('[data-testid="status-select"] option[value="accepted"]')
      await expect(acceptedOption).toBeDisabled()

      // And I should see an explanation
      await expect(page.locator('[data-testid="acceptance-restriction"]'))
        .toContainText('Only Product Owners can accept completed stories')

      // When I log in as Product Owner
      await loginAs(page, 'product_owner')
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should be able to accept the story
      await page.click(`[data-testid="update-status-${storyId}"]`)
      await expect(acceptedOption).not.toBeDisabled()
    })

    test('Sponsors can only view, not modify stories', async ({ page }) => {
      // Given I am a sponsor
      await loginAs(page, 'sponsor')
      const projectId = await createTestProject(page, 'Test Project')
      const storyId = await createTestStory(page, projectId, 'User Authentication')

      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      // Then I should NOT see edit buttons
      await expect(page.locator(`[data-testid="edit-story-${storyId}"]`)).not.toBeVisible()
      await expect(page.locator(`[data-testid="update-status-${storyId}"]`)).not.toBeVisible()
      await expect(page.locator('[data-testid="add-acceptance-criteria"]')).not.toBeVisible()

      // But I should be able to view story details
      await expect(page.locator(`[data-testid="story-title-${storyId}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="story-status-${storyId}"]`)).toBeVisible()

      // And I should see a tooltip explaining my read-only access
      await page.hover(`[data-testid="story-card-${storyId}"]`)
      await expect(page.locator('[data-testid="sponsor-view-tooltip"]'))
        .toContainText('Sponsors have read-only access to view progress and forecasts')
    })
  })
})

// Helper function to add acceptance criteria
async function addAcceptanceCriteria(page: any, given: string, when: string, then: string) {
  await page.click('[data-testid="add-acceptance-criteria"]')
  await page.fill('[data-testid="ac-given"]', given)
  await page.fill('[data-testid="ac-when"]', when)
  await page.fill('[data-testid="ac-then"]', then)
  await page.click('[data-testid="save-ac-btn"]')
}

// Helper to add minimum required ACs
async function addMinimumAcceptanceCriteria(page: any) {
  await addAcceptanceCriteria(page, 'User wants to log in', 'They enter valid credentials', 'They are authenticated')
  await addAcceptanceCriteria(page, 'User enters invalid credentials', 'They attempt to log in', 'They see an error message')
  await addAcceptanceCriteria(page, 'User account is locked', 'They attempt to log in', 'They see lockout notification')
}