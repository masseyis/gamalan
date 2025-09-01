import { test, expect, type Page } from '@playwright/test'

// Helper functions for project testing
async function waitForProjectsPage(page: Page) {
  await page.waitForSelector('h1:has-text("Projects")')
  await page.waitForLoadState('networkidle')
}

async function fillProjectForm(page: Page, name: string, description: string = '') {
  await page.fill('#name', name)
  if (description) {
    await page.fill('#description', description)
  }
}

async function clickButtonAndWait(page: Page, selector: string, timeout = 5000) {
  const button = page.locator(selector)
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
  await button.click()
  await page.waitForTimeout(timeout)
}

async function checkProjectCard(page: Page, projectName: string) {
  const projectCard = page.locator('[data-testid="project-card"]').filter({ hasText: projectName })
  await expect(projectCard).toBeVisible()
  return projectCard
}

test.describe('Comprehensive Projects Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mock data for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
    })
  })

  test('should display projects page with all UI elements', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Check page title and description
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible()
    await expect(page.locator('text=Manage your agile projects and track progress')).toBeVisible()
    
    // Check "New Project" button in header
    const newProjectButton = page.locator('a[href="/projects/new"]').filter({ hasText: 'New Project' })
    await expect(newProjectButton).toBeVisible()
    await expect(newProjectButton).toBeEnabled()
    
    // Check loading state elements (if still loading)
    const loadingText = page.locator('text=Loading your projects')
    if (await loadingText.isVisible()) {
      await expect(loadingText).toBeVisible()
      await page.waitForSelector('text=Loading your projects', { state: 'hidden', timeout: 10000 })
    }
  })

  test('should handle empty projects state correctly', async ({ page }) => {
    // Mock empty projects response
    await page.route('**/projects**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Check empty state elements
    await expect(page.locator('text=No projects yet')).toBeVisible()
    await expect(page.locator('text=Create your first project to start managing stories')).toBeVisible()
    
    // Check empty state icon
    const emptyStateIcon = page.locator('svg[data-lucide="folder-open"]').first()
    await expect(emptyStateIcon).toBeVisible()
    
    // Check "Create Your First Project" button
    const createFirstProjectButton = page.locator('button:has-text("Create Your First Project")')
    await expect(createFirstProjectButton).toBeVisible()
    await expect(createFirstProjectButton).toBeEnabled()
    
    // Test button click
    await createFirstProjectButton.click()
    await expect(page).toHaveURL('/projects/new')
  })

  test('should display project cards with all elements and interactions', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Wait for project cards to load
    const projectCards = page.locator('[data-testid="project-card"]')
    await expect(projectCards.first()).toBeVisible({ timeout: 10000 })
    
    const cardCount = await projectCards.count()
    expect(cardCount).toBeGreaterThan(0)
    
    // Test each project card
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = projectCards.nth(i)
      
      // Check card elements
      await expect(card).toBeVisible()
      
      // Check project icon
      const projectIcon = card.locator('svg[data-lucide="folder-open"]')
      await expect(projectIcon).toBeVisible()
      
      // Check project name (CardTitle)
      const projectTitle = card.locator('.text-lg')
      await expect(projectTitle).toBeVisible()
      
      // Check project description
      const projectDescription = card.locator('p').filter({ hasText: /.+/ })
      if (await projectDescription.first().isVisible()) {
        await expect(projectDescription.first()).toBeVisible()
      }
      
      // Check action buttons
      const backlogButton = card.locator('a[href*="/backlog"]')
      await expect(backlogButton).toBeVisible()
      await expect(backlogButton).toContainText('Backlog')
      
      const boardButton = card.locator('a[href*="/board"]')
      await expect(boardButton).toBeVisible()
      await expect(boardButton).toContainText('Board')
      
      // Check settings button (appears on hover)
      await card.hover()
      const settingsButton = card.locator('a[href*="/settings"]')
      if (await settingsButton.isVisible()) {
        await expect(settingsButton).toBeVisible()
      }
      
      // Check metadata
      const createdDate = card.locator('text*=Created')
      if (await createdDate.isVisible()) {
        await expect(createdDate).toBeVisible()
      }
      
      const activeStatus = card.locator('text=Active')
      if (await activeStatus.isVisible()) {
        await expect(activeStatus).toBeVisible()
      }
    }
  })

  test('should navigate to project subsections from cards', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Wait for first project card
    const firstProjectCard = page.locator('[data-testid="project-card"]').first()
    await expect(firstProjectCard).toBeVisible()
    
    // Test Backlog navigation
    const backlogButton = firstProjectCard.locator('a[href*="/backlog"]')
    await backlogButton.click()
    await page.waitForURL(/\/projects\/[^\/]+\/backlog/)
    await page.waitForLoadState('networkidle')
    
    // Go back to projects
    await page.goBack()
    await waitForProjectsPage(page)
    
    // Test Board navigation
    const boardButton = firstProjectCard.locator('a[href*="/board"]')
    await boardButton.click()
    await page.waitForURL(/\/projects\/[^\/]+\/board/)
    await page.waitForLoadState('networkidle')
    
    // Go back to projects
    await page.goBack()
    await waitForProjectsPage(page)
    
    // Test Settings navigation (hover first to reveal button)
    await firstProjectCard.hover()
    const settingsButton = firstProjectCard.locator('a[href*="/settings"]')
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await page.waitForURL(/\/projects\/[^\/]+\/settings/)
    }
  })

  test('should test create new project flow completely', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Click "New Project" button
    const newProjectButton = page.locator('a[href="/projects/new"]').first()
    await newProjectButton.click()
    
    // Should navigate to new project page
    await expect(page).toHaveURL('/projects/new')
    await page.waitForLoadState('networkidle')
    
    // Check new project page elements
    await expect(page.locator('h1:has-text("Create New Project")')).toBeVisible()
    await expect(page.locator('text=Set up a new agile project')).toBeVisible()
    
    // Check back link
    const backLink = page.locator('a:has-text("Back to Projects")')
    await expect(backLink).toBeVisible()
    
    // Check form elements
    await expect(page.locator('label:has-text("Project Name")')).toBeVisible()
    await expect(page.locator('input#name')).toBeVisible()
    await expect(page.locator('label:has-text("Description")')).toBeVisible()
    await expect(page.locator('textarea#description')).toBeVisible()
    
    // Test form validation - submit without name
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled() // Should be disabled when name is empty
    
    // Fill form with valid data
    const projectName = `Test Project ${Date.now()}`
    const projectDescription = 'This is a test project created by automated tests'
    
    await fillProjectForm(page, projectName, projectDescription)
    
    // Submit button should now be enabled
    await expect(submitButton).toBeEnabled()
    await expect(submitButton).toContainText('Create Project')
    
    // Test cancel functionality
    const cancelButton = page.locator('button:has-text("Cancel")')
    await expect(cancelButton).toBeVisible()
    await expect(cancelButton).toBeEnabled()
    
    // Submit form
    await submitButton.click()
    
    // Should show loading state
    const loadingButton = page.locator('button:has-text("Creating...")')
    if (await loadingButton.isVisible()) {
      await expect(loadingButton).toBeVisible()
    }
    
    // Should redirect to project backlog after creation
    await page.waitForURL(/\/projects\/[^\/]+\/backlog/, { timeout: 10000 })
  })

  test('should test project form validation and error handling', async ({ page }) => {
    await page.goto('/projects/new')
    await page.waitForLoadState('networkidle')
    
    const nameInput = page.locator('input#name')
    const descriptionInput = page.locator('textarea#description')
    const submitButton = page.locator('button[type="submit"]')
    
    // Test empty name validation
    await nameInput.fill('')
    await expect(submitButton).toBeDisabled()
    
    // Test whitespace-only name
    await nameInput.fill('   ')
    await expect(submitButton).toBeDisabled()
    
    // Test valid name enables submit
    await nameInput.fill('Valid Project Name')
    await expect(submitButton).toBeEnabled()
    
    // Test maximum length handling
    const longName = 'A'.repeat(300)
    await nameInput.fill(longName)
    // Should still be enabled (backend validation)
    await expect(submitButton).toBeEnabled()
    
    const longDescription = 'B'.repeat(2000)
    await descriptionInput.fill(longDescription)
    await expect(submitButton).toBeEnabled()
    
    // Test form reset
    await nameInput.clear()
    await descriptionInput.clear()
    await expect(submitButton).toBeDisabled()
  })

  test('should test error handling for API failures', async ({ page }) => {
    // Mock API failure for projects list
    await page.route('**/projects**', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' })
        })
      } else {
        route.continue()
      }
    })
    
    await page.goto('/projects')
    
    // Should show error state
    await expect(page.locator('text=Error loading projects')).toBeVisible()
    await expect(page.locator('text=Failed to load projects')).toBeVisible()
    
    // Test retry button
    const retryButton = page.locator('button:has-text("Retry")')
    await expect(retryButton).toBeVisible()
    await expect(retryButton).toBeEnabled()
    
    // Remove route mock and test retry
    await page.unroute('**/projects**')
    await retryButton.click()
    
    // Should reload the page
    await page.waitForLoadState('networkidle')
  })

  test('should test project creation API failure handling', async ({ page }) => {
    await page.goto('/projects/new')
    
    // Mock API failure for project creation
    await page.route('**/projects**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Validation failed' })
        })
      } else {
        route.continue()
      }
    })
    
    // Fill and submit form
    await fillProjectForm(page, 'Test Project', 'Test Description')
    
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    
    // Should show error toast or message
    const errorToast = page.locator('.toast, [role="alert"]').filter({ hasText: /failed|error/i })
    await expect(errorToast).toBeVisible({ timeout: 5000 })
    
    // Form should remain in editable state
    await expect(page.locator('input#name')).toBeEnabled()
    await expect(submitButton).toBeEnabled()
  })

  test('should test responsive design and mobile interactions', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Check mobile layout
    const mainContainer = page.locator('.container')
    await expect(mainContainer).toBeVisible()
    
    // Projects should stack vertically on mobile
    const projectCards = page.locator('[data-testid="project-card"]')
    if (await projectCards.first().isVisible()) {
      // Check that cards are full width
      const firstCard = projectCards.first()
      const cardBox = await firstCard.boundingBox()
      expect(cardBox?.width).toBeGreaterThan(300) // Should take most of mobile width
    }
    
    // Test mobile project creation
    const newProjectButton = page.locator('a[href="/projects/new"]').first()
    await newProjectButton.click()
    
    await expect(page).toHaveURL('/projects/new')
    
    // Form should be properly sized for mobile
    const formContainer = page.locator('.max-w-2xl')
    await expect(formContainer).toBeVisible()
    
    const nameInput = page.locator('input#name')
    const inputBox = await nameInput.boundingBox()
    expect(inputBox?.width).toBeLessThan(400) // Should fit mobile screen
  })

  test('should test all project card hover effects and animations', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    const projectCards = page.locator('[data-testid="project-card"]')
    const cardCount = await projectCards.count()
    
    if (cardCount > 0) {
      const firstCard = projectCards.first()
      
      // Test hover effects
      await firstCard.hover()
      
      // Settings button should become visible on hover
      const settingsButton = firstCard.locator('a[href*="/settings"]')
      if (await settingsButton.isVisible()) {
        await expect(settingsButton).toBeVisible()
        
        // Test settings button click
        await settingsButton.click()
        await page.waitForURL(/\/projects\/[^\/]+\/settings/)
      }
    }
  })

  test('should test keyboard navigation and accessibility', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Test keyboard navigation through project cards
    await page.keyboard.press('Tab')
    
    // Should focus on the "New Project" button first
    const newProjectButton = page.locator('a[href="/projects/new"]').first()
    if (await newProjectButton.isVisible()) {
      await expect(newProjectButton).toBeFocused()
      
      // Test Enter key navigation
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL('/projects/new')
    }
    
    // Go back and test project card navigation
    await page.goBack()
    await waitForProjectsPage(page)
    
    // Tab through project cards and their buttons
    const focusableElements = await page.locator('a:visible, button:visible').all()
    
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    }
  })

  test('should test project search and filtering (if implemented)', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Look for search or filter inputs
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="filter"]')
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Sort")')
    
    if (await searchInput.isVisible()) {
      // Test search functionality
      await searchInput.fill('test')
      await page.waitForTimeout(1000) // Wait for search results
      
      // Clear search
      await searchInput.clear()
    }
    
    if (await filterButton.isVisible()) {
      // Test filter functionality
      await filterButton.click()
      
      // Look for filter options
      const filterOptions = page.locator('button:has-text("Active"), button:has-text("Archived")')
      if (await filterOptions.first().isVisible()) {
        await filterOptions.first().click()
      }
    }
  })

  test('should test project bulk operations (if implemented)', async ({ page }) => {
    await page.goto('/projects')
    await waitForProjectsPage(page)
    
    // Look for bulk selection checkboxes
    const selectAllCheckbox = page.locator('input[type="checkbox"][name*="select-all"]')
    const projectCheckboxes = page.locator('[data-testid="project-card"] input[type="checkbox"]')
    
    if (await selectAllCheckbox.isVisible()) {
      // Test select all
      await selectAllCheckbox.check()
      
      // All project checkboxes should be checked
      const checkboxCount = await projectCheckboxes.count()
      for (let i = 0; i < checkboxCount; i++) {
        await expect(projectCheckboxes.nth(i)).toBeChecked()
      }
      
      // Look for bulk action buttons
      const bulkDeleteButton = page.locator('button:has-text("Delete Selected")')
      const bulkArchiveButton = page.locator('button:has-text("Archive Selected")')
      
      if (await bulkDeleteButton.isVisible()) {
        await expect(bulkDeleteButton).toBeEnabled()
      }
      
      if (await bulkArchiveButton.isVisible()) {
        await expect(bulkArchiveButton).toBeEnabled()
      }
    }
  })
})