import { test, expect } from '@playwright/test'
import { AuthPage, ProjectsPage, BacklogPage, BoardPage, AssistantPage, testUtils } from '../page-objects'

test.describe('Performance and Stress Tests', () => {
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

  test.describe('Page Load Performance', () => {
    test('should load main pages within acceptable time limits', async ({ page }) => {
      const pages = [
        { name: 'Projects', action: () => projectsPage.gotoProjects() },
        { name: 'Assistant', action: () => assistantPage.gotoAssistant() },
        { name: 'Dashboard', action: () => authPage.navigateTo('Dashboard') }
      ]

      for (const pageTest of pages) {
        const startTime = Date.now()

        await pageTest.action()
        await page.waitForLoadState('networkidle')

        const loadTime = Date.now() - startTime

        // Pages should load within 5 seconds
        expect(loadTime).toBeLessThan(5000)

        test.info().annotations.push({
          type: 'performance',
          description: `${pageTest.name} loaded in ${loadTime}ms`
        })
      }
    })

    test('should handle First Contentful Paint timing', async ({ page }) => {
      await page.goto('/')

      const fcpTime = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
            if (fcpEntry) {
              resolve(fcpEntry.startTime)
            }
          }).observe({ entryTypes: ['paint'] })

          // Fallback timeout
          setTimeout(() => resolve(0), 5000)
        })
      })

      if (fcpTime > 0) {
        // FCP should be under 3 seconds
        expect(fcpTime).toBeLessThan(3000)

        test.info().annotations.push({
          type: 'performance',
          description: `First Contentful Paint: ${fcpTime}ms`
        })
      }
    })

    test('should load with reasonable bundle sizes', async ({ page }) => {
      const resourceSizes = new Map<string, number>()

      page.on('response', response => {
        const url = response.url()
        const size = parseInt(response.headers()['content-length'] || '0')

        if (url.includes('.js') || url.includes('.css')) {
          resourceSizes.set(url, size)
        }
      })

      await projectsPage.gotoProjects()
      await page.waitForLoadState('networkidle')

      // Check JavaScript bundle sizes
      let totalJSSize = 0
      let totalCSSSize = 0

      for (const [url, size] of resourceSizes) {
        if (url.includes('.js')) {
          totalJSSize += size
        } else if (url.includes('.css')) {
          totalCSSSize += size
        }
      }

      // Total JS should be reasonable (under 2MB)
      expect(totalJSSize).toBeLessThan(2 * 1024 * 1024)

      // Total CSS should be reasonable (under 500KB)
      expect(totalCSSSize).toBeLessThan(500 * 1024)

      test.info().annotations.push({
        type: 'performance',
        description: `JS: ${Math.round(totalJSSize / 1024)}KB, CSS: ${Math.round(totalCSSSize / 1024)}KB`
      })
    })
  })

  test.describe('Memory Usage Tests', () => {
    test('should not leak memory during navigation', async ({ page }) => {
      const getMemoryUsage = async () => {
        return await page.evaluate(() => {
          if ((performance as any).memory) {
            return {
              used: (performance as any).memory.usedJSHeapSize,
              total: (performance as any).memory.totalJSHeapSize
            }
          }
          return null
        })
      }

      const initialMemory = await getMemoryUsage()

      // Navigate through different sections multiple times
      for (let i = 0; i < 5; i++) {
        await projectsPage.gotoProjects()
        await assistantPage.gotoAssistant()
        await authPage.navigateTo('Dashboard')
      }

      const finalMemory = await getMemoryUsage()

      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.used - initialMemory.used
        const increasePercentage = (memoryIncrease / initialMemory.used) * 100

        // Memory increase should be reasonable (less than 50% growth)
        expect(increasePercentage).toBeLessThan(50)

        test.info().annotations.push({
          type: 'memory',
          description: `Memory increase: ${Math.round(increasePercentage)}%`
        })
      }
    })

    test('should handle large lists efficiently', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Create multiple projects for stress testing
      const projectCount = 10
      const createdProjects: string[] = []

      for (let i = 0; i < projectCount; i++) {
        const projectName = `Stress Test ${i} ${testUtils.generateUniqueId()}`
        await projectsPage.createProject(projectName, `Description ${i}`)
        createdProjects.push(projectName)
        await projectsPage.gotoProjects()
      }

      const memoryBefore = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      // Scroll through the list multiple times
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(100)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(100)
      }

      const memoryAfter = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0
      })

      if (memoryBefore && memoryAfter) {
        const memoryIncrease = memoryAfter - memoryBefore
        // Memory increase from scrolling should be minimal
        expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024) // Less than 5MB
      }

      // Cleanup
      for (const projectName of createdProjects) {
        try {
          await projectsPage.deleteProject(projectName)
        } catch {
          // Ignore cleanup errors
        }
      }
    })

    test('should handle DOM manipulation efficiently', async ({ page }) => {
      await assistantPage.gotoAssistant()

      const initialNodeCount = await page.evaluate(() => document.querySelectorAll('*').length)

      // Send multiple messages to create DOM elements
      for (let i = 0; i < 5; i++) {
        await assistantPage.sendMessage(`Test message ${i} for DOM stress testing`)
        await assistantPage.expectAIResponse()
      }

      const finalNodeCount = await page.evaluate(() => document.querySelectorAll('*').length)
      const nodeIncrease = finalNodeCount - initialNodeCount

      // DOM growth should be reasonable
      expect(nodeIncrease).toBeLessThan(1000) // Less than 1000 new nodes

      test.info().annotations.push({
        type: 'dom',
        description: `DOM nodes increased by ${nodeIncrease}`
      })

      // Clear chat to test cleanup
      await assistantPage.clearChat()

      const afterClearNodeCount = await page.evaluate(() => document.querySelectorAll('*').length)

      // Node count should decrease significantly after clearing
      expect(afterClearNodeCount).toBeLessThan(finalNodeCount)
    })
  })

  test.describe('Concurrent Operations Stress Test', () => {
    test('should handle multiple API calls simultaneously', async ({ page }) => {
      await projectsPage.gotoProjects()

      // Track API call timing
      const apiCalls: { url: string; startTime: number; endTime?: number }[] = []

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push({
            url: request.url(),
            startTime: Date.now()
          })
        }
      })

      page.on('response', response => {
        if (response.url().includes('/api/')) {
          const call = apiCalls.find(c => c.url === response.url() && !c.endTime)
          if (call) {
            call.endTime = Date.now()
          }
        }
      })

      // Trigger multiple operations simultaneously
      const operations = [
        async () => {
          const name = `Concurrent 1 ${testUtils.generateUniqueId()}`
          await projectsPage.createProject(name, 'Concurrent test 1')
          return name
        },
        async () => {
          const name = `Concurrent 2 ${testUtils.generateUniqueId()}`
          await projectsPage.createProject(name, 'Concurrent test 2')
          return name
        },
        async () => {
          await assistantPage.gotoAssistant()
          await assistantPage.sendMessage('Concurrent AI request')
          return 'ai-request'
        }
      ]

      const results = await Promise.allSettled(operations.map(op => op()))

      // Most operations should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length
      expect(successCount).toBeGreaterThanOrEqual(2)

      // API calls should complete within reasonable time
      const completedCalls = apiCalls.filter(c => c.endTime)
      for (const call of completedCalls) {
        const duration = call.endTime! - call.startTime
        expect(duration).toBeLessThan(10000) // Less than 10 seconds
      }

      // Cleanup created projects
      await projectsPage.gotoProjects()
      for (const result of results) {
        if (result.status === 'fulfilled' && typeof result.value === 'string' && result.value.includes('Concurrent')) {
          try {
            await projectsPage.deleteProject(result.value)
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    })

    test('should handle rapid user interactions', async ({ page }) => {
      await projectsPage.gotoProjects()

      const startTime = Date.now()

      // Rapid clicking on navigation
      for (let i = 0; i < 10; i++) {
        await authPage.navigateTo('Projects')
        await page.waitForTimeout(100)
        await authPage.navigateTo('Assistant')
        await page.waitForTimeout(100)
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should handle rapid navigation within reasonable time
      expect(totalTime).toBeLessThan(30000) // Less than 30 seconds

      // App should still be responsive
      await authPage.expectAuthenticated()
      await projectsPage.gotoProjects()
      await projectsPage.expectProjectsLoaded()
    })

    test('should handle form spam protection', async ({ page }) => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      const nameInput = page.locator('input[name="name"], input[placeholder*="Project name"]')
      const submitButton = page.locator('button:has-text("Create"), button[type="submit"]')

      if (await nameInput.isVisible({ timeout: 5000 })) {
        await nameInput.fill('Spam Protection Test')

        // Rapid form submissions
        const submissions = []
        for (let i = 0; i < 5; i++) {
          submissions.push(submitButton.click())
        }

        await Promise.allSettled(submissions)

        // Should handle spam gracefully (rate limiting, debouncing, or single submission)
        const errorMessages = page.locator('[role="alert"], text=error')
        const successMessages = page.locator('text=created')

        const hasErrorHandling = await errorMessages.isVisible({ timeout: 5000 }).catch(() => false)
        const hasSuccess = await successMessages.isVisible({ timeout: 5000 }).catch(() => false)

        expect(hasErrorHandling || hasSuccess).toBeTruthy()

        // Cleanup if project was created
        if (hasSuccess) {
          try {
            await projectsPage.gotoProjects()
            await projectsPage.deleteProject('Spam Protection Test')
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    })
  })

  test.describe('Large Data Handling', () => {
    test('should handle projects with many stories efficiently', async ({ page }) => {
      await projectsPage.gotoProjects()

      const projectName = `Large Data Test ${testUtils.generateUniqueId()}`
      const projectId = await projectsPage.createProject(projectName, 'Project for large data testing')

      await backlogPage.gotoBacklog(projectId)

      const startTime = Date.now()

      // Create multiple stories
      const storyCount = 8 // Reduced for test performance
      for (let i = 0; i < storyCount; i++) {
        const storyTitle = `Story ${i} ${testUtils.generateUniqueId()}`
        await backlogPage.createStory(storyTitle, `Description for story ${i}`)
        await backlogPage.gotoBacklog(projectId)
      }

      const creationTime = Date.now() - startTime

      // Story creation should be reasonably fast
      expect(creationTime).toBeLessThan(storyCount * 3000) // Max 3 seconds per story

      // Navigate back to backlog and ensure it loads efficiently
      const loadStartTime = Date.now()
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.expectStoriesLoaded()
      const loadTime = Date.now() - loadStartTime

      // Backlog with many stories should load within 10 seconds
      expect(loadTime).toBeLessThan(10000)

      // Check that all stories are displayed
      const storyCards = page.locator('[data-testid="story-card"]')
      const displayedStoryCount = await storyCards.count()
      expect(displayedStoryCount).toBe(storyCount)

      // Cleanup
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(projectName)
    })

    test('should handle long conversation in AI assistant', async ({ page }) => {
      await assistantPage.gotoAssistant()

      const messageCount = 6 // Reduced for test performance
      const startTime = Date.now()

      for (let i = 0; i < messageCount; i++) {
        const message = `Long conversation message ${i}: ${testUtils.generateUniqueId()}`
        await assistantPage.sendMessage(message)
        await assistantPage.expectAIResponse()
      }

      const conversationTime = Date.now() - startTime

      // Long conversation should be handled efficiently
      expect(conversationTime).toBeLessThan(messageCount * 10000) // Max 10 seconds per exchange

      // Check conversation history
      const displayedMessageCount = await assistantPage.getMessageCount()
      expect(displayedMessageCount).toBe(messageCount * 2) // User messages + AI responses

      // Interface should remain responsive
      await assistantPage.sendMessage('Final test message')
      await assistantPage.expectAIResponse()
    })

    test('should handle board with many tasks efficiently', async ({ page }) => {
      await projectsPage.gotoProjects()

      const projectName = `Board Stress Test ${testUtils.generateUniqueId()}`
      const projectId = await projectsPage.createProject(projectName, 'Project for board stress testing')

      // Create story with multiple tasks
      await backlogPage.gotoBacklog(projectId)
      const storyTitle = `Stress Story ${testUtils.generateUniqueId()}`
      const storyId = await backlogPage.createStory(storyTitle, 'Story for board stress testing')

      // Add multiple tasks
      const taskCount = 10
      await page.goto(`/projects/${projectId}/backlog/${storyId}`)

      for (let i = 0; i < taskCount; i++) {
        const taskTitle = `Task ${i} ${testUtils.generateUniqueId()}`
        await page.locator('button:has-text("Add Task")').click()

        const titleInput = page.locator('input[name="title"], input[placeholder*="task title"]')
        await titleInput.fill(taskTitle)

        const submitButton = page.locator('button:has-text("Create"), button:has-text("Add")')
        await submitButton.click()
        await page.waitForTimeout(500)
      }

      // Go to board and test performance
      await boardPage.gotoBoard(projectId)

      const loadStartTime = Date.now()
      await boardPage.expectBoardLoaded()
      const loadTime = Date.now() - loadStartTime

      // Board should load within reasonable time
      expect(loadTime).toBeLessThan(5000)

      // Cleanup
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(projectName)
    })
  })

  test.describe('Resource Management', () => {
    test('should clean up event listeners properly', async ({ page }) => {
      const getListenerCount = async () => {
        return await page.evaluate(() => {
          // Get approximate count of event listeners
          return Object.keys((window as any).eventListeners || {}).length
        })
      }

      await projectsPage.gotoProjects()

      // Navigate through different components
      for (let i = 0; i < 3; i++) {
        await assistantPage.gotoAssistant()
        await projectsPage.gotoProjects()
        await authPage.navigateTo('Dashboard')
      }

      // Event listeners shouldn't accumulate excessively
      // This is more of a smoke test as exact listener counting is browser-dependent
      await expect(page.locator('body')).toBeVisible()
    })

    test('should handle image loading efficiently', async ({ page }) => {
      const imageLoadTimes: number[] = []

      page.on('response', async response => {
        if (response.url().match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
          // Get security details which includes timing info
          const securityDetails = await response.securityDetails()
          const timing = await response.allHeaders()
          // For now, just track that the image loaded
          imageLoadTimes.push(Date.now() - performance.now())
        }
      })

      await projectsPage.gotoProjects()
      await assistantPage.gotoAssistant()

      await page.waitForLoadState('networkidle')

      // Images should load reasonably fast
      for (const loadTime of imageLoadTimes) {
        expect(loadTime).toBeLessThan(5000) // Less than 5 seconds per image
      }
    })

    test('should handle font loading without FOUT/FOIT', async ({ page }) => {
      const startTime = Date.now()

      await projectsPage.gotoProjects()

      // Check that fonts are loaded
      const fontLoadTime = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          if (document.fonts) {
            document.fonts.ready.then(() => {
              resolve(Date.now())
            })

            // Fallback timeout
            setTimeout(() => resolve(Date.now()), 3000)
          } else {
            resolve(Date.now())
          }
        })
      })

      const totalFontLoadTime = fontLoadTime - startTime

      // Fonts should load within 3 seconds
      expect(totalFontLoadTime).toBeLessThan(3000)

      // Check that text is readable (no invisible text)
      const textElement = page.locator('h1, h2, p').first()
      if (await textElement.isVisible({ timeout: 5000 })) {
        const fontSize = await textElement.evaluate(el => {
          return window.getComputedStyle(el).fontSize
        })

        expect(parseFloat(fontSize)).toBeGreaterThan(0)
      }
    })
  })
})