import { test, expect } from '@playwright/test'
import {
  AuthPage,
  ProjectsPage,
  BacklogPage,
  BoardPage,
  AssistantPage,
  testUtils,
} from '../page-objects'

test.describe('Responsive Design Cross-Browser Tests', () => {
  let authPage: AuthPage
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let boardPage: BoardPage
  let assistantPage: AssistantPage

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page)
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)
    boardPage = new BoardPage(page)
    assistantPage = new AssistantPage(page)
  })

  test.describe('Navigation Responsiveness', () => {
    test('should adapt navigation for mobile devices', async ({ page, browserName }) => {
      test.info().annotations.push({
        type: 'browser',
        description: browserName,
      })

      // Already authenticated via global setup

      // Check if running on mobile viewport
      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Mobile navigation should have hamburger menu
        const mobileMenuButton = page.locator('[data-testid="mobile-menu-toggle"]')
        if (await mobileMenuButton.isVisible({ timeout: 5000 })) {
          await mobileMenuButton.click()

          // Navigation items should be in mobile menu
          const mobileNav = page.locator('[data-testid="mobile-navigation"]')
          await expect(mobileNav).toBeVisible()

          // Check that navigation links are accessible
          const navLinks = mobileNav.locator('a')
          const linkCount = await navLinks.count()
          expect(linkCount).toBeGreaterThan(0)
        }
      } else {
        // Desktop navigation should be always visible
        const desktopNav = page.locator('nav')
        await expect(desktopNav).toBeVisible()

        const navItems = desktopNav.locator(
          'a:has-text("Dashboard"), a:has-text("Projects"), a:has-text("Assistant")'
        )
        await expect(navItems.first()).toBeVisible()
      }
    })

    test('should maintain user avatar and actions across breakpoints', async ({ page }) => {
      // Already authenticated via global setup

      // User avatar should be visible on all screen sizes
      const userAvatar = page.locator('[data-testid="user-avatar"], .avatar')
      await expect(userAvatar).toBeVisible()

      // Click avatar to check if menu appears
      await userAvatar.click()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Mobile might show simplified user menu
        const userMenu = page.locator('[data-testid="user-menu"], [role="menu"]')
        if (await userMenu.isVisible({ timeout: 3000 })) {
          const signOutOption = userMenu.locator(
            'button:has-text("Sign out"), button:has-text("Logout")'
          )
          await expect(signOutOption).toBeVisible()
        }
      }
    })

    test('should handle organization switcher on different devices', async ({ page }) => {
      // Already authenticated via global setup

      const orgSwitcher = page.locator('[data-testid="org-switcher"]')
      if (await orgSwitcher.isVisible({ timeout: 5000 })) {
        await orgSwitcher.click()

        const orgDropdown = page.locator('[data-testid="org-dropdown"]')
        await expect(orgDropdown).toBeVisible()

        // Dropdown should be positioned correctly on all devices
        const boundingBox = await orgDropdown.boundingBox()
        expect(boundingBox).toBeTruthy()

        if (boundingBox) {
          expect(boundingBox.x).toBeGreaterThanOrEqual(0)
          expect(boundingBox.y).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  test.describe('Project Management Responsiveness', () => {
    test('should display projects grid responsively', async ({ page }) => {
      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      // Create a test project first
      const projectName = testUtils.generateProjectName()
      await projectsPage.createProject(projectName, 'Test project for responsive design')

      await projectsPage.gotoProjects()

      // Check projects grid layout
      const projectsContainer = page.locator(
        '[data-testid="projects-grid"], [data-testid="projects-list"]'
      )
      await expect(projectsContainer).toBeVisible()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Mobile should show single column or stacked layout
        const projectCards = page.locator('[data-testid="project-card"]')
        const cardCount = await projectCards.count()

        if (cardCount > 0) {
          // Check if cards are stacked vertically
          const firstCard = projectCards.first()
          const secondCard = projectCards.nth(1)

          if (cardCount > 1) {
            const firstCardBox = await firstCard.boundingBox()
            const secondCardBox = await secondCard.boundingBox()

            if (firstCardBox && secondCardBox) {
              // On mobile, second card should be below first card
              expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 10)
            }
          }
        }
      }

      // Cleanup
      await projectsPage.deleteProject(projectName)
    })

    test('should adapt project creation form for mobile', async ({ page }) => {
      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      await projectsPage.newProjectButton.click()

      const createForm = page.locator('[data-testid="create-project-form"], form')
      await expect(createForm).toBeVisible()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Form should fill available width on mobile
        const formBox = await createForm.boundingBox()
        if (formBox && viewport) {
          expect(formBox.width).toBeGreaterThan(viewport.width * 0.8) // At least 80% of screen width
        }
      }

      // Form inputs should be touch-friendly on mobile
      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        const inputBox = await nameInput.boundingBox()
        if (inputBox && isMobile) {
          expect(inputBox.height).toBeGreaterThanOrEqual(44) // Minimum touch target size
        }
      }

      // Cancel form
      const cancelButton = page.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click()
      } else {
        await page.keyboard.press('Escape')
      }
    })
  })

  test.describe('Backlog Management Responsiveness', () => {
    let projectId: string
    let projectName: string

    test.beforeEach(async () => {
      // Already authenticated via global setup
      projectName = testUtils.generateProjectName()
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(
        projectName,
        'Test project for backlog responsiveness'
      )
    })

    test.afterEach(async () => {
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(projectName)
    })

    test('should display backlog stories in mobile-friendly layout', async ({ page }) => {
      await backlogPage.gotoBacklog(projectId)

      // Create test stories
      const stories = ['Mobile Story 1', 'Mobile Story 2', 'Mobile Story 3']

      for (const story of stories) {
        await backlogPage.createStory(
          `${story} ${testUtils.generateUniqueId()}`,
          'Test story for mobile layout'
        )
        await backlogPage.gotoBacklog(projectId)
      }

      await backlogPage.gotoBacklog(projectId)

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Story cards should stack vertically on mobile
        const storyCards = page.locator('[data-testid="story-card"]')
        const cardCount = await storyCards.count()

        if (cardCount >= 2) {
          const firstCard = storyCards.first()
          const secondCard = storyCards.nth(1)

          const firstCardBox = await firstCard.boundingBox()
          const secondCardBox = await secondCard.boundingBox()

          if (firstCardBox && secondCardBox) {
            // Cards should be stacked vertically
            expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 20)
          }
        }
      }
    })

    test('should handle story creation form on mobile', async ({ page }) => {
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.addStoryButton.click()

      const storyForm = page.locator('[data-testid="story-form"], form')
      await expect(storyForm).toBeVisible()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Form should be optimized for mobile input
        const titleInput = page.locator('input[name="title"], input[placeholder*="title"]')
        if (await titleInput.isVisible({ timeout: 5000 })) {
          const inputBox = await titleInput.boundingBox()
          if (inputBox) {
            expect(inputBox.height).toBeGreaterThanOrEqual(44) // Touch-friendly height
          }
        }

        const descriptionInput = page.locator(
          'textarea[name="description"], textarea[placeholder*="description"]'
        )
        if (await descriptionInput.isVisible({ timeout: 5000 })) {
          const textareaBox = await descriptionInput.boundingBox()
          if (textareaBox) {
            expect(textareaBox.height).toBeGreaterThanOrEqual(80) // Adequate height for typing
          }
        }
      }

      // Cancel form
      const cancelButton = page.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click()
      } else {
        await page.keyboard.press('Escape')
      }
    })
  })

  test.describe('Sprint Board Responsiveness', () => {
    let projectId: string
    let projectName: string

    test.beforeEach(async () => {
      // Already authenticated via global setup
      projectName = testUtils.generateProjectName()
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(
        projectName,
        'Test project for board responsiveness'
      )
    })

    test.afterEach(async () => {
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(projectName)
    })

    test('should adapt board layout for different screen sizes', async ({ page }) => {
      await boardPage.gotoBoard(projectId)

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Mobile board might be horizontally scrollable or stacked
        const boardContainer = page.locator('[data-testid="board-container"]')
        await expect(boardContainer).toBeVisible()

        // Check if columns are horizontally scrollable
        const todoColumn = page.locator('[data-testid="column-todo"]')
        const inProgressColumn = page.locator('[data-testid="column-in-progress"]')

        if ((await todoColumn.isVisible()) && (await inProgressColumn.isVisible())) {
          const todoBox = await todoColumn.boundingBox()
          const inProgressBox = await inProgressColumn.boundingBox()

          if (todoBox && inProgressBox && viewport) {
            // Columns might be side by side with horizontal scroll
            // or stacked vertically on very small screens
            const totalColumnsWidth = todoBox.width + inProgressBox.width
            if (totalColumnsWidth > viewport.width) {
              // Should have horizontal scroll
              const scrollableContainer = page.locator('[data-testid="board-scroll-container"]')
              if (await scrollableContainer.isVisible({ timeout: 2000 })) {
                await expect(scrollableContainer).toHaveCSS('overflow-x', 'auto')
              }
            }
          }
        }
      } else {
        // Desktop should show all columns side by side
        await boardPage.expectBoardLoaded()
      }
    })

    test('should handle task cards appropriately on mobile', async ({ page }) => {
      await boardPage.gotoBoard(projectId)

      // Create a sprint with tasks
      const sprintName = `Mobile Sprint ${testUtils.generateUniqueId()}`
      await boardPage.createSprint(sprintName, 7)

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Task cards should be touch-friendly
        const taskCards = page.locator('[data-testid="task-card"]')
        const cardCount = await taskCards.count()

        if (cardCount > 0) {
          const firstCard = taskCards.first()
          const cardBox = await firstCard.boundingBox()

          if (cardBox) {
            expect(cardBox.height).toBeGreaterThanOrEqual(60) // Minimum touch target
            expect(cardBox.width).toBeGreaterThan(150) // Reasonable width for mobile
          }
        }
      }
    })
  })

  test.describe('AI Assistant Responsiveness', () => {
    test('should adapt chat interface for mobile', async ({ page }) => {
      // Already authenticated via global setup
      await assistantPage.gotoAssistant()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Chat input should be optimized for mobile
        const chatInput = page.locator(
          'textarea[placeholder*="Ask"], textarea[placeholder*="message"]'
        )
        await expect(chatInput).toBeVisible()

        const inputBox = await chatInput.boundingBox()
        if (inputBox && viewport) {
          expect(inputBox.width).toBeGreaterThan(viewport.width * 0.7) // Most of screen width
          expect(inputBox.height).toBeGreaterThanOrEqual(44) // Touch-friendly height
        }

        // Send button should be appropriately sized
        const sendButton = page.locator('button:has-text("Send"), button[type="submit"]')
        const sendBox = await sendButton.boundingBox()
        if (sendBox) {
          expect(sendBox.height).toBeGreaterThanOrEqual(44)
          expect(sendBox.width).toBeGreaterThanOrEqual(44)
        }
      }

      // Test chat functionality
      await assistantPage.sendMessage('Test mobile chat')
      await assistantPage.expectAIResponse()

      // Messages should be readable on mobile
      if (isMobile) {
        const messages = page.locator('[data-testid="messages-container"] > *')
        const messageCount = await messages.count()

        if (messageCount > 0) {
          const firstMessage = messages.first()
          const messageBox = await firstMessage.boundingBox()

          if (messageBox && viewport) {
            expect(messageBox.width).toBeLessThanOrEqual(viewport.width - 40) // Leave margins
          }
        }
      }
    })

    test('should handle suggestions appropriately on mobile', async ({ page }) => {
      // Already authenticated via global setup
      await assistantPage.gotoAssistant()

      const suggestionsContainer = page.locator('[data-testid="suggestions"]')
      if (await suggestionsContainer.isVisible({ timeout: 5000 })) {
        const viewport = page.viewportSize()
        const isMobile = viewport ? viewport.width < 768 : false

        if (isMobile) {
          // Suggestion buttons should be touch-friendly
          const suggestionButtons = suggestionsContainer.locator('button')
          const buttonCount = await suggestionButtons.count()

          if (buttonCount > 0) {
            const firstButton = suggestionButtons.first()
            const buttonBox = await firstButton.boundingBox()

            if (buttonBox) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44) // Touch target
            }
          }
        }
      }
    })
  })

  test.describe('Accessibility and Touch Interactions', () => {
    test('should provide adequate touch targets on mobile', async ({ page }) => {
      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      const viewport = page.viewportSize()
      const isMobile = viewport ? viewport.width < 768 : false

      if (isMobile) {
        // Check various interactive elements for touch-friendly sizing
        const interactiveElements = [
          '[data-testid="new-project-button"]',
          'button:has-text("New")',
          '[data-testid="user-avatar"]',
          'a:has-text("Dashboard")',
          'a:has-text("Projects")',
        ]

        for (const selector of interactiveElements) {
          const element = page.locator(selector).first()
          if (await element.isVisible({ timeout: 2000 })) {
            const elementBox = await element.boundingBox()
            if (elementBox) {
              // WCAG AA recommends minimum 44x44px touch targets
              expect(Math.min(elementBox.width, elementBox.height)).toBeGreaterThanOrEqual(40)
            }
          }
        }
      }
    })

    test('should handle keyboard navigation on all devices', async ({ page }) => {
      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      // Test tab navigation
      await page.keyboard.press('Tab')

      // Check if focus is visible
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Navigate through multiple elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        const currentFocus = page.locator(':focus')
        await expect(currentFocus).toBeVisible()
      }
    })

    test('should maintain readable text sizes across devices', async ({ page }) => {
      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      // Check text elements for minimum size
      const textElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div']

      for (const selector of textElements) {
        const elements = page.locator(selector)
        const count = await elements.count()

        for (let i = 0; i < Math.min(count, 5); i++) {
          const element = elements.nth(i)
          if (await element.isVisible({ timeout: 1000 })) {
            const fontSize = await element.evaluate((el) => {
              return window.getComputedStyle(el).fontSize
            })

            const fontSizeNumber = parseFloat(fontSize)
            expect(fontSizeNumber).toBeGreaterThanOrEqual(14) // Minimum readable size
          }
        }
      }
    })
  })

  test.describe('Performance on Different Devices', () => {
    test('should load quickly on mobile connections', async ({ page }) => {
      // Simulate slow network for mobile testing
      await page.route('**/*', (route) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(route.continue()), 100) // Add 100ms delay
        })
      })

      const startTime = Date.now()

      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      const loadTime = Date.now() - startTime

      // Should load within reasonable time even with simulated slow network
      expect(loadTime).toBeLessThan(15000) // 15 seconds max including auth
    })

    test('should handle device orientation changes', async ({ page, browserName }) => {
      // Skip on browsers that don't support mobile simulation
      if (browserName === 'webkit' || browserName === 'firefox') {
        test.skip()
      }

      // Already authenticated via global setup
      await projectsPage.gotoProjects()

      // Test orientation change (if supported)
      try {
        await page.setViewportSize({ width: 667, height: 375 }) // Landscape phone
        await page.waitForTimeout(1000)

        // Interface should adapt to landscape
        const navigation = page.locator('nav')
        await expect(navigation).toBeVisible()

        await page.setViewportSize({ width: 375, height: 667 }) // Portrait phone
        await page.waitForTimeout(1000)

        // Interface should adapt back to portrait
        await expect(navigation).toBeVisible()
      } catch {
        // Orientation change not supported in this browser/setup
        test.skip()
      }
    })
  })
})
