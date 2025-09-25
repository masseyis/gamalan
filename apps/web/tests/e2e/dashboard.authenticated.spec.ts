import { test, expect } from '@playwright/test'
import { setupMockAuth } from '@/lib/auth/test-utils'

// This test file uses mock authentication for testing authenticated states

test.describe('Dashboard (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Setup consistent mock authentication
    await setupMockAuth(page)
  })

  test('should access dashboard when authenticated', async ({ page }) => {
    // Navigate to dashboard - should be accessible since we're authenticated
    await page.goto('/dashboard')

    // Check for authenticated content
    await expect(page).toHaveTitle(/Battra AI/)

    // Look for navigation or user indicators
    const navigation = page.locator('nav, [data-testid="navigation"]')
    await expect(navigation).toBeVisible()

    // Check that we're not redirected to sign-in
    await expect(page).not.toHaveURL(/sign-in/)
  })

  test('should display user-specific content', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Allow time for mock auth to setup

    // Look for user-specific elements that exist in the mock authenticated UI
    const userElements = [
      page.locator('text=Test User'),           // From mock user data
      page.locator('text=test@example.com'),   // From mock user email
      page.locator('text=TU'),                 // User initials in avatar
      page.locator('[data-testid="user-menu"]'),
      page.locator('.user-avatar'),
      page.locator('.user-name'),
      page.locator('text=Test Organization')   // From mock org data
    ]

    // At least one user indicator should be present
    let found = false
    for (const locator of userElements) {
      if (await locator.isVisible()) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })

  test('should navigate to protected pages', async ({ page }) => {
    // Test navigation to other protected pages
    await page.goto('/projects')
    await expect(page).not.toHaveURL(/sign-in/)

    await page.goto('/team')
    await expect(page).not.toHaveURL(/sign-in/)
  })
})