import { test, expect } from '@playwright/test'
import { loginAs, createTestOrganization } from './helpers/test-utils'

test.describe('Team Management', () => {
  test.describe('Team Creation and Management', () => {
    test('Product Owner can create a team', async ({ page }) => {
      // Given I am logged in as a Product Owner
      await loginAs(page, 'product_owner')

      // When I navigate to teams page
      await page.goto('/teams')

      // And I click "Create Team"
      await page.click('[data-testid="create-team-btn"]')

      // And I fill in team details
      await page.fill('[data-testid="team-name-input"]', 'Alpha Team')
      await page.click('[data-testid="save-team-btn"]')

      // Then I should see the new team in the list
      await expect(page.locator('[data-testid="team-list"]')).toContainText('Alpha Team')

      // And I should be automatically added as a member
      await page.click('[data-testid="team-alpha-team"]')
      await expect(page.locator('[data-testid="team-members"]')).toContainText('Product Owner')
    })

    test('Team names must be unique within organization', async ({ page }) => {
      // Given I am a Product Owner and a team "Alpha Team" already exists
      await loginAs(page, 'product_owner')
      await page.goto('/teams')

      await page.click('[data-testid="create-team-btn"]')
      await page.fill('[data-testid="team-name-input"]', 'Alpha Team')
      await page.click('[data-testid="save-team-btn"]')

      // When I try to create another team with the same name
      await page.click('[data-testid="create-team-btn"]')
      await page.fill('[data-testid="team-name-input"]', 'Alpha Team')
      await page.click('[data-testid="save-team-btn"]')

      // Then I should see a validation error
      await expect(page.locator('[data-testid="team-name-error"]')).toContainText(
        'Team name "Alpha Team" already exists in this organization'
      )
    })

    test('Team displays velocity history', async ({ page }) => {
      // Given I have a team with sprint history
      await loginAs(page, 'product_owner')
      await page.goto('/teams')

      await page.click('[data-testid="create-team-btn"]')
      await page.fill('[data-testid="team-name-input"]', 'Beta Team')
      await page.click('[data-testid="save-team-btn"]')

      // When I view the team details
      await page.click('[data-testid="team-beta-team"]')

      // Then I should see velocity chart (initially empty)
      await expect(page.locator('[data-testid="velocity-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="velocity-empty-state"]')).toContainText(
        'Complete your first sprint to see velocity data'
      )

      // And I should see velocity metrics
      await expect(page.locator('[data-testid="average-velocity"]')).toContainText('0')
      await expect(page.locator('[data-testid="velocity-trend"]')).toContainText('No data')
    })
  })

  test.describe('Team Membership', () => {
    test('Contributors can join existing teams', async ({ page }) => {
      // Given there is an existing team
      await loginAs(page, 'product_owner')
      await page.goto('/teams')
      await page.click('[data-testid="create-team-btn"]')
      await page.fill('[data-testid="team-name-input"]', 'Dev Team')
      await page.click('[data-testid="save-team-btn"]')

      // When I log in as a contributor
      await loginAs(page, 'contributor')
      await page.goto('/teams')

      // Then I should see available teams to join
      await expect(page.locator('[data-testid="available-teams"]')).toContainText('Dev Team')

      // When I click "Join Team"
      await page.click('[data-testid="join-team-dev-team"]')

      // And I select my role and specialty
      await page.selectOption('[data-testid="role-select"]', 'contributor')
      await page.selectOption('[data-testid="specialty-select"]', 'fullstack')
      await page.click('[data-testid="confirm-join-btn"]')

      // Then I should be added to the team
      await expect(page.locator('[data-testid="my-teams"]')).toContainText('Dev Team')

      // And when I view team details, I should see myself listed
      await page.click('[data-testid="team-dev-team"]')
      await expect(page.locator('[data-testid="team-members"]')).toContainText(
        'Contributor (Fullstack)'
      )
    })

    test('Role and specialty constraints are enforced', async ({ page }) => {
      // Given I am joining a team as a contributor
      await loginAs(page, 'contributor')
      await page.goto('/teams')
      await page.click('[data-testid="join-team-dev-team"]')

      // When I select contributor role
      await page.selectOption('[data-testid="role-select"]', 'contributor')

      // Then specialty should be required
      await page.click('[data-testid="confirm-join-btn"]')
      await expect(page.locator('[data-testid="specialty-error"]')).toContainText(
        'Contributors must specify a specialty'
      )

      // When I select a non-contributor role
      await page.selectOption('[data-testid="role-select"]', 'sponsor')

      // Then specialty should be disabled
      await expect(page.locator('[data-testid="specialty-select"]')).toBeDisabled()

      // And I should see explanation
      await expect(page.locator('[data-testid="specialty-help"]')).toContainText(
        'Only contributors have specialties'
      )
    })

    test('Team members can view other members with roles', async ({ page }) => {
      // Given I am part of a team with multiple members
      await setupTeamWithMembers(page)

      // When I view the team
      await loginAs(page, 'contributor')
      await page.goto('/teams/dev-team')

      // Then I should see all team members with their roles
      await expect(page.locator('[data-testid="member-alice"]')).toContainText('Product Owner')
      await expect(page.locator('[data-testid="member-bob"]')).toContainText(
        'Contributor (Backend)'
      )
      await expect(page.locator('[data-testid="member-charlie"]')).toContainText(
        'Contributor (Frontend)'
      )
      await expect(page.locator('[data-testid="member-diana"]')).toContainText(
        'Managing Contributor (QA)'
      )

      // And I should see team composition summary
      await expect(page.locator('[data-testid="team-composition"]')).toContainText(
        '1 Product Owner, 3 Contributors'
      )
    })
  })

  test.describe('Team Restrictions and Guidance', () => {
    test('Teams can only have one active sprint at a time', async ({ page }) => {
      // Given I have a team with an active sprint
      await loginAs(page, 'product_owner')
      await setupTeamWithActiveSprint(page)

      // When I try to create another sprint
      await page.goto('/teams/dev-team/sprints')
      await page.click('[data-testid="create-sprint-btn"]')

      // Then I should see a restriction message
      await expect(page.locator('[data-testid="active-sprint-restriction"]')).toContainText(
        'Team already has an active sprint. Complete or close the current sprint first.'
      )

      // And the create button should be disabled
      await expect(page.locator('[data-testid="create-sprint-btn"]')).toBeDisabled()

      // When I hover over the disabled button
      await page.hover('[data-testid="create-sprint-btn"]')

      // Then I should see helpful guidance
      await expect(page.locator('[data-testid="one-sprint-tooltip"]')).toContainText(
        'Teams focus on one sprint at a time for maximum effectiveness'
      )
    })

    test('Shows guidance about team composition', async ({ page }) => {
      // Given I am viewing a team
      await loginAs(page, 'product_owner')
      await page.goto('/teams/dev-team')

      // When I hover over the team composition info
      await page.hover('[data-testid="team-composition-help"]')

      // Then I should see guidance about optimal team structure
      await expect(page.locator('[data-testid="team-structure-tooltip"]')).toContainText(
        'Recommended: 1 Product Owner, 3-7 Contributors with diverse specialties'
      )

      // When the team is too small
      await page.goto('/teams/small-team')
      await expect(page.locator('[data-testid="team-size-warning"]')).toContainText(
        'Consider adding more contributors for better velocity'
      )

      // When the team is too large
      await page.goto('/teams/large-team')
      await expect(page.locator('[data-testid="team-size-warning"]')).toContainText(
        'Large teams may benefit from splitting into smaller, focused teams'
      )
    })

    test('Team member roles determine available actions', async ({ page }) => {
      // Given I am a contributor on a team
      await loginAs(page, 'contributor')
      await page.goto('/teams/dev-team')

      // Then I should NOT see team management actions
      await expect(page.locator('[data-testid="edit-team-btn"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="remove-member-btn"]')).not.toBeVisible()

      // When I log in as Product Owner
      await loginAs(page, 'product_owner')
      await page.goto('/teams/dev-team')

      // Then I should see team management actions
      await expect(page.locator('[data-testid="edit-team-btn"]')).toBeVisible()
      await expect(page.locator('[data-testid="manage-members-btn"]')).toBeVisible()

      // When I log in as a sponsor
      await loginAs(page, 'sponsor')
      await page.goto('/teams/dev-team')

      // Then I should only see view permissions
      await expect(page.locator('[data-testid="team-members"]')).toBeVisible()
      await expect(page.locator('[data-testid="velocity-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="edit-team-btn"]')).not.toBeVisible()

      // And I should see explanation of my read-only access
      await expect(page.locator('[data-testid="sponsor-team-access"]')).toContainText(
        'You have read-only access to view team progress and metrics'
      )
    })
  })
})

// Helper functions
async function setupTeamWithMembers(page: any) {
  // Set up a team with diverse membership
  await loginAs(page, 'product_owner')
  // ... implementation details for creating team with multiple members
}

async function setupTeamWithActiveSprint(page: any) {
  // Set up a team that already has an active sprint
  await loginAs(page, 'product_owner')
  // ... implementation details for creating team with active sprint
}
