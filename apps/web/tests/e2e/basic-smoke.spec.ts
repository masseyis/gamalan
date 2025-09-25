import { test, expect } from '@playwright/test'
import { setupMockAuth } from '@/lib/auth/test-utils'

test.describe('Basic Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock authentication for testing
    await setupMockAuth(page)
  })

  test('should load homepage without errors', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    // Capture console errors BEFORE navigating
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
      console.error('Page error:', err.message, err.stack)
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Debug: Check environment variables in the browser
    const envCheck = await page.evaluate(() => {
      return {
        NEXT_PUBLIC_ENABLE_MOCK_AUTH: process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH,
        NODE_ENV: process.env.NODE_ENV,
        mockAuthFlag: (window as any).__MOCK_AUTH__,
        testUser: (window as any).__TEST_USER__,
        mockClerkHooks: (window as any).__MOCK_CLERK_HOOKS__
      }
    })
    console.log('Environment variables in browser:', envCheck)

    // Check console messages to see which providers are being used
    const consoleLogs = await page.evaluate(() => {
      return (window as any).testConsoleLogs || []
    })
    console.log('Console logs:', consoleLogs)

    // Log any errors we captured
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors)
    }
    if (pageErrors.length > 0) {
      console.log('Page errors:', pageErrors)
    }

    // Check if we have the error page instead of expected content
    const hasError = await page.locator('text=Application error').isVisible()
    if (hasError) {
      console.log('Application error page detected')
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-error-page.png' })

      // Fail the test with more info about the errors
      const errorMessage = `Application error detected. Env vars: ${JSON.stringify(envCheck)}, Console errors: ${JSON.stringify(consoleErrors)}, Page errors: ${JSON.stringify(pageErrors)}`
      throw new Error(errorMessage)
    }

    // Should not show 404 or error page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()

    // Should show some content - look for specific homepage content
    await expect(page.locator('h1:has-text("Welcome to")')).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to projects page', async ({ page }) => {
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Allow for API loading

    // Should not show 404 or error page
    await expect(page.locator('text=404')).not.toBeVisible()
    await expect(page.locator('text=Page not found')).not.toBeVisible()

    // Should show projects page content
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible({ timeout: 10000 })
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