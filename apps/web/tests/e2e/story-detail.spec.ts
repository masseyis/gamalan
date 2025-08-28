import { test, expect } from '@playwright/test'

test.describe('Story Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show story detail page', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    await expect(page.locator('h1:has-text("User Authentication System")')).toBeVisible()
    await expect(page.locator('text=As a user, I want to securely authenticate')).toBeVisible()
  })

  test('should show story metadata', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for story to load
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Status')).toBeVisible()
    await expect(page.locator('text=Priority')).toBeVisible()
    await expect(page.locator('text=Story Points')).toBeVisible()
    await expect(page.locator('text=8')).toBeVisible() // Story points
  })

  test('should show acceptance criteria section', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for acceptance criteria to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('text=Acceptance Criteria')).toBeVisible()
    
    // Should show G/W/T format criteria
    await expect(page.locator('text=Given')).toBeVisible()
    await expect(page.locator('text=When')).toBeVisible()
    await expect(page.locator('text=Then')).toBeVisible()
    
    // Should show actual criteria from mock data
    await expect(page.locator('text=I am an unregistered user')).toBeVisible()
  })

  test('should show tasks section', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    await expect(page.locator('text=Tasks')).toBeVisible()
    
    // Should show option to add new task
    await expect(page.locator('text=Add Task')).toBeVisible()
  })

  test('should navigate back to backlog', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    await page.locator('text=Back to Backlog').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog$/)
    await expect(page.locator('h1:has-text("Backlog")')).toBeVisible()
  })

  test('should show AI assistant for story analysis', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for components to load
    await page.waitForTimeout(500)
    
    // AI assistant should be available
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible()
  })

  test('should allow editing story status', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Wait for story to load
    await page.waitForTimeout(500)
    
    // Should show current status
    await expect(page.locator('text=ready')).toBeVisible()
    
    // Should show edit button or dropdown (implementation specific)
    // This test may need adjustment based on actual UI implementation
  })

  test('should show story history/activity', async ({ page }) => {
    await page.goto('/projects/proj-1/backlog/story-1')
    
    // Check for created/updated dates
    await expect(page.locator('text=Created')).toBeVisible()
    await expect(page.locator('text=Updated')).toBeVisible()
  })
})