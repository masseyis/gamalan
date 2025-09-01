import { test, expect, type Page } from '@playwright/test'

// Mobile device configurations for testing
const mobileDevices = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'Samsung Galaxy S21', width: 384, height: 854 },
  { name: 'iPad Mini', width: 768, height: 1024 },
]

// Helper functions for mobile testing
async function setMobileViewport(page: Page, device: typeof mobileDevices[0]) {
  await page.setViewportSize({ width: device.width, height: device.height })
}

async function checkElementTouchTarget(page: Page, selector: string, minSize = 44) {
  const element = page.locator(selector).first()
  if (await element.isVisible()) {
    const box = await element.boundingBox()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(minSize)
      expect(box.height).toBeGreaterThanOrEqual(minSize)
    }
  }
}

async function checkTextReadability(page: Page, selector: string, minSize = 16) {
  const element = page.locator(selector)
  if (await element.isVisible()) {
    const fontSize = await element.evaluate((el) => {
      return window.getComputedStyle(el).fontSize
    })
    const sizeValue = parseInt(fontSize.replace('px', ''))
    expect(sizeValue).toBeGreaterThanOrEqual(minSize)
  }
}

async function testScrollability(page: Page, selector: string) {
  const element = page.locator(selector)
  if (await element.isVisible()) {
    const scrollHeight = await element.evaluate((el) => el.scrollHeight)
    const clientHeight = await element.evaluate((el) => el.clientHeight)
    
    if (scrollHeight > clientHeight) {
      // Element is scrollable, test scrolling
      await element.hover()
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(500)
    }
  }
}

test.describe('Comprehensive Mobile Responsiveness Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
    })
  })

  test('should test all pages on different mobile devices', async ({ page }) => {
    const pages = [
      { path: '/assistant', name: 'Assistant' },
      { path: '/projects', name: 'Projects' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/projects/new', name: 'New Project' },
      { path: '/sign-in', name: 'Sign In' },
      { path: '/sign-up', name: 'Sign Up' }
    ]
    
    for (const device of mobileDevices.slice(0, 2)) { // Test on 2 devices to save time
      for (const pageInfo of pages) {
        await setMobileViewport(page, device)
        await page.goto(pageInfo.path)
        await page.waitForLoadState('networkidle')
        
        // Check basic responsiveness
        const body = page.locator('body')
        await expect(body).toBeVisible()
        
        // Check no horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
        expect(bodyWidth).toBeLessThanOrEqual(device.width + 50) // Allow some tolerance
        
        // Check navigation is visible and functional
        const nav = page.locator('nav')
        if (await nav.isVisible()) {
          await expect(nav).toBeVisible()
          const navBox = await nav.boundingBox()
          if (navBox) {
            expect(navBox.width).toBeLessThanOrEqual(device.width)
          }
        }
      }
    }
  })

  test('should test mobile navigation and touch targets', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test navigation touch targets
    const navButtons = [
      'nav a[href="/assistant"]',
      'nav button:has-text("Assistant")',
      'nav button:has-text("Projects")',
      'nav button:has-text("Dashboard")'
    ]
    
    for (const selector of navButtons) {
      const element = page.locator(selector)
      if (await element.isVisible()) {
        await checkElementTouchTarget(page, selector, 44) // iOS HIG minimum
      }
    }
    
    // Test user avatar touch target
    await checkElementTouchTarget(page, '.avatar, [role="img"]', 44)
    
    // Test primary action buttons
    await checkElementTouchTarget(page, 'button:has-text("New")', 44)
    await checkElementTouchTarget(page, 'button:has-text("Ask AI")', 44)
    
    // Test logo link
    const logo = page.locator('nav a[href="/assistant"]')
    if (await logo.isVisible()) {
      await logo.click()
      await expect(page).toHaveURL('/assistant')
    }
  })

  test('should test assistant interface mobile usability', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test assistant bar on mobile
    const assistantBar = page.locator('[data-testid="assistant-bar"]')
    await expect(assistantBar).toBeVisible()
    
    // Check textarea is properly sized
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    
    const textareaBox = await textarea.boundingBox()
    if (textareaBox) {
      expect(textareaBox.width).toBeLessThan(mobileDevices[0].width)
      expect(textareaBox.height).toBeGreaterThan(40) // Good touch target
    }
    
    // Test typing on mobile
    await textarea.click()
    await expect(textarea).toBeFocused()
    await textarea.fill('Test mobile input')
    
    // Test suggestion feed on mobile
    const suggestionFeed = page.locator('[data-testid="suggestion-feed"]')
    if (await suggestionFeed.isVisible()) {
      await expect(suggestionFeed).toBeVisible()
      
      // Test tab navigation on mobile
      const tabs = page.locator('button:has-text("Suggestions"), button:has-text("Quick Actions"), button:has-text("Recent Activity")')
      const tabCount = await tabs.count()
      
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i)
        await checkElementTouchTarget(page, `button:nth-child(${i + 1})`, 44)
        await tab.click()
        await page.waitForTimeout(500)
      }
    }
    
    // Test submission on mobile
    await textarea.fill('Mobile test submission')
    await page.keyboard.press('Enter')
    
    // Check processing indicator
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible({ timeout: 10000 })
  })

  test('should test projects page mobile layout', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Check page header on mobile
    const pageTitle = page.locator('h1:has-text("Projects")')
    await expect(pageTitle).toBeVisible()
    
    // Test "New Project" button positioning on mobile
    const newProjectButton = page.locator('a[href="/projects/new"]')
    await expect(newProjectButton).toBeVisible()
    await checkElementTouchTarget(page, 'a[href="/projects/new"]', 44)
    
    // Test project cards on mobile
    const projectCards = page.locator('[data-testid="project-card"]')
    const cardCount = await projectCards.count()
    
    if (cardCount > 0) {
      // Cards should stack vertically on mobile
      const firstCard = projectCards.first()
      const cardBox = await firstCard.boundingBox()
      
      if (cardBox) {
        expect(cardBox.width).toBeGreaterThan(mobileDevices[0].width * 0.8) // Should be nearly full width
      }
      
      // Test card button touch targets
      await checkElementTouchTarget(page, '[data-testid="project-card"] a[href*="/backlog"]', 44)
      await checkElementTouchTarget(page, '[data-testid="project-card"] a[href*="/board"]', 44)
      
      // Test card interaction on mobile
      const cardButton = firstCard.locator('a[href*="/backlog"]').first()
      await cardButton.click()
      await page.waitForURL(/\/projects\/[^\/]+\/backlog/)
    } else {
      // Test empty state on mobile
      const emptyStateButton = page.locator('button:has-text("Create Your First Project")')
      await expect(emptyStateButton).toBeVisible()
      await checkElementTouchTarget(page, 'button:has-text("Create Your First Project")', 44)
    }
  })

  test('should test dashboard mobile layout and interactions', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    
    // Check welcome message adapts to mobile
    const welcomeHeader = page.locator('h1')
    await expect(welcomeHeader).toBeVisible()
    await checkTextReadability(page, 'h1', 24) // Header should be readable
    
    // Test stats cards stack properly on mobile
    const statsCards = page.locator('.card-elevated')
    const statsCount = await statsCards.count()
    
    if (statsCount > 0) {
      // Stats should stack vertically
      for (let i = 0; i < Math.min(statsCount, 4); i++) {
        const card = statsCards.nth(i)
        const cardBox = await card.boundingBox()
        
        if (cardBox) {
          expect(cardBox.width).toBeGreaterThan(mobileDevices[0].width * 0.7)
        }
      }
    }
    
    // Test quick action buttons on mobile
    await checkElementTouchTarget(page, 'a[href="/projects/new"]:has-text("New Project")', 44)
    await checkElementTouchTarget(page, 'a[href="/projects"]:has-text("Browse Projects")', 44)
    
    // Test recent projects section on mobile
    const recentProjectsCard = page.locator('.card-elevated').filter({ hasText: 'Recent Projects' })
    if (await recentProjectsCard.isVisible()) {
      const projectLinks = recentProjectsCard.locator('a[href*="/projects/"]')
      const linkCount = await projectLinks.count()
      
      for (let i = 0; i < Math.min(linkCount, 3); i++) {
        await checkElementTouchTarget(page, `a[href*="/projects/"]:nth-child(${i + 1})`, 44)
      }
    }
    
    // Test scrolling if content overflows
    await testScrollability(page, 'body')
  })

  test('should test form inputs on mobile', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/projects/new')
    await page.waitForLoadState('networkidle')
    
    // Test form layout on mobile
    const form = page.locator('form')
    await expect(form).toBeVisible()
    
    // Test input field sizing
    const nameInput = page.locator('input#name')
    await expect(nameInput).toBeVisible()
    
    const inputBox = await nameInput.boundingBox()
    if (inputBox) {
      expect(inputBox.width).toBeGreaterThan(200) // Should be wide enough
      expect(inputBox.height).toBeGreaterThan(40) // Good touch target
    }
    
    // Test textarea sizing
    const descriptionTextarea = page.locator('textarea#description')
    if (await descriptionTextarea.isVisible()) {
      const textareaBox = await descriptionTextarea.boundingBox()
      if (textareaBox) {
        expect(textareaBox.width).toBeGreaterThan(200)
        expect(textareaBox.height).toBeGreaterThan(80) // Multiple lines
      }
    }
    
    // Test typing on mobile keyboard
    await nameInput.click()
    await expect(nameInput).toBeFocused()
    await nameInput.fill('Mobile Test Project')
    await expect(nameInput).toHaveValue('Mobile Test Project')
    
    // Test form buttons on mobile
    const submitButton = page.locator('button[type="submit"]')
    const cancelButton = page.locator('button:has-text("Cancel")')
    
    await checkElementTouchTarget(page, 'button[type="submit"]', 44)
    if (await cancelButton.isVisible()) {
      await checkElementTouchTarget(page, 'button:has-text("Cancel")', 44)
    }
    
    // Test button spacing on mobile
    const buttonsContainer = page.locator('.flex').filter({ has: submitButton })
    const containerBox = await buttonsContainer.boundingBox()
    
    if (containerBox) {
      expect(containerBox.width).toBeLessThan(mobileDevices[0].width)
    }
  })

  test('should test mobile dialogs and modals', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Trigger a dialog by submitting utterance
    const textarea = page.locator('textarea')
    await textarea.fill('I finished the authentication task')
    await page.keyboard.press('Enter')
    
    // Wait for candidate picker dialog
    await page.waitForSelector('[data-testid="candidate-picker-dialog"], [data-testid="action-preview-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const dialog = page.locator('[data-testid="candidate-picker-dialog"], [data-testid="action-preview-dialog"]')
    await expect(dialog).toBeVisible()
    
    // Check dialog sizing on mobile
    const dialogBox = await dialog.boundingBox()
    if (dialogBox) {
      expect(dialogBox.width).toBeLessThan(mobileDevices[0].width - 20) // Should have margins
      expect(dialogBox.height).toBeLessThan(mobileDevices[0].height - 40) // Should fit screen
    }
    
    // Test dialog buttons on mobile
    const dialogButtons = dialog.locator('button')
    const buttonCount = await dialogButtons.count()
    
    for (let i = 0; i < buttonCount; i++) {
      const button = dialogButtons.nth(i)
      if (await button.isVisible()) {
        const buttonBox = await button.boundingBox()
        if (buttonBox) {
          expect(buttonBox.height).toBeGreaterThan(40) // Good touch target
        }
      }
    }
    
    // Test dialog dismiss
    const cancelButton = dialog.locator('button:has-text("Cancel")')
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
      await page.waitForSelector('[data-testid="candidate-picker-dialog"], [data-testid="action-preview-dialog"]', { 
        state: 'hidden', 
        timeout: 5000 
      })
    }
  })

  test('should test mobile orientation changes', async ({ page }) => {
    // Start in portrait
    await setMobileViewport(page, { name: 'Portrait', width: 375, height: 667 })
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Check portrait layout
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    
    // Change to landscape
    await setMobileViewport(page, { name: 'Landscape', width: 667, height: 375 })
    
    // Navigation should still be visible and functional
    await expect(nav).toBeVisible()
    
    // Check that content adapts
    const textarea = page.locator('textarea')
    if (await textarea.isVisible()) {
      const textareaBox = await textarea.boundingBox()
      if (textareaBox) {
        expect(textareaBox.width).toBeLessThan(667)
      }
    }
    
    // Test interaction in landscape
    await textarea.click()
    await textarea.fill('Landscape test')
    await expect(textarea).toHaveValue('Landscape test')
  })

  test('should test mobile scroll behavior and sticky elements', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Check if navigation is sticky
    const nav = page.locator('nav')
    const navClasses = await nav.getAttribute('class')
    
    if (navClasses && navClasses.includes('sticky')) {
      // Test sticky behavior
      await page.evaluate(() => window.scrollTo(0, 100))
      await page.waitForTimeout(500)
      
      await expect(nav).toBeVisible()
      
      const navBox = await nav.boundingBox()
      if (navBox) {
        expect(navBox.y).toBeLessThanOrEqual(10) // Should be at top
      }
    }
    
    // Test scrolling through content
    const suggestionFeed = page.locator('[data-testid="suggestion-feed"]')
    if (await suggestionFeed.isVisible()) {
      await testScrollability(page, '[data-testid="suggestion-feed"]')
    }
    
    // Test assistant bar stickiness
    const assistantBar = page.locator('[data-testid="assistant-bar"]')
    const assistantBarClasses = await assistantBar.getAttribute('class')
    
    if (assistantBarClasses && assistantBarClasses.includes('sticky')) {
      await page.evaluate(() => window.scrollTo(0, 200))
      await page.waitForTimeout(500)
      
      await expect(assistantBar).toBeVisible()
    }
    
    // Reset scroll
    await page.evaluate(() => window.scrollTo(0, 0))
  })

  test('should test mobile performance and loading states', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    
    // Test loading performance
    const startTime = Date.now()
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Should load reasonably fast on mobile
    expect(loadTime).toBeLessThan(10000) // 10 seconds max
    
    // Check for loading states
    const loadingElements = page.locator('.animate-pulse, .loading, text*=Loading')
    const loadingCount = await loadingElements.count()
    
    // Loading states should eventually disappear
    if (loadingCount > 0) {
      await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 10000 })
    }
    
    // Test image loading
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const image = images.nth(i)
      if (await image.isVisible()) {
        const isLoaded = await image.evaluate((img: HTMLImageElement) => img.complete && img.naturalHeight !== 0)
        expect(isLoaded).toBeTruthy()
      }
    }
  })

  test('should test mobile accessibility features', async ({ page }) => {
    await setMobileViewport(page, mobileDevices[0])
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test zoom functionality
    await page.evaluate(() => {
      // Simulate pinch zoom
      document.body.style.zoom = '1.5'
    })
    
    await page.waitForTimeout(1000)
    
    // Content should still be accessible
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1'
    })
    
    // Test high contrast mode simulation
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(1000)
    
    // Elements should still be visible
    await expect(nav).toBeVisible()
    await expect(textarea).toBeVisible()
    
    // Reset color scheme
    await page.emulateMedia({ colorScheme: 'light' })
    
    // Test focus indicators on mobile
    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    if (await focusedElement.isVisible()) {
      const focusBox = await focusedElement.boundingBox()
      if (focusBox) {
        expect(focusBox.width).toBeGreaterThan(0)
        expect(focusBox.height).toBeGreaterThan(0)
      }
    }
  })
})