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

    // Should be redirected to sign-in (adjust URL pattern based on your Clerk setup)
    await expect(page).toHaveURL(/sign-in/)
  })

  test('should allow navigation to public pages', async ({ page }) => {
    await page.goto('/')

    // If you have public pages like about, pricing, etc., test them here
    // For now, just verify home page works
    await expect(page.locator('body')).toBeVisible()
  })
})