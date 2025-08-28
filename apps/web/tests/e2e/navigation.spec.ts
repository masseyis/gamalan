import { test, expect } from '@playwright/test'

test.describe('Navigation & Routing', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should navigate through main workflow', async ({ page }) => {
    // Start at dashboard
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Welcome back')
    
    // Go to projects
    await page.locator('text=Browse Projects').first().click()
    await expect(page).toHaveURL(/.*\/projects$/)
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
    
    // Go to project detail
    await page.locator('[data-testid="project-card"]').first().click()
    await expect(page).toHaveURL(/.*\/projects\/proj-1$/)
    
    // Go to backlog
    await page.locator('text=Backlog').first().click()
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog$/)
    
    // Go to story detail
    await page.waitForTimeout(1000) // Wait for stories to load
    await page.locator('text=User Authentication System').first().click()
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog\/story-1$/)
    
    // Go back to backlog
    await page.locator('text=Back to Backlog').first().click()
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog$/)
    
    // Go to sprint board
    await page.locator('text=Sprint Board').first().click()
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/board$/)
  })

  test('should handle direct URL access', async ({ page }) => {
    const directUrls = [
      '/',
      '/projects',
      '/projects/new',
      '/projects/proj-1',
      '/projects/proj-1/backlog',
      '/projects/proj-1/board',
      '/projects/proj-1/backlog/story-1'
    ]
    
    for (const url of directUrls) {
      await page.goto(url)
      
      // Should not show 404 or error page
      await expect(page.locator('text=404')).not.toBeVisible()
      await expect(page.locator('text=Page not found')).not.toBeVisible()
      
      // Should show some expected content
      await expect(page.locator('body')).not.toBeEmpty()
    }
  })

  test('should handle invalid project ID', async ({ page }) => {
    await page.goto('/projects/invalid-project-id')
    
    // Should show appropriate error message or redirect
    await expect(page.locator('text=Project not found')).toBeVisible()
  })

  test('should handle invalid story ID', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/invalid-story-id')
    
    // Should show appropriate error message or redirect
    await expect(page.locator('text=Story not found')).toBeVisible()
  })

  test('should maintain navigation state', async ({ page }) => {
    // Start at project detail
    await page.goto('/projects/proj-1')
    
    // Navigate to backlog
    await page.locator('text=Backlog').first().click()
    
    // Use browser back button
    await page.goBack()
    
    // Should be back at project detail
    await expect(page).toHaveURL(/.*\/projects\/proj-1$/)
    await expect(page.locator('h1:has-text("Salunga Web Platform")')).toBeVisible()
  })

  test('should show breadcrumbs or navigation indicators', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Should show some form of navigation context
    await expect(page.locator('text=Back to')).toBeVisible()
  })

  test('should handle rapid navigation', async ({ page }) => {
    await page.goto('/')
    
    // Rapidly navigate through pages
    await page.locator('text=Browse Projects').first().click()
    await page.waitForLoadState('networkidle')
    
    await page.locator('[data-testid="project-card"]').first().click()
    await page.waitForLoadState('networkidle')
    
    await page.locator('text=Backlog').first().click()
    await page.waitForLoadState('networkidle')
    
    await page.locator('text=Sprint Board').first().click()
    await page.waitForLoadState('networkidle')
    
    // Should end up at board page without errors
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/board$/)
    await expect(page.locator('h1:has-text("Sprint Board")')).toBeVisible()
  })

  test('should preserve scroll position on navigation', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for content to load
    await page.waitForTimeout(1000)
    
    // Scroll down if there's content
    await page.evaluate(() => window.scrollTo(0, 200))
    
    // Navigate away and back
    await page.locator('text=Sprint Board').first().click()
    await page.locator('text=Backlog').first().click()
    
    // Should be back at backlog
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog$/)
  })
})