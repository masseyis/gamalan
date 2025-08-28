import { test, expect } from '@playwright/test'

test.describe('Backlog Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show backlog page with stories', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('h1:has-text("Backlog")')).toBeVisible()
    await expect(page.locator('text=User Authentication System')).toBeVisible()
    await expect(page.locator('text=Project Dashboard')).toBeVisible()
    await expect(page.locator('text=Drag-and-Drop Sprint Board')).toBeVisible()
  })

  test('should show story cards with proper information', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    // Check first story card details
    const storyCard = page.locator('[data-testid="story-card"]').first()
    await expect(storyCard).toBeVisible()
    
    // Should show story points
    await expect(page.locator('text=8 pts')).toBeVisible()
    
    // Should show priority badges
    await expect(page.locator('text=high')).toBeVisible()
  })

  test('should navigate to story detail', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    // Click on first story
    await page.locator('text=User Authentication System').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog\/story-1$/)
  })

  test('should navigate to new story form', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    await page.locator('text=New Story').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog\/new$/)
    await expect(page.locator('h1:has-text("Create New Story")')).toBeVisible()
  })

  test('should show AI assistant widget', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for component to load
    await page.waitForTimeout(500)
    
    // AI assistant should be visible
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible()
  })

  test('should filter stories by status', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    // Check that different status stories are present
    await expect(page.locator('text=ready')).toBeVisible()
    await expect(page.locator('text=in-progress')).toBeVisible()
    await expect(page.locator('text=done')).toBeVisible()
  })

  test('should navigate back to project', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog')
    
    await page.locator('text=Back to Project').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1$/)
  })
})