import { test, expect } from '@playwright/test'

// This test file is configured to use stored authentication state
// It will automatically be authenticated when running tests

test.describe('Dashboard (Authenticated)', () => {
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

    // Look for user-specific elements (adjust selectors based on your UI)
    const userElements = page.locator('[data-testid="user-menu"], .user-avatar, .user-name')

    // At least one user indicator should be present
    const count = await userElements.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should navigate to protected pages', async ({ page }) => {
    // Test navigation to other protected pages
    await page.goto('/projects')
    await expect(page).not.toHaveURL(/sign-in/)

    await page.goto('/team')
    await expect(page).not.toHaveURL(/sign-in/)
  })
})