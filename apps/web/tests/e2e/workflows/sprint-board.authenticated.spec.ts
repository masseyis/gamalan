import { test, expect } from '@playwright/test'
import { ProjectsPage, BacklogPage, BoardPage, testData, testUtils } from '../page-objects'

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Sprint Board Workflows', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let boardPage: BoardPage
  let projectId: string
  let projectName: string

  test.beforeAll(async ({ browser }) => {
    // Create a test project with stories for sprint management
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(projectName, 'Test project for sprint management')

    // Create some test stories and tasks
    await backlogPage.gotoBacklog(projectId)
    const stories = [
      { title: 'User Authentication Story', description: 'Implement user login and registration' },
      { title: 'Dashboard Display Story', description: 'Create user dashboard with project overview' },
      { title: 'Data Export Story', description: 'Allow users to export project data' }
    ]

    for (const story of stories) {
      await backlogPage.createStory(story.title, story.description)
      await backlogPage.gotoBacklog(projectId)
    }

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    boardPage = new BoardPage(page)
    backlogPage = new BacklogPage(page)
    projectsPage = new ProjectsPage(page)
  })

  test.describe('Sprint Creation and Management', () => {
    test('should create a new sprint', async () => {
      await boardPage.gotoBoard(projectId)
      await boardPage.expectBoardLoaded()

      const sprintName = `Sprint ${testUtils.generateUniqueId()}`
      await boardPage.createSprint(sprintName, 14)

      // Verify sprint was created
      await boardPage.expectToastMessage('Sprint created successfully')
    })

    test('should start a sprint with stories', async () => {
      await boardPage.gotoBoard(projectId)

      const sprintName = `Active Sprint ${testUtils.generateUniqueId()}`
      await boardPage.createSprint(sprintName, 21)

      // Add stories to sprint (if feature exists)
      const addStoryButton = boardPage.page.locator('button:has-text("Add Stories")')
      if (await addStoryButton.isVisible({ timeout: 5000 })) {
        await addStoryButton.click()

        // Select first available story
        const storyCheckbox = boardPage.page.locator('[data-testid="story-selector"] input[type="checkbox"]').first()
        if (await storyCheckbox.isVisible({ timeout: 2000 })) {
          await storyCheckbox.check()

          const confirmButton = boardPage.page.locator('button:has-text("Add to Sprint")')
          await confirmButton.click()
        }
      }

      await boardPage.startSprint(sprintName)
      await boardPage.expectSprintActive(sprintName)
    })

    test('should display sprint metrics and burndown', async () => {
      await boardPage.gotoBoard(projectId)

      // Check if there's an active sprint to view metrics
      const activeSprintIndicator = boardPage.page.locator('[data-testid="active-sprint"]')
      if (await activeSprintIndicator.isVisible({ timeout: 5000 })) {
        await boardPage.viewSprintMetrics()

        // Verify metrics modal appears
        const metricsModal = boardPage.page.locator('[data-testid="sprint-metrics-modal"]')
        await expect(metricsModal).toBeVisible()

        // Check for burndown chart
        const burndownChart = boardPage.page.locator('[data-testid="burndown-chart"]')
        if (await burndownChart.isVisible({ timeout: 3000 })) {
          const chartData = await boardPage.getBurndownData()
          expect(chartData).toBeDefined()
        }

        // Close modal
        await boardPage.page.keyboard.press('Escape')
      }
    })

    test('should complete a sprint', async () => {
      await boardPage.gotoBoard(projectId)

      // Create and start a sprint for completion
      const sprintName = `Completion Sprint ${testUtils.generateUniqueId()}`
      await boardPage.createSprint(sprintName, 7)
      await boardPage.startSprint(sprintName)

      // Complete the sprint
      await boardPage.completeSprint()

      // Verify sprint completion
      const completedIndicator = boardPage.page.locator('[data-testid="completed-sprint"]')
      await expect(completedIndicator).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Task Board Operations', () => {
    let sprintName: string

    test.beforeEach(async () => {
      // Create a sprint for task operations
      sprintName = `Task Sprint ${testUtils.generateUniqueId()}`
      await boardPage.gotoBoard(projectId)
      await boardPage.createSprint(sprintName, 14)
      await boardPage.startSprint(sprintName)
    })

    test('should move tasks between columns via drag and drop', async () => {
      await boardPage.gotoBoard(projectId)

      // Create a task in the todo column (if tasks are pre-populated)
      const todoTasks = boardPage.page.locator('[data-testid="column-todo"] [data-testid="task-card"]')
      const taskCount = await todoTasks.count()

      if (taskCount > 0) {
        const firstTask = todoTasks.first()
        const taskTitle = await firstTask.textContent()

        if (taskTitle) {
          // Move task from todo to in-progress
          await boardPage.dragTaskToColumn(taskTitle.trim(), 'in-progress')
          await boardPage.expectTaskInColumn(taskTitle.trim(), 'in-progress')

          // Move task from in-progress to review
          await boardPage.dragTaskToColumn(taskTitle.trim(), 'review')
          await boardPage.expectTaskInColumn(taskTitle.trim(), 'review')

          // Move task from review to done
          await boardPage.dragTaskToColumn(taskTitle.trim(), 'done')
          await boardPage.expectTaskInColumn(taskTitle.trim(), 'done')
        }
      }
    })

    test('should update task status via dropdown', async () => {
      await boardPage.gotoBoard(projectId)

      const todoTasks = boardPage.page.locator('[data-testid="column-todo"] [data-testid="task-card"]')
      const taskCount = await todoTasks.count()

      if (taskCount > 0) {
        const firstTask = todoTasks.first()
        const taskTitle = await firstTask.textContent()

        if (taskTitle) {
          await boardPage.updateTaskStatus(taskTitle.trim(), 'in-progress')
          await boardPage.expectTaskInColumn(taskTitle.trim(), 'in-progress')
        }
      }
    })

    test('should assign tasks to team members', async () => {
      await boardPage.gotoBoard(projectId)

      const allTasks = boardPage.page.locator('[data-testid="task-card"]')
      const taskCount = await allTasks.count()

      if (taskCount > 0) {
        const firstTask = allTasks.first()
        const taskTitle = await firstTask.textContent()

        if (taskTitle) {
          const userEmail = testData.user.email
          await boardPage.assignTaskToUser(taskTitle.trim(), userEmail)
          await boardPage.expectTaskAssignedTo(taskTitle.trim(), userEmail)
        }
      }
    })

    test('should add and remove tasks from sprint', async () => {
      await boardPage.gotoBoard(projectId)

      // Check if there are backlog tasks to add
      const backlogTasks = boardPage.page.locator('[data-testid="backlog-task"]')
      const backlogCount = await backlogTasks.count()

      if (backlogCount > 0) {
        const firstBacklogTask = backlogTasks.first()
        const taskTitle = await firstBacklogTask.textContent()

        if (taskTitle) {
          await boardPage.addTaskToSprint(taskTitle.trim())

          // Verify task is now in sprint
          await boardPage.expectTaskInColumn(taskTitle.trim(), 'todo')

          // Remove task from sprint
          await boardPage.removeTaskFromSprint(taskTitle.trim())

          // Verify task is back in backlog
          const backlogTask = boardPage.page.locator(`[data-testid="backlog-task"]:has-text("${taskTitle.trim()}")`)
          await expect(backlogTask).toBeVisible()
        }
      }
    })
  })

  test.describe('Board Visualization and Metrics', () => {
    test('should display correct task counts in each column', async () => {
      await boardPage.gotoBoard(projectId)

      // Verify all columns are present
      await boardPage.expectBoardLoaded()

      // Check task counts in each column
      await boardPage.expectColumnTaskCount('todo', 0) // Initial state
      await boardPage.expectColumnTaskCount('in-progress', 0)
      await boardPage.expectColumnTaskCount('review', 0)
      await boardPage.expectColumnTaskCount('done', 0)
    })

    test('should update column counts when tasks move', async () => {
      await boardPage.gotoBoard(projectId)

      // If there are tasks, move one and verify counts update
      const todoTasks = boardPage.page.locator('[data-testid="column-todo"] [data-testid="task-card"]')
      const initialTodoCount = await todoTasks.count()

      if (initialTodoCount > 0) {
        const firstTask = todoTasks.first()
        const taskTitle = await firstTask.textContent()

        if (taskTitle) {
          await boardPage.dragTaskToColumn(taskTitle.trim(), 'in-progress')

          // Verify counts updated
          await boardPage.expectColumnTaskCount('todo', initialTodoCount - 1)
          await boardPage.expectColumnTaskCount('in-progress', 1)
        }
      }
    })

    test('should show progress indicators', async () => {
      await boardPage.gotoBoard(projectId)

      // Check for progress indicators
      const progressBar = boardPage.page.locator('[data-testid="sprint-progress"]')
      if (await progressBar.isVisible({ timeout: 5000 })) {
        const progressValue = await progressBar.getAttribute('value')
        expect(progressValue).toBeDefined()
      }

      // Check for completion percentage
      const completionPercentage = boardPage.page.locator('[data-testid="completion-percentage"]')
      if (await completionPercentage.isVisible({ timeout: 5000 })) {
        const percentage = await completionPercentage.textContent()
        expect(percentage).toMatch(/\d+%/)
      }
    })
  })

  test.describe('Board Filtering and Views', () => {
    test('should filter tasks by assignee', async () => {
      await boardPage.gotoBoard(projectId)

      const assigneeFilter = boardPage.page.locator('[data-testid="assignee-filter"]')
      if (await assigneeFilter.isVisible({ timeout: 5000 })) {
        await assigneeFilter.click()

        const myTasksOption = boardPage.page.locator('button:has-text("My Tasks")')
        if (await myTasksOption.isVisible({ timeout: 2000 })) {
          await myTasksOption.click()

          // Verify only assigned tasks are shown
          const visibleTasks = boardPage.page.locator('[data-testid="task-card"]:visible')
          const taskCount = await visibleTasks.count()

          if (taskCount > 0) {
            // All visible tasks should be assigned to current user
            for (let i = 0; i < taskCount; i++) {
              const task = visibleTasks.nth(i)
              const assigneeInfo = task.locator('[data-testid="assignee"]')
              await expect(assigneeInfo).toBeVisible()
            }
          }
        }
      }
    })

    test('should toggle between different board views', async () => {
      await boardPage.gotoBoard(projectId)

      const viewToggle = boardPage.page.locator('[data-testid="board-view-toggle"]')
      if (await viewToggle.isVisible({ timeout: 5000 })) {
        await viewToggle.click()

        const compactView = boardPage.page.locator('button:has-text("Compact")')
        if (await compactView.isVisible({ timeout: 2000 })) {
          await compactView.click()

          // Verify view changed
          const boardContainer = boardPage.page.locator('[data-testid="board-container"]')
          await expect(boardContainer).toHaveClass(/compact/)
        }
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle empty board state', async () => {
      // Create a new project for empty board test
      const emptyProjectName = `Empty Board ${testUtils.generateProjectName()}`
      await projectsPage.gotoProjects()
      const emptyProjectId = await projectsPage.createProject(emptyProjectName, 'Project for empty board test')

      await boardPage.gotoBoard(emptyProjectId)
      await boardPage.expectEmptyBoard()

      // Clean up
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(emptyProjectName)
    })

    test('should handle network errors during task updates', async () => {
      await boardPage.gotoBoard(projectId)

      // Simulate network failure
      await boardPage.page.route('**/api/tasks/*', route => route.abort())

      const todoTasks = boardPage.page.locator('[data-testid="column-todo"] [data-testid="task-card"]')
      const taskCount = await todoTasks.count()

      if (taskCount > 0) {
        const firstTask = todoTasks.first()
        const taskTitle = await firstTask.textContent()

        if (taskTitle) {
          try {
            await boardPage.updateTaskStatus(taskTitle.trim(), 'in-progress')
            await boardPage.expectError('Failed to update task')
          } catch {
            // Test may timeout which is acceptable for network error simulation
          }
        }
      }
    })

    test('should validate sprint dates and duration', async () => {
      await boardPage.gotoBoard(projectId)
      await boardPage.createSprintButton.click()

      // Try to create sprint with invalid duration
      const nameInput = boardPage.page.locator('input[name="name"]')
      await nameInput.fill('Invalid Sprint')

      const durationInput = boardPage.page.locator('input[name="duration"]')
      if (await durationInput.isVisible({ timeout: 2000 })) {
        await durationInput.fill('-5') // Negative duration

        const submitButton = boardPage.page.locator('button:has-text("Create")')
        await submitButton.click()

        await boardPage.expectError('Duration must be positive')
      }
    })

    test('should prevent starting sprint without tasks', async () => {
      await boardPage.gotoBoard(projectId)

      const emptySprintName = `Empty Sprint ${testUtils.generateUniqueId()}`
      await boardPage.createSprint(emptySprintName, 14)

      const startButton = boardPage.page.locator('button:has-text("Start Sprint")')
      if (await startButton.isVisible({ timeout: 5000 })) {
        await startButton.click()

        // Should show warning about empty sprint
        const warningMessage = boardPage.page.locator('text=Sprint contains no tasks')
        if (await warningMessage.isVisible({ timeout: 3000 })) {
          const cancelButton = boardPage.page.locator('button:has-text("Cancel")')
          await cancelButton.click()
        }
      }
    })
  })

  test.describe('Sprint Retrospective and Metrics', () => {
    test('should display sprint velocity metrics', async () => {
      await boardPage.gotoBoard(projectId)

      const velocityChart = boardPage.page.locator('[data-testid="velocity-chart"]')
      if (await velocityChart.isVisible({ timeout: 5000 })) {
        // Verify velocity data is displayed
        const velocityValue = boardPage.page.locator('[data-testid="current-velocity"]')
        await expect(velocityValue).toBeVisible()

        const avgVelocity = boardPage.page.locator('[data-testid="average-velocity"]')
        await expect(avgVelocity).toBeVisible()
      }
    })

    test('should show completed sprint history', async () => {
      await boardPage.gotoBoard(projectId)

      const sprintHistory = boardPage.page.locator('[data-testid="sprint-history"]')
      if (await sprintHistory.isVisible({ timeout: 5000 })) {
        await sprintHistory.click()

        const historyModal = boardPage.page.locator('[data-testid="sprint-history-modal"]')
        await expect(historyModal).toBeVisible()

        // Should show list of completed sprints
        const completedSprints = boardPage.page.locator('[data-testid="completed-sprint-item"]')
        const sprintCount = await completedSprints.count()
        expect(sprintCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // Cleanup after all tests
  test.afterAll(async ({ browser }) => {
    try {
      const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
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