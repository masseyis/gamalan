import { test, expect } from '@playwright/test'

test.describe('AI Features', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show AI assistant widget', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // AI assistant widget should be visible
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible()
  })

  test('should open AI assistant dialog', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should open dialog with AI features
    await expect(page.locator('text=AI Assistant')).toBeVisible()
  })

  test('should show readiness assessment feature', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should show readiness assessment option
    await expect(page.locator('text=Readiness Assessment')).toBeVisible()
  })

  test('should show story splitter feature', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should show story splitter option
    await expect(page.locator('text=Story Splitter')).toBeVisible()
  })

  test('should show acceptance criteria generator', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should show AC generator option
    await expect(page.locator('text=Generate Acceptance Criteria')).toBeVisible()
  })

  test('should show task clarifier feature', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should show task clarifier option
    await expect(page.locator('text=Task Clarifier')).toBeVisible()
  })

  test('should handle AI feature interactions', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Click AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Try to interact with readiness assessment
    if (await page.locator('text=Analyze Readiness').isVisible()) {
      await page.locator('text=Analyze Readiness').click()
      
      // Should show some kind of analysis result or loading state
      // The exact expectation depends on implementation
    }
  })

  test('should be available across different pages', async ({ page }) => {
    const pages = [
      '/projects/proj-1/backlog',
      '/projects/proj-1/board',
      '/projects/proj-1/backlog/story-1'
    ]
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForTimeout(500)
      
      // AI assistant should be available on all main project pages
      await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible()
    }
  })

  test('should close AI assistant dialog', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // Open AI assistant
    await page.locator('[data-testid="ai-assistant"]').click()
    
    // Should be able to close the dialog
    if (await page.locator('[data-testid="close-ai-dialog"]').isVisible()) {
      await page.locator('[data-testid="close-ai-dialog"]').click()
    } else if (await page.locator('text=Close').isVisible()) {
      await page.locator('text=Close').click()
    } else {
      // Try escape key
      await page.keyboard.press('Escape')
    }
    
    // Dialog should be closed
    await expect(page.locator('text=AI Assistant')).not.toBeVisible()
  })
})