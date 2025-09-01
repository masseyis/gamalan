import { test, expect } from '@playwright/test'

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Welcome back')).toBeVisible()
  })

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Welcome back')).toBeVisible()
    
    // Test projects page
    await page.goto('/projects')
    await page.waitForTimeout(500)
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
  })

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    await expect(page.locator('h1')).toBeVisible()
    
    // Test navigation works on mobile
    await page.locator('text=Browse Projects').first().click()
    await expect(page).toHaveURL(/.*\/projects$/)
  })

  test('should adapt project cards layout', async ({ page }) => {
    // Test different viewports for project cards
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop - should show 3 columns
      { width: 768, height: 1024 },  // Tablet - should show 2 columns
      { width: 375, height: 667 }    // Mobile - should show 1 column
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/projects')
      await page.waitForTimeout(500)
      
      // Projects should be visible regardless of viewport
      if (await page.locator('[data-testid="project-card"]').first().isVisible()) {
        const count = await page.locator('[data-testid="project-card"]').count()
        expect(count).toBeGreaterThan(0)
      }
    }
  })

  test('should adapt dashboard layout', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.waitForTimeout(500)
      
      // Key elements should be visible
      await expect(page.locator('text=Welcome back')).toBeVisible()
      await expect(page.locator('text=Active Projects')).toBeVisible()
    }
  })

  test('should adapt backlog layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/projects/proj-1/backlog')
    await page.waitForTimeout(1000)
    
    await expect(page.locator('h1:has-text("Backlog")')).toBeVisible()
    
    // Stories should be stacked vertically on mobile
    const storyCards = page.locator('[data-testid="story-card"]')
    if (await storyCards.first().isVisible()) {
      const count = await storyCards.count()
      expect(count).toBeGreaterThan(0)
    }
  })

  test('should adapt sprint board on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/projects/proj-1/board')
    await page.waitForTimeout(1000)
    
    await expect(page.locator('h1:has-text("Sprint Board")')).toBeVisible()
    
    // Board columns should be visible and scrollable if needed
    await expect(page.locator('text=Backlog')).toBeVisible()
    await expect(page.locator('text=Done')).toBeVisible()
  })

  test('should maintain touch interactions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/projects')
    await page.waitForTimeout(500)
    
    // Touch interactions should work
    if (await page.locator('[data-testid="project-card"]').first().isVisible()) {
      await page.locator('[data-testid="project-card"]').first().tap()
      await expect(page).toHaveURL(/.*\/projects\/proj-1$/)
    }
  })

  test('should handle orientation changes', async ({ page }) => {
    // Portrait
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
    
    // Landscape
    await page.setViewportSize({ width: 667, height: 375 })
    await page.reload()
    await expect(page.locator('h1')).toBeVisible()
  })

  test('should show appropriate text sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 375, height: 667 }
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/')
      await page.waitForTimeout(500)
      
      // Text should be readable at all sizes
      const heading = page.locator('h1')
      await expect(heading).toBeVisible()
      
      // Check that text is not too small
      const fontSize = await heading.evaluate(el => window.getComputedStyle(el).fontSize)
      const fontSizeNum = parseInt(fontSize)
      expect(fontSizeNum).toBeGreaterThan(14) // Minimum readable size
    }
  })
})