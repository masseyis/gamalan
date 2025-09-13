import { test, expect } from '@playwright/test'

test.describe('Project Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show project detail page', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    await expect(page.locator('h1:has-text("Battra AI")')).toBeVisible()
    await expect(page.locator('text=Next.js frontend for the AI-enhanced agile project management platform')).toBeVisible()
  })

  test('should show project navigation cards', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    // Wait for data to load
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Backlog')).toBeVisible()
    await expect(page.locator('text=Sprint Board')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
    await expect(page.locator('text=New Story')).toBeVisible()
  })

  test('should navigate to backlog from project detail', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    await page.locator('a[href="/projects/proj-1/backlog"]').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog$/)
  })

  test('should navigate to sprint board from project detail', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    await page.locator('a[href="/projects/proj-1/board"]').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/board$/)
  })

  test('should show story statistics', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('text=Story Status Overview')).toBeVisible()
    await expect(page.locator('text=Backlog')).toBeVisible()
    await expect(page.locator('text=Ready')).toBeVisible()
    await expect(page.locator('text=In Progress')).toBeVisible()
    await expect(page.locator('text=Done')).toBeVisible()
  })

  test('should show recent stories section', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    // Wait for stories to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('text=Recent Stories')).toBeVisible()
    await expect(page.locator('text=User Authentication System')).toBeVisible()
  })

  test('should navigate back to projects list', async ({ page }) => {
    await page.goto('/projects/proj-1')
    
    await page.locator('text=Back to Projects').click()
    
    await expect(page).toHaveURL(/.*\/projects$/)
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
  })
})