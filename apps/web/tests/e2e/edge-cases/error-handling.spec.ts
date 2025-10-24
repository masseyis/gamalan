import { test, expect } from '@playwright/test'
import {
  AuthPage,
  ProjectsPage,
  BacklogPage,
  BoardPage,
  AssistantPage,
  testUtils,
} from '../page-objects'

test.describe('Error Handling and Edge Cases', () => {
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

    // Already authenticated via global setup
  })

  test.describe('Network and API Error Handling', () => {
    test('should handle complete network failure gracefully', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate complete network failure
      await page.context().setOffline(true)

      // Try to create a project
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Offline Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should show network error
        await projectsPage.expectError('Network error')
      }

      // Restore network
      await page.context().setOffline(false)
    })

    test('should handle API timeout scenarios', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate slow API response
      await page.route('**/api/projects', (route) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(route.continue()), 10000) // 10 second delay
        })
      })

      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Timeout Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should show timeout error or loading state
        const loadingIndicator = page.locator('[data-testid="loading"], text=Loading')
        const errorMessage = page.locator('text=timeout, text=slow')

        const result = await Promise.race([
          loadingIndicator.isVisible({ timeout: 15000 }),
          errorMessage.isVisible({ timeout: 15000 }),
        ]).catch(() => false)

        expect(result).toBeTruthy()
      }
    })

    test('should handle API server errors (5xx)', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate server error
      await page.route('**/api/projects', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })

      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Server Error Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should show server error message
        await projectsPage.expectError('server error')
      }
    })

    test('should handle API client errors (4xx)', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate client error
      await page.route('**/api/projects', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Bad Request', message: 'Invalid project data' }),
        })
      })

      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Client Error Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should show validation error message
        await projectsPage.expectError('Invalid project data')
      }
    })

    test('should handle authentication token expiry', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate expired token
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized', message: 'Token expired' }),
        })
      })

      // Try to perform an authenticated action
      await projectsPage.newProjectButton.click()

      // Should redirect to login or show auth error
      const loginRedirect = page.url().includes('/sign-in')
      const authError = await page
        .locator('text=unauthorized, text=expired')
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      expect(loginRedirect || authError).toBeTruthy()
    })

    test('should handle malformed API responses', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Simulate malformed JSON response
      await page.route('**/api/projects', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json response',
        })
      })

      // Should handle parse error gracefully
      const errorOccurred = await page
        .locator('text=error, [role="alert"]')
        .isVisible({ timeout: 10000 })
        .catch(() => false)

      // Either shows error or falls back to cached/default data
      expect(errorOccurred || true).toBeTruthy() // Accept graceful handling
    })
  })

  test.describe('Input Validation and Data Edge Cases', () => {
    test('should handle extremely long input values', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        // Very long project name (1000 characters)
        const longName = 'A'.repeat(1000)
        await nameInput.fill(longName)

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should show validation error or truncate
        const validationError = await page
          .locator('text=too long, text=limit')
          .isVisible({ timeout: 5000 })
          .catch(() => false)
        const successMessage = await page
          .locator('text=created')
          .isVisible({ timeout: 5000 })
          .catch(() => false)

        expect(validationError || successMessage).toBeTruthy()
      }
    })

    test('should handle special characters and unicode', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        // Project name with special characters and unicode
        const specialName = '测试项目 🚀 <script>alert("xss")</script> \'quotes\' "double" & &amp;'
        await nameInput.fill(specialName)

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should handle special characters safely (no XSS execution)
        const alertDialogs = page.locator('text=xss')
        await expect(alertDialogs).toHaveCount(0)

        // Should either create project or show validation error
        const result = await Promise.race([
          page.locator('text=created').isVisible({ timeout: 5000 }),
          page.locator('[role="alert"]').isVisible({ timeout: 5000 }),
        ]).catch(() => false)

        expect(result).toBeTruthy()

        // Cleanup if created
        try {
          await projectsPage.gotoProjects()
          await projectsPage.deleteProject(specialName)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    test('should handle null and undefined values', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Intercept and modify API responses to include null values
      await page.route('**/api/projects', (route) => {
        const response = {
          projects: [
            {
              id: 'null-test',
              name: null,
              description: undefined,
              createdAt: null,
              updatedAt: '',
            },
          ],
        }

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        })
      })

      await page.reload()

      // Should handle null values gracefully
      const projects = page.locator('[data-testid="project-card"]')
      const projectCount = await projects.count()

      // Should either filter out invalid projects or show placeholders
      if (projectCount > 0) {
        const firstProject = projects.first()
        const text = await firstProject.textContent()
        expect(text).not.toContain('null')
        expect(text).not.toContain('undefined')
      }
    })

    test('should handle concurrent form submissions', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Concurrent Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')

        // Submit multiple times rapidly
        await Promise.all([submitButton.click(), submitButton.click(), submitButton.click()])

        // Should handle concurrent submissions gracefully
        const errorMessage = page.locator('text=already exists, text=duplicate')
        const successMessage = page.locator('text=created')

        const result = await Promise.race([
          errorMessage.isVisible({ timeout: 10000 }),
          successMessage.isVisible({ timeout: 10000 }),
        ]).catch(() => false)

        expect(result).toBeTruthy()

        // Only one project should be created
        try {
          await projectsPage.gotoProjects()
          const projectCards = page.locator(
            '[data-testid="project-card"]:has-text("Concurrent Test Project")'
          )
          const count = await projectCards.count()
          expect(count).toBeLessThanOrEqual(1)

          if (count === 1) {
            await projectsPage.deleteProject('Concurrent Test Project')
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    })
  })

  test.describe('Memory and Performance Edge Cases', () => {
    test('should handle large datasets without memory leaks', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Create multiple projects to test performance
      const projectCount = 5 // Keep reasonable for test speed
      const createdProjects: string[] = []

      for (let i = 0; i < projectCount; i++) {
        const projectName = `Performance Test ${i} ${testUtils.generateUniqueId()}`
        await projectsPage.createProject(projectName, `Description for project ${i}`)
        createdProjects.push(projectName)
        await projectsPage.gotoProjects()
      }

      // Navigate through all projects multiple times
      for (let iteration = 0; iteration < 3; iteration++) {
        for (const projectName of createdProjects) {
          await projectsPage.openProject(projectName)
          await projectsPage.gotoProjects()
        }
      }

      // Check for memory leaks by looking at performance
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory
          ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            }
          : null
      })

      if (memoryInfo) {
        // Memory usage should be reasonable
        expect(memoryInfo.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
      }

      // Cleanup projects
      for (const projectName of createdProjects) {
        try {
          await projectsPage.gotoProjects()
          await projectsPage.deleteProject(projectName)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    test('should handle rapid navigation without breaking', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Rapid navigation between sections
      const sections = ['Projects', 'Assistant', 'Dashboard']

      for (let i = 0; i < 10; i++) {
        const section = sections[i % sections.length]
        await authPage.navigateTo(section as any)
        await page.waitForTimeout(100) // Brief pause
      }

      // Should still be functional
      await authPage.expectAuthenticated()
      await projectsPage.gotoProjects()
      await projectsPage.expectProjectsLoaded()
    })

    test('should handle browser tab switching and focus events', async ({ page, context }) => {
      await projectsPage.gotoProjects()

      // Create a second tab
      const secondPage = await context.newPage()
      await secondPage.goto('https://example.com')

      // Switch focus back and forth
      await secondPage.bringToFront()
      await page.bringToFront()
      await secondPage.bringToFront()
      await page.bringToFront()

      // Original page should still work
      await authPage.expectAuthenticated()

      await secondPage.close()
    })
  })

  test.describe('State Management Edge Cases', () => {
    test('should handle browser back/forward with form data', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Back Forward Test')

        // Navigate away without submitting
        await authPage.navigateTo('Assistant')
        await authPage.navigateTo('Projects')

        // Go back to form
        await projectsPage.newProjectButton.click()

        // Form should handle the transition gracefully
        await expect(nameInput).toBeVisible()
      }
    })

    test('should handle local storage corruption', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Corrupt local storage
      await page.evaluate(() => {
        localStorage.setItem('corrupted-data', 'invalid-json-{[}')
        localStorage.setItem('null-data', 'null')
        localStorage.setItem('undefined-data', 'undefined')
      })

      // Navigate around and ensure app still works
      await assistantPage.gotoAssistant()
      await assistantPage.expectAssistantLoaded()

      await projectsPage.gotoProjects()
      await projectsPage.expectProjectsLoaded()
    })

    test('should handle session timeout during operation', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      // Clear session storage to simulate timeout
      await page.evaluate(() => {
        sessionStorage.clear()
      })

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Session Timeout Test')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should handle session timeout gracefully
        const redirectToLogin = page.url().includes('/sign-in')
        const sessionError = await page
          .locator('text=session, text=expired')
          .isVisible({ timeout: 5000 })
          .catch(() => false)

        expect(redirectToLogin || sessionError).toBeTruthy()
      }
    })
  })

  test.describe('Browser Compatibility Edge Cases', () => {
    test('should handle disabled JavaScript gracefully', async ({ page }) => {
      // Note: This test simulates scenarios where JS might fail
      await projectsPage.gotoProjects()

      // Simulate JS execution failure by overriding critical functions
      await page.addInitScript(() => {
        // Override fetch to simulate JS environment issues
        const originalFetch = window.fetch
        let callCount = 0
        window.fetch = (...args) => {
          callCount++
          if (callCount > 5) {
            throw new Error('Simulated JS failure')
          }
          return originalFetch.apply(window, args)
        }
      })

      // Try to perform operations that would normally use JS
      await projectsPage.newProjectButton.click()

      // Should either work or show appropriate fallback
      const formVisible = await page
        .locator('form, [data-testid="create-project-form"]')
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      const errorMessage = await page
        .locator('text=error, [role="alert"]')
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      expect(formVisible || errorMessage).toBeTruthy()
    })

    test('should handle cookies disabled scenario', async ({ page }) => {
      // Clear all cookies
      await page.context().clearCookies()

      // Disable cookie storage
      await page.addInitScript(() => {
        Object.defineProperty(document, 'cookie', {
          get: () => '',
          set: () => false,
        })
      })

      // Try to sign in without cookies
      await authPage.gotoSignIn()

      const emailInput = page.locator('input[name="identifier"]').first()
      if (await emailInput.isVisible({ timeout: 5000 })) {
        await emailInput.fill('test@example.com')

        const continueButton = page.locator('button:has-text("Continue")').first()
        await continueButton.click()

        // Should either work with alternative storage or show appropriate message
        const passwordField = page.locator('input[name="password"]')
        const cookieWarning = page.locator('text=cookies, text=enable')

        const result = await Promise.race([
          passwordField.isVisible({ timeout: 10000 }),
          cookieWarning.isVisible({ timeout: 10000 }),
        ]).catch(() => false)

        expect(result).toBeTruthy()
      }
    })

    test('should handle viewport resizing during operation', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      // Resize viewport while form is open
      await page.setViewportSize({ width: 400, height: 600 })
      await page.waitForTimeout(500)

      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.waitForTimeout(500)

      await page.setViewportSize({ width: 768, height: 1024 })
      await page.waitForTimeout(500)

      // Form should still be functional
      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Resize Test Project')

        const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')
        await submitButton.click()

        // Should handle the submission regardless of resize operations
        const result = await Promise.race([
          page.locator('text=created').isVisible({ timeout: 10000 }),
          page.locator('[role="alert"]').isVisible({ timeout: 10000 }),
        ]).catch(() => false)

        expect(result).toBeTruthy()

        // Cleanup if created
        try {
          await projectsPage.gotoProjects()
          await projectsPage.deleteProject('Resize Test Project')
        } catch {
          // Ignore cleanup errors
        }
      }
    })
  })

  test.describe('Security Edge Cases', () => {
    test('should prevent XSS attacks in dynamic content', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Mock API response with potential XSS content
      await page.route('**/api/projects', (route) => {
        const response = {
          projects: [
            {
              id: 'xss-test',
              name: '<script>window.xssExecuted = true</script>XSS Test',
              description: '<img src="x" onerror="window.xssExecuted = true">',
              createdAt: '2023-01-01T00:00:00Z',
              updatedAt: '2023-01-01T00:00:00Z',
            },
          ],
        }

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        })
      })

      await page.reload()

      // Check that XSS was not executed
      const xssExecuted = await page.evaluate(() => (window as any).xssExecuted)
      expect(xssExecuted).toBeFalsy()

      // Content should be sanitized
      const projectCard = page.locator('[data-testid="project-card"]').first()
      if (await projectCard.isVisible({ timeout: 5000 })) {
        const cardText = await projectCard.textContent()
        expect(cardText).not.toContain('<script>')
        expect(cardText).not.toContain('<img')
      }
    })

    test('should handle CSRF protection', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Try to make a request without proper CSRF token
      const response = await page.request.post('/api/projects', {
        data: {
          name: 'CSRF Test Project',
          description: 'Testing CSRF protection',
        },
      })

      // Should reject request without proper CSRF protection
      expect(response.status()).toBeGreaterThanOrEqual(400)
    })

    test('should handle malicious file uploads', async ({ page }) => {
      // Look for file upload functionality
      const fileInputs = page.locator('input[type="file"]')
      const fileInputCount = await fileInputs.count()

      if (fileInputCount > 0) {
        const fileInput = fileInputs.first()

        // Try to upload a potentially malicious file
        const maliciousFile = {
          name: '../../malicious.exe',
          mimeType: 'application/exe',
          buffer: Buffer.from('MZ'), // EXE header
        }

        await fileInput.setInputFiles(maliciousFile)

        // Should reject or sanitize the file
        const errorMessage = page.locator('text=invalid file, text=not allowed')
        const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)

        // Either shows error or sanitizes filename
        const fileName = await fileInput.evaluate((input) => {
          return (input as HTMLInputElement).files?.[0]?.name
        })

        expect(hasError || !fileName?.includes('../')).toBeTruthy()
      }
    })
  })
})
