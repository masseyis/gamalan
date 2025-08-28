import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show dashboard with welcome message', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.locator('h1')).toContainText('Welcome back')
    await expect(page.locator('text=Demo User')).toBeVisible()
  })

  test('should display project statistics', async ({ page }) => {
    await page.goto('/')
    
    // Wait for data to load
    await page.waitForTimeout(1000)
    
    // Check stats cards
    await expect(page.locator('text=Active Projects')).toBeVisible()
    await expect(page.locator('text=Stories In Progress')).toBeVisible()
    await expect(page.locator('text=Stories Completed')).toBeVisible()
  })

  test('should show recent projects section', async ({ page }) => {
    await page.goto('/')
    
    // Wait for projects to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('text=Recent Projects')).toBeVisible()
    
    // Should show at least one project from mock data
    await expect(page.locator('text=Salunga Web Platform')).toBeVisible()
  })

  test('should navigate to projects from quick actions', async ({ page }) => {
    await page.goto('/')
    
    await page.locator('text=Browse Projects').first().click()
    
    await expect(page).toHaveURL(/.*\/projects$/)
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
  })

  test('should navigate to new project from dashboard', async ({ page }) => {
    await page.goto('/')
    
    await page.locator('text=New Project').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/new$/)
  })
})