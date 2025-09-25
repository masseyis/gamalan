import { test, expect } from '@playwright/test'

// This test file runs without authentication for public pages

test.describe('Landing Page (Public)', () => {
  test('should load the home page successfully', async ({ page }) => {
    await page.goto('/')

    // Check that the page loads
    await expect(page).toHaveTitle(/Battra AI/)

    // Look for public content
    await expect(page.locator('body')).toBeVisible()
  })

  test('should redirect to sign-in for protected routes', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard')

    // In mock auth environment, we should be able to access dashboard
    // In real environment without auth, should redirect to sign-in

    // Check if we're in test environment with mock auth
    const hasMockAuth = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

    if (hasMockAuth) {
      // With mock auth, dashboard should be accessible
      await expect(page).toHaveURL(/dashboard/)
      await expect(page.locator('h1')).toContainText('Welcome back')
    } else {
      // Without auth, should redirect to sign-in
      await expect(page).toHaveURL(/sign-in/)
    }
  })

  test('should allow navigation to public pages', async ({ page }) => {
    await page.goto('/')

    // If you have public pages like about, pricing, etc., test them here
    // For now, just verify home page works
    await expect(page.locator('body')).toBeVisible()
  })
})