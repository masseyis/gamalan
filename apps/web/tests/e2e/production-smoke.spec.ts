import { test, expect } from '@playwright/test'

// Get production URL from environment or use latest deployment
const PRODUCTION_URL = process.env.PLAYWRIGHT_PRODUCTION_URL || 'https://salunga-jir0k5lg9-james-3002s-projects.vercel.app'

test.describe('Production Smoke Tests', () => {
  test('should load the homepage without JavaScript errors', async ({ page }) => {
    // Listen for console errors
    const jsErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    // Listen for page errors
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    // Navigate to production homepage
    const response = await page.goto(PRODUCTION_URL)
    
    // Verify the page loads successfully
    expect(response?.status()).toBe(200)
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle')
    
    // Check if Salunga logo/title is visible
    await expect(page.locator('text=Salunga')).toBeVisible({ timeout: 10000 })
    
    // Log any JavaScript errors found
    if (jsErrors.length > 0) {
      console.log('JavaScript Errors found:', jsErrors)
    }
    
    if (pageErrors.length > 0) {
      console.log('Page Errors found:', pageErrors)
    }
    
    // Fail the test if there are critical JavaScript errors
    const criticalErrors = [...jsErrors, ...pageErrors].filter(error => 
      error.includes('SyntaxError') || 
      error.includes('Unexpected EOF') ||
      error.includes('TypeError')
    )
    
    if (criticalErrors.length > 0) {
      throw new Error(`Critical JavaScript errors found: ${criticalErrors.join(', ')}`)
    }
  })

  test('should navigate to dashboard page', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    // Navigate to dashboard
    const response = await page.goto(`${PRODUCTION_URL}/dashboard`)
    expect(response?.status()).toBe(200)
    
    // Wait for content to load
    await page.waitForLoadState('networkidle')
    
    // Should see dashboard content or loading state
    const dashboardVisible = await page.locator('text=Dashboard').isVisible({ timeout: 10000 })
    const loadingVisible = await page.locator('text=Loading').isVisible({ timeout: 5000 })
    
    expect(dashboardVisible || loadingVisible).toBe(true)
    
    // Check for critical errors
    const criticalErrors = [...jsErrors, ...pageErrors].filter(error => 
      error.includes('SyntaxError') || 
      error.includes('Unexpected EOF') ||
      error.includes('TypeError')
    )
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors on dashboard:', criticalErrors)
      throw new Error(`Critical JavaScript errors on dashboard: ${criticalErrors.join(', ')}`)
    }
  })

  test('should navigate to projects page', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    // Navigate to projects
    const response = await page.goto(`${PRODUCTION_URL}/projects`)
    expect(response?.status()).toBe(200)
    
    // Wait for content to load
    await page.waitForLoadState('networkidle')
    
    // Should see projects content or loading state
    const projectsVisible = await page.locator('text=Projects').isVisible({ timeout: 10000 })
    const loadingVisible = await page.locator('text=Loading').isVisible({ timeout: 5000 })
    
    expect(projectsVisible || loadingVisible).toBe(true)
    
    // Check for critical errors
    const criticalErrors = [...jsErrors, ...pageErrors].filter(error => 
      error.includes('SyntaxError') || 
      error.includes('Unexpected EOF') ||
      error.includes('TypeError')
    )
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors on projects:', criticalErrors)
      throw new Error(`Critical JavaScript errors on projects: ${criticalErrors.join(', ')}`)
    }
  })

  test('should load assistant page without errors', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text())
      }
    })

    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    // Navigate to assistant
    const response = await page.goto(`${PRODUCTION_URL}/assistant`)
    expect(response?.status()).toBe(200)
    
    // Wait for content to load
    await page.waitForLoadState('networkidle')
    
    // Should see assistant content or loading state
    const assistantVisible = await page.locator('text=AI Assistant').isVisible({ timeout: 10000 })
    const loadingVisible = await page.locator('text=Loading').isVisible({ timeout: 5000 })
    
    expect(assistantVisible || loadingVisible).toBe(true)
    
    // Check for critical errors
    const criticalErrors = [...jsErrors, ...pageErrors].filter(error => 
      error.includes('SyntaxError') || 
      error.includes('Unexpected EOF') ||
      error.includes('TypeError')
    )
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors on assistant:', criticalErrors)
      throw new Error(`Critical JavaScript errors on assistant: ${criticalErrors.join(', ')}`)
    }
  })

  test('should check network requests and responses', async ({ page }) => {
    const failedRequests: string[] = []
    
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.url()} - ${response.status()}`)
      }
    })

    // Navigate to homepage
    await page.goto(PRODUCTION_URL)
    await page.waitForLoadState('networkidle')
    
    // Check for navigation elements
    await expect(page.locator('nav')).toBeVisible()
    
    // Log failed requests
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests)
    }
    
    // Only fail for critical resource failures (not API failures which are expected without backend)
    const criticalFailures = failedRequests.filter(req => 
      req.includes('.js') || req.includes('.css') || req.includes('.html')
    )
    
    expect(criticalFailures.length).toBe(0)
  })
})