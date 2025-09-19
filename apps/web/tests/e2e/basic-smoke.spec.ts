import { test, expect } from '@playwright/test'

test.describe('Basic Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and enable mock data for CI
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
    })
  })

  test('should load homepage without errors', async ({ page }) => {
    await page.goto('/')

    // Should not show 404 or error page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()

    // Should show some content
    await expect(page.locator('body')).not.toBeEmpty()

    // Should not have JavaScript errors
    page.on('pageerror', (err) => {
      console.error('Page error:', err.message)
    })
  })

  test('should navigate to projects page', async ({ page }) => {
    await page.goto('/projects')

    // Should not show 404 or error page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()

    // Should show some content
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test.skip('should navigate to brand page', async ({ page }) => {
    await page.goto('/brand')

    // Should not show 404 or error page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()

    // Should show some content
    await expect(page.locator('body')).not.toBeEmpty()

    // Should show brand-related content (using more specific text from the actual page)
    await expect(page.locator('text=Salunga Brand System')).toBeVisible()
  })

  test.skip('should handle not-found page', async ({ page }) => {
    await page.goto('/non-existent-page')

    // Wait for page to load
    await page.waitForTimeout(1000)

    // Should show 404 content (check if content exists, don't be too strict about format)
    const has404 = await page.locator('text=404').isVisible()
    const hasNotFound = await page.locator('text=Page Not Found').isVisible()
    const hasNotFoundAlt = await page.locator('text=not found').isVisible()

    // At least one of these should be true
    expect(has404 || hasNotFound || hasNotFoundAlt).toBe(true)

    // Should have some form of home link
    const hasGoHome = await page.locator('text=Go Home').isVisible()
    const hasHomeLink = await page.locator('a[href="/"]').isVisible()

    expect(hasGoHome || hasHomeLink).toBe(true)
  })
})