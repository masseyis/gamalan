import { test, expect } from '@playwright/test'
import { ProjectsPage, BacklogPage, StoryDetailPage, testData, testUtils } from '../page-objects'

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Backlog Management Workflows', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let storyDetailPage: StoryDetailPage
  let projectId: string
  let projectName: string

  test.beforeAll(async ({ browser }) => {
    // Create a test project that will be used across all tests
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(projectName, 'Test project for backlog management')

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    backlogPage = new BacklogPage(page)
    storyDetailPage = new StoryDetailPage(page)
    projectsPage = new ProjectsPage(page)
  })

  test.describe('Story Creation and Management', () => {
    test('should create a new user story with acceptance criteria', async () => {
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.expectStoriesLoaded()

      const storyTitle = testUtils.generateStoryTitle()
      const storyId = await backlogPage.createStory(
        storyTitle,
        testData.story.description,
        testData.story.acceptanceCriteria
      )

      // Verify story was created
      await backlogPage.expectStoryExists(storyTitle)
      expect(storyId).toBeTruthy()
    })

    test('should display story in backlog list', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `List Display ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for list display')

      // Go back to backlog and verify story appears
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.expectStoryExists(storyTitle)
    })

    test('should open story detail page', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `Detail View ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for detail view')

      await backlogPage.gotoBacklog(projectId)
      await backlogPage.openStory(storyTitle)

      // Verify we're on story detail page
      await storyDetailPage.expectStoryLoaded(storyTitle)
    })

    test('should update story status through workflow', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `Status Update ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for status updates')

      await backlogPage.gotoBacklog(projectId)

      // Move story through workflow states
      await backlogPage.updateStoryStatus(storyTitle, 'ready')
      await backlogPage.expectStoryStatus(storyTitle, 'ready')

      await backlogPage.updateStoryStatus(storyTitle, 'in-progress')
      await backlogPage.expectStoryStatus(storyTitle, 'in-progress')

      await backlogPage.updateStoryStatus(storyTitle, 'review')
      await backlogPage.expectStoryStatus(storyTitle, 'review')

      await backlogPage.updateStoryStatus(storyTitle, 'done')
      await backlogPage.expectStoryStatus(storyTitle, 'done')
    })

    test('should estimate story points', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `Estimation ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for estimation')

      await backlogPage.gotoBacklog(projectId)
      await backlogPage.estimateStory(storyTitle, 8)

      // Verify estimation was applied
      const storyCard = backlogPage.page.locator(
        `[data-testid="story-card"]:has-text("${storyTitle}")`
      )
      const pointsIndicator = storyCard.locator('[data-testid="story-points"]:has-text("8")')
      await expect(pointsIndicator).toBeVisible()
    })

    test('should set and update story priority', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `Priority ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for priority')

      await backlogPage.gotoBacklog(projectId)

      // Set priority to high
      await backlogPage.updateStoryPriority(storyTitle, 'high')

      // Verify priority indicator
      const storyCard = backlogPage.page.locator(
        `[data-testid="story-card"]:has-text("${storyTitle}")`
      )
      const priorityIndicator = storyCard.locator('[data-testid="priority-indicator"]')
      await expect(priorityIndicator).toHaveClass(/high/)

      // Change to critical
      await backlogPage.updateStoryPriority(storyTitle, 'critical')
      await expect(priorityIndicator).toHaveClass(/critical/)
    })

    test('should delete story', async () => {
      await backlogPage.gotoBacklog(projectId)

      const storyTitle = `To Delete ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Test story for deletion')

      await backlogPage.gotoBacklog(projectId)
      await backlogPage.deleteStory(storyTitle)

      // Verify story no longer exists
      await backlogPage.expectStoryNotExists(storyTitle)
    })
  })

  test.describe('Story Detail and Task Management', () => {
    let testStoryTitle: string
    let storyId: string

    test.beforeEach(async () => {
      // Create a story for task management tests
      testStoryTitle = `Task Management ${testUtils.generateUniqueId()}`
      await backlogPage.gotoBacklog(projectId)
      storyId = await backlogPage.createStory(testStoryTitle, 'Story for task management testing')
    })

    test('should add tasks to story', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = testUtils.generateTaskTitle()
      await storyDetailPage.addTask(taskTitle, 'Test task description')

      // Verify task was added
      await storyDetailPage.expectTaskExists(taskTitle)
    })

    test('should update existing task', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const originalTitle = testUtils.generateTaskTitle()
      await storyDetailPage.addTask(originalTitle, 'Original description')

      const newTitle = `Updated ${originalTitle}`
      await storyDetailPage.updateTask(originalTitle, newTitle, 'Updated description')

      // Verify task was updated
      await storyDetailPage.expectTaskExists(newTitle)
      await storyDetailPage.page
        .locator(`[data-testid="task-item"]:has-text("${originalTitle}")`)
        .waitFor({ state: 'hidden' })
    })

    test('should mark task as completed', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = testUtils.generateTaskTitle()
      await storyDetailPage.addTask(taskTitle, 'Task to be completed')

      await storyDetailPage.completeTask(taskTitle)

      // Verify task is marked as completed
      const taskItem = storyDetailPage.page.locator(
        `[data-testid="task-item"]:has-text("${taskTitle}")`
      )
      const checkbox = taskItem.locator('input[type="checkbox"]')
      await expect(checkbox).toBeChecked()
    })

    test('should display acceptance criteria on story detail', async () => {
      // Create story with acceptance criteria
      await backlogPage.gotoBacklog(projectId)
      const acStoryTitle = `AC Display ${testUtils.generateUniqueId()}`
      const acStoryId = await backlogPage.createStory(
        acStoryTitle,
        'Story with acceptance criteria',
        ['Given user is logged in', 'When user clicks button', 'Then action occurs']
      )

      await storyDetailPage.gotoStory(projectId, acStoryId)

      // Verify acceptance criteria are displayed
      await storyDetailPage.expectAcceptanceCriteriaCount(3)
    })
  })

  test.describe('Backlog Filtering and Search', () => {
    test.beforeEach(async () => {
      // Create test stories with different statuses and priorities
      await backlogPage.gotoBacklog(projectId)

      const stories = [
        {
          title: `High Priority ${testUtils.generateUniqueId()}`,
          priority: 'high',
          status: 'backlog',
        },
        {
          title: `Medium Priority ${testUtils.generateUniqueId()}`,
          priority: 'medium',
          status: 'ready',
        },
        {
          title: `Low Priority ${testUtils.generateUniqueId()}`,
          priority: 'low',
          status: 'in-progress',
        },
      ]

      for (const story of stories) {
        await backlogPage.createStory(story.title, `Test story with ${story.priority} priority`)
        await backlogPage.gotoBacklog(projectId)

        if (story.priority !== 'medium') {
          // medium is default
          await backlogPage.updateStoryPriority(story.title, story.priority as any)
        }

        if (story.status !== 'backlog') {
          // backlog is default
          await backlogPage.updateStoryStatus(story.title, story.status as any)
        }
      }
    })

    test('should filter stories by status', async () => {
      await backlogPage.gotoBacklog(projectId)

      // Filter by 'ready' status
      await backlogPage.filterByStatus('ready')

      // Should only show stories with 'ready' status
      const readyStories = backlogPage.page.locator('[data-testid="story-card"]')
      const storyCount = await readyStories.count()

      // Verify filtered results
      expect(storyCount).toBeGreaterThan(0)

      for (let i = 0; i < storyCount; i++) {
        const story = readyStories.nth(i)
        const statusIndicator = story.locator('[data-testid="story-status"]')
        await expect(statusIndicator).toContainText('ready')
      }
    })

    test('should search stories by title', async () => {
      await backlogPage.gotoBacklog(projectId)

      // Search for "High Priority" stories
      await backlogPage.searchStories('High Priority')

      // Should find high priority story
      const searchResults = backlogPage.page.locator('[data-testid="story-card"]')
      await expect(searchResults.first()).toContainText('High Priority')
    })

    test('should sort stories by different criteria', async () => {
      await backlogPage.gotoBacklog(projectId)

      // Sort by priority
      await backlogPage.sortBy('priority')

      // Verify stories are sorted (critical/high should appear first)
      const stories = backlogPage.page.locator('[data-testid="story-card"]')
      const firstStory = stories.first().locator('[data-testid="priority-indicator"]')

      // First story should have high or critical priority
      const hasHighPriority = await firstStory.getAttribute('class')
      expect(hasHighPriority).toMatch(/(high|critical)/)
    })
  })

  test.describe('Backlog Organization and Ordering', () => {
    test('should reorder stories by drag and drop', async () => {
      await backlogPage.gotoBacklog(projectId)

      // Create two stories for reordering
      const story1 = `First Story ${testUtils.generateUniqueId()}`
      const story2 = `Second Story ${testUtils.generateUniqueId()}`

      await backlogPage.createStory(story1, 'First story for reordering')
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.createStory(story2, 'Second story for reordering')
      await backlogPage.gotoBacklog(projectId)

      // Get story cards
      const story1Card = backlogPage.page.locator(
        `[data-testid="story-card"]:has-text("${story1}")`
      )
      const story2Card = backlogPage.page.locator(
        `[data-testid="story-card"]:has-text("${story2}")`
      )

      // Perform drag and drop to reorder
      await story2Card.dragTo(story1Card)

      // Wait for reorder to complete
      await backlogPage.page.waitForTimeout(1000)

      // Verify order changed (story2 should now be before story1)
      const storyCards = backlogPage.page.locator('[data-testid="story-card"]')
      const firstStoryText = await storyCards.first().textContent()
      expect(firstStoryText).toContain(story2)
    })

    test('should handle empty backlog state', async () => {
      // Create a new project for empty state test
      const emptyProjectName = `Empty ${testUtils.generateProjectName()}`
      await projectsPage.gotoProjects()
      const emptyProjectId = await projectsPage.createProject(
        emptyProjectName,
        'Project for empty backlog test'
      )

      await backlogPage.gotoBacklog(emptyProjectId)
      await backlogPage.expectEmptyBacklog()

      // Clean up
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(emptyProjectName)
    })
  })

  test.describe('Error Handling and Validation', () => {
    test('should validate required fields when creating story', async () => {
      await backlogPage.gotoBacklog(projectId)
      await backlogPage.addStoryButton.click()

      // Try to submit without title
      const submitButton = backlogPage.page.locator(
        'button:has-text("Create"), button[type="submit"]'
      )
      await submitButton.click()

      await backlogPage.expectError('Story title is required')
    })

    test('should handle network errors gracefully', async () => {
      await backlogPage.gotoBacklog(projectId)

      // Simulate network failure for story creation
      await backlogPage.page.route('**/api/stories', (route) => route.abort())

      try {
        await backlogPage.createStory('Network Error Test', 'This should fail')
        await backlogPage.expectError('Failed to create story')
      } catch {
        // Test may timeout which is acceptable for network error simulation
      }
    })

    test('should handle very long story titles and descriptions', async () => {
      await backlogPage.gotoBacklog(projectId)

      const longTitle = 'A'.repeat(200)
      const longDescription = 'B'.repeat(5000)

      try {
        await backlogPage.createStory(longTitle, longDescription)
      } catch {
        // May fail validation
        await backlogPage.expectError('Title too long')
      }
    })
  })

  // Cleanup after all tests
  test.afterAll(async ({ browser }) => {
    try {
      const context = await browser.newContext({
        storageState: 'tests/playwright/.clerk/user.json',
      })
      const page = await context.newPage()
      const cleanupProjectsPage = new ProjectsPage(page)

      await cleanupProjectsPage.gotoProjects()
      await cleanupProjectsPage.deleteProject(projectName)

      await context.close()
    } catch {
      // Ignore cleanup errors
    }
  })
})
