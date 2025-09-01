import { test, expect, type Page } from '@playwright/test'

// Helper function to check if element is visible and clickable
async function checkInteractiveElement(page: Page, selector: string, expectedText?: string) {
  const element = page.locator(selector)
  await expect(element).toBeVisible()
  await expect(element).toBeEnabled()
  if (expectedText) {
    await expect(element).toContainText(expectedText)
  }
  return element
}

// Helper to wait for page load and check navigation state
async function waitForPageLoad(page: Page, expectedUrl: string, expectedTitle?: string) {
  await page.waitForURL(expectedUrl)
  await page.waitForLoadState('networkidle')
  if (expectedTitle) {
    await expect(page).toHaveTitle(new RegExp(expectedTitle))
  }
}

test.describe('Comprehensive Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mock mode for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
    })
  })

  test('should navigate through all main navigation links', async ({ page }) => {
    await page.goto('/')
    
    // Should redirect to assistant (default landing page)
    await waitForPageLoad(page, '/assistant', 'Salunga')
    
    // Test logo navigation
    const logo = await checkInteractiveElement(page, 'nav a[href="/assistant"]', 'Salunga')
    await logo.click()
    await waitForPageLoad(page, '/assistant')
    
    // Test main navigation items
    const navigationItems = [
      { text: 'Assistant', href: '/assistant', testId: 'assistant-nav' },
      { text: 'Projects', href: '/projects', testId: 'projects-nav' },
      { text: 'Dashboard', href: '/dashboard', testId: 'dashboard-nav' }
    ]
    
    for (const item of navigationItems) {
      const navLink = page.locator('nav').locator(`text=${item.text}`)
      await expect(navLink).toBeVisible()
      await navLink.click()
      await waitForPageLoad(page, item.href)
      
      // Verify active state
      const activeNavItem = page.locator('nav').locator(`text=${item.text}`).locator('..')
      await expect(activeNavItem).toHaveClass(/bg-primary|default/)
    }
  })

  test('should test all header buttons and interactions', async ({ page }) => {
    await page.goto('/assistant')
    
    // Test "Ask AI" button (Command+K shortcut button)
    const askAiButton = page.locator('button:has-text("Ask AI")')
    await expect(askAiButton).toBeVisible()
    await askAiButton.click()
    
    // Should focus textarea
    const textarea = page.locator('textarea')
    await expect(textarea).toBeFocused()
    
    // Test notifications bell button
    const notificationButton = page.locator('button').filter({ has: page.locator('svg[data-lucide="bell"]') })
    await expect(notificationButton).toBeVisible()
    await expect(notificationButton).toBeEnabled()
    // Note: Clicking notification would typically open a dropdown (not implemented in current version)
    
    // Test "New" button (quick create)
    const newButton = page.locator('button:has-text("New")')
    await expect(newButton).toBeVisible()
    await expect(newButton).toBeEnabled()
    // Note: This would typically open a creation modal (not implemented in current version)
    
    // Test user avatar area
    const userAvatar = page.locator('[role="img"]').filter({ hasText: /[A-Z]{2}/ }).first()
    await expect(userAvatar).toBeVisible()
    
    // Check user info display
    const userInfo = page.locator('text=Demo User')
    await expect(userInfo).toBeVisible()
    
    const demoModeText = page.locator('text=Demo Mode')
    await expect(demoModeText).toBeVisible()
  })

  test('should navigate to all project-related pages', async ({ page }) => {
    await page.goto('/projects')
    await waitForPageLoad(page, '/projects')
    
    // Create new project button
    const createProjectButton = page.locator('button:has-text("Create Project"), a:has-text("Create Project")')
    if (await createProjectButton.isVisible()) {
      await createProjectButton.click()
      await waitForPageLoad(page, '/projects/new')
      
      // Go back to projects list
      await page.goto('/projects')
    }
    
    // Test project cards and their links
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href*="/projects/"]')
    const projectCount = await projectCards.count()
    
    if (projectCount > 0) {
      // Click on first project
      const firstProject = projectCards.first()
      await firstProject.click()
      
      // Should navigate to project overview
      await page.waitForURL(/\/projects\/[^\/]+$/)
      
      // Test project navigation tabs/links
      const projectNavItems = [
        'Overview', 'Backlog', 'Board', 'Settings'
      ]
      
      for (const navItem of projectNavItems) {
        const navLink = page.locator(`text=${navItem}`).first()
        if (await navLink.isVisible()) {
          await navLink.click()
          await page.waitForLoadState('networkidle')
          // Verify we're on the right page
          const currentUrl = page.url()
          expect(currentUrl).toContain(navItem.toLowerCase())
        }
      }
    }
  })

  test('should test keyboard shortcuts and accessibility', async ({ page }) => {
    await page.goto('/assistant')
    
    // Test Cmd+K shortcut to focus assistant
    await page.keyboard.press('Meta+k')
    const textarea = page.locator('textarea')
    await expect(textarea).toBeFocused()
    
    // Test Tab navigation through interactive elements
    await page.keyboard.press('Escape') // Clear focus
    await page.keyboard.press('Tab') // First tab should go to logo
    
    // Test Enter key on focused elements
    await textarea.focus()
    await textarea.fill('test navigation')
    await page.keyboard.press('Enter')
    
    // Should trigger processing
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible({ timeout: 10000 })
  })

  test('should navigate through all route paths and handle errors', async ({ page }) => {
    const routes = [
      { path: '/', expectedRedirect: '/assistant' },
      { path: '/assistant', expectedUrl: '/assistant' },
      { path: '/projects', expectedUrl: '/projects' },
      { path: '/dashboard', expectedUrl: '/dashboard' },
      { path: '/projects/new', expectedUrl: '/projects/new' },
      { path: '/sign-in', expectedUrl: '/sign-in' },
      { path: '/sign-up', expectedUrl: '/sign-up' }
    ]
    
    for (const route of routes) {
      await page.goto(route.path)
      
      const finalUrl = route.expectedRedirect || route.expectedUrl
      if (finalUrl) {
        await waitForPageLoad(page, finalUrl)
      }
      
      // Check that page loaded without errors
      const errorMessages = page.locator('text=/error|Error|ERROR/')
      const errorCount = await errorMessages.count()
      
      // Log if there are error messages (but don't fail the test for expected errors)
      if (errorCount > 0) {
        console.log(`Found ${errorCount} error messages on ${route.path}`)
      }
      
      // Check for basic page structure
      const body = page.locator('body')
      await expect(body).toBeVisible()
    }
  })

  test('should handle 404 and invalid routes gracefully', async ({ page }) => {
    const invalidRoutes = [
      '/nonexistent-page',
      '/projects/invalid-project-id',
      '/projects/123/invalid-section'
    ]
    
    for (const route of invalidRoutes) {
      await page.goto(route)
      
      // Should either redirect or show 404 page
      await page.waitForLoadState('networkidle')
      
      // Check that navigation still works
      const logo = page.locator('nav a[href="/assistant"]')
      if (await logo.isVisible()) {
        await logo.click()
        await waitForPageLoad(page, '/assistant')
      }
    }
  })

  test('should test responsive navigation on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/assistant')
    
    // Check if mobile navigation elements are present
    const navigation = page.locator('nav')
    await expect(navigation).toBeVisible()
    
    // Test that navigation items adapt to mobile
    const assistantNavItem = page.locator('nav').locator('text=Assistant')
    await expect(assistantNavItem).toBeVisible()
    
    // Test mobile-specific elements (if any hamburger menus, etc.)
    // Note: Current design appears to use same nav on mobile, but check responsiveness
    
    // Test that buttons are appropriately sized for mobile
    const newButton = page.locator('button:has-text("New")')
    if (await newButton.isVisible()) {
      const boundingBox = await newButton.boundingBox()
      expect(boundingBox?.height).toBeGreaterThan(40) // Minimum touch target
    }
  })

  test('should verify all external and internal link behaviors', async ({ page }) => {
    await page.goto('/assistant')
    
    // Get all links on the page
    const allLinks = page.locator('a')
    const linkCount = await allLinks.count()
    
    for (let i = 0; i < Math.min(linkCount, 10); i++) { // Test first 10 links to avoid excessive test time
      const link = allLinks.nth(i)
      const href = await link.getAttribute('href')
      
      if (href && href.startsWith('/')) {
        // Internal link - test navigation
        await link.click()
        await page.waitForLoadState('networkidle')
        
        // Go back to test page
        await page.goBack()
        await page.waitForLoadState('networkidle')
      } else if (href && (href.startsWith('http') || href.startsWith('mailto'))) {
        // External link - verify it opens correctly (but don't actually navigate)
        const target = await link.getAttribute('target')
        const rel = await link.getAttribute('rel')
        
        // External links should open in new tab and have security attributes
        if (href.startsWith('http')) {
          expect(target).toBe('_blank')
          expect(rel).toContain('noopener')
        }
      }
    }
  })
})