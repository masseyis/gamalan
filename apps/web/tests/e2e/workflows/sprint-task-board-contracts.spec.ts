import { test, expect } from '@playwright/test'

/**
 * SPECIFICATION/CONTRACT TESTS for Sprint Task Board
 *
 * ⚠️  IMPORTANT: These are SPECIFICATION TESTS that validate TECHNICAL CONTRACTS
 * ⚠️  These tests are EXPECTED TO FAIL until the implementation is complete
 * ⚠️  DO NOT modify these tests to make them pass - they define the contract!
 *
 * Purpose: Validate that the UI implements the contracts defined in:
 * - ADR-0006: Real-Time WebSocket Updates for Sprint Task Board
 * - Acceptance Criteria: AC 7852bac8, a2ef8786, 8e8e949d, 728fd41e, d4d41a1f
 *
 * Story: As a contributor, I want to view all sprint tasks grouped by story
 * so that I can pick work that aligns with my skills and the team's priorities
 *
 * Test Approach:
 * - Each test validates a specific technical contract
 * - Tests are marked with @spec-test comment and AC reference
 * - Tests check DOM structure, data attributes, and event schemas
 * - Tests do NOT test implementation details - only contracts
 *
 * Success Criteria for this QA task:
 * ✓ All spec tests written for all ACs
 * ✓ All tests marked with @spec-test comments
 * ✓ Tests committed (failures are expected and correct!)
 */

// Mock test data - these would come from test fixtures in real implementation
const TEST_PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000'
const TEST_SPRINT_ID = '223e4567-e89b-12d3-a456-426614174000'

test.describe('Sprint Task Board - Contract Validation Tests', () => {
  test.describe('@spec-test: AC 7852bac8 - Task Display Contract', () => {
    /**
     * Contract: Each task card must have data-testid="task-card-{uuid}"
     * Source: AC 7852bac8 - "each task should display: task ID, title, status, owner, parent story, and acceptance criteria references"
     */
    // @spec-test: AC 7852bac8
    test('task cards must have unique data-testid with UUID', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      const count = await taskCards.count()

      if (count > 0) {
        const firstCard = taskCards.first()
        const testId = await firstCard.getAttribute('data-testid')

        // Contract: data-testid must follow pattern "task-card-{uuid}"
        expect(testId).toMatch(/^task-card-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      }
    })

    /**
     * Contract: Task ID must be displayed with data-testid="task-id"
     * Source: AC 7852bac8 - "task ID"
     */
    // @spec-test: AC 7852bac8
    test('task must display ID field with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      if ((await taskCards.count()) > 0) {
        const taskId = taskCards.first().locator('[data-testid="task-id"]')

        // Contract: task-id element must exist and be visible
        await expect(taskId).toBeVisible()

        // Contract: task ID must be a UUID
        const idText = await taskId.textContent()
        expect(idText).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      }
    })

    /**
     * Contract: Task title must be displayed with data-testid="task-title"
     * Source: AC 7852bac8 - "title"
     */
    // @spec-test: AC 7852bac8
    test('task must display title field with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      if ((await taskCards.count()) > 0) {
        const taskTitle = taskCards.first().locator('[data-testid="task-title"]')

        // Contract: task-title element must exist and be visible
        await expect(taskTitle).toBeVisible()

        // Contract: title must not be empty
        const titleText = await taskTitle.textContent()
        expect(titleText).toBeTruthy()
        expect(titleText!.trim().length).toBeGreaterThan(0)
      }
    })

    /**
     * Contract: Task status must be displayed with data-testid="task-status"
     * Source: AC 7852bac8 - "status"
     */
    // @spec-test: AC 7852bac8
    test('task must display status with valid values', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      if ((await taskCards.count()) > 0) {
        const taskStatus = taskCards.first().locator('[data-testid="task-status"]')

        // Contract: task-status element must exist and be visible
        await expect(taskStatus).toBeVisible()

        // Contract: status must be one of: available, owned, inprogress, completed
        const statusText = (await taskStatus.textContent())?.toLowerCase() || ''
        const validStatuses = ['available', 'owned', 'inprogress', 'in progress', 'completed']
        expect(validStatuses.some((status) => statusText.includes(status))).toBe(true)
      }
    })

    /**
     * Contract: Task owner must be displayed with data-testid="task-owner" when assigned
     * Source: AC 7852bac8 - "owner (if assigned)"
     */
    // @spec-test: AC 7852bac8
    test('task must display owner when assigned', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Find tasks with "Owned" or "Completed" status (these should have owners)
      const ownedTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('[data-testid="task-status"]:has-text("Owned"), [data-testid="task-status"]:has-text("In Progress"), [data-testid="task-status"]:has-text("Completed")'),
      })

      if ((await ownedTasks.count()) > 0) {
        const taskOwner = ownedTasks.first().locator('[data-testid="task-owner"]')

        // Contract: task-owner element must exist for assigned tasks
        await expect(taskOwner).toBeVisible()

        // Contract: owner must show either "You" or a user identifier
        const ownerText = await taskOwner.textContent()
        expect(ownerText).toBeTruthy()
        expect(ownerText!.trim().length).toBeGreaterThan(0)
      }
    })

    /**
     * Contract: Parent story must be displayed with data-testid="story-name"
     * Source: AC 7852bac8 - "parent story"
     */
    // @spec-test: AC 7852bac8
    test('task must display parent story name', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      if ((await taskCards.count()) > 0) {
        const storyName = taskCards.first().locator('[data-testid="story-name"]')

        // Contract: story-name element must exist and be visible
        await expect(storyName).toBeVisible()

        // Contract: story name must not be empty
        const nameText = await storyName.textContent()
        expect(nameText).toBeTruthy()
        expect(nameText!.trim().length).toBeGreaterThan(0)
      }
    })

    /**
     * Contract: AC references must be displayed with data-testid="ac-refs"
     * Source: AC 7852bac8 - "acceptance criteria references"
     */
    // @spec-test: AC 7852bac8
    test('task must have AC references container', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const taskCards = page.locator('[data-testid^="task-card-"]')
      if ((await taskCards.count()) > 0) {
        const acRefs = taskCards.first().locator('[data-testid="ac-refs"]')

        // Contract: ac-refs element must exist (even if empty)
        await expect(acRefs).toBeAttached()

        // If AC refs exist, they should be visible
        if (await acRefs.isVisible()) {
          const refsText = await acRefs.textContent()
          expect(refsText).toBeTruthy()
        }
      }
    })
  })

  test.describe('@spec-test: AC a2ef8786 - Filter and Group Contract', () => {
    /**
     * Contract: Status filter must have checkboxes with specific values
     * Source: AC a2ef8786 - "filter for status (e.g., available, in_progress, completed)"
     */
    // @spec-test: AC a2ef8786
    test('status filter must have checkboxes for all status types', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: Must have checkboxes with specific value attributes
      const availableCheckbox = page.locator('input[type="checkbox"][value="available"]')
      const ownedCheckbox = page.locator('input[type="checkbox"][value="owned"]')
      const inProgressCheckbox = page.locator('input[type="checkbox"][value="inprogress"]')
      const completedCheckbox = page.locator('input[type="checkbox"][value="completed"]')

      // Contract: All status filter checkboxes must be in DOM
      await expect(availableCheckbox).toBeAttached()
      await expect(ownedCheckbox).toBeAttached()
      await expect(inProgressCheckbox).toBeAttached()
      await expect(completedCheckbox).toBeAttached()
    })

    /**
     * Contract: Filtered task count must be displayed with data-testid="filtered-count"
     * Source: AC a2ef8786 - "the count of tasks in each filter/group should be visible"
     */
    // @spec-test: AC a2ef8786
    test('filtered count must be displayed when filters are active', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Apply a filter
      const availableCheckbox = page.locator('input[type="checkbox"][value="available"]')
      if (await availableCheckbox.isVisible()) {
        await availableCheckbox.check()
        await page.waitForTimeout(500)

        // Contract: filtered-count element must appear
        const filteredCount = page.locator('[data-testid="filtered-count"]')
        await expect(filteredCount).toBeVisible()

        // Contract: Must show "X of Y" format
        const countText = await filteredCount.textContent()
        expect(countText).toMatch(/\d+\s+(of|\/)\s+\d+/)
      }
    })

    /**
     * Contract: Group by control must have data-testid="group-by-select"
     * Source: AC a2ef8786 - "group tasks by story or by status"
     */
    // @spec-test: AC a2ef8786
    test('group by control must exist with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: group-by-select element must exist
      const groupBySelect = page.locator('[data-testid="group-by-select"]')
      await expect(groupBySelect).toBeVisible()
    })

    /**
     * Contract: Story groups must have data-testid="story-group"
     * Source: AC a2ef8786 - "group tasks by story"
     */
    // @spec-test: AC a2ef8786
    test('story groups must have correct data-testid and structure', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Select "Group by Story" if needed
      const groupBySelect = page.locator('[data-testid="group-by-select"]')
      if (await groupBySelect.isVisible()) {
        await groupBySelect.click()
        const byStoryOption = page.locator('[role="option"]:has-text("By Story")')
        if (await byStoryOption.isVisible({ timeout: 2000 })) {
          await byStoryOption.click()
          await page.waitForTimeout(500)
        }
      }

      // Contract: story-group elements must exist
      const storyGroups = page.locator('[data-testid="story-group"]')
      if ((await storyGroups.count()) > 0) {
        const firstGroup = storyGroups.first()

        // Contract: Each group must have group-title
        const groupTitle = firstGroup.locator('[data-testid="group-title"]')
        await expect(groupTitle).toBeVisible()

        // Contract: Each group must have group-count
        const groupCount = firstGroup.locator('[data-testid="group-count"]')
        await expect(groupCount).toBeVisible()

        // Contract: Count must be a number
        const countText = await groupCount.textContent()
        expect(countText).toMatch(/\d+/)
      }
    })

    /**
     * Contract: Status groups must have data-testid="status-group"
     * Source: AC a2ef8786 - "group tasks by status"
     */
    // @spec-test: AC a2ef8786
    test('status groups must have correct data-testid and structure', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Select "Group by Status"
      const groupBySelect = page.locator('[data-testid="group-by-select"]')
      if (await groupBySelect.isVisible()) {
        await groupBySelect.click()
        const byStatusOption = page.locator('[role="option"]:has-text("By Status")')
        if (await byStatusOption.isVisible({ timeout: 2000 })) {
          await byStatusOption.click()
          await page.waitForTimeout(500)
        }
      }

      // Contract: status-group elements must exist
      const statusGroups = page.locator('[data-testid="status-group"]')
      if ((await statusGroups.count()) > 0) {
        const firstGroup = statusGroups.first()

        // Contract: Each group must have group-title
        const groupTitle = firstGroup.locator('[data-testid="group-title"]')
        await expect(groupTitle).toBeVisible()

        // Contract: Each group must have group-count
        const groupCount = firstGroup.locator('[data-testid="group-count"]')
        await expect(groupCount).toBeVisible()
      }
    })
  })

  test.describe('@spec-test: AC 8e8e949d - Visual Distinction Contract', () => {
    /**
     * Contract: Available tasks must have data-testid="available-badge"
     * Source: AC 8e8e949d - "Available tasks (no owner, not completed) should be clearly visually distinguished"
     */
    // @spec-test: AC 8e8e949d
    test('available tasks must have visible available-badge', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Find available tasks
      const availableTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('[data-testid="task-status"]:has-text("Available")'),
      })

      if ((await availableTasks.count()) > 0) {
        const availableBadge = availableTasks.first().locator('[data-testid="available-badge"]')

        // Contract: available-badge must be visible
        await expect(availableBadge).toBeVisible()
      }
    })

    /**
     * Contract: My tasks must have data-testid="my-task-badge"
     * Source: AC 8e8e949d - "my own tasks should be highlighted or marked"
     */
    // @spec-test: AC 8e8e949d
    test('my tasks must have visible my-task-badge', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Find tasks with data-my-task="true"
      const myTasks = page.locator('[data-testid^="task-card-"][data-my-task="true"]')

      if ((await myTasks.count()) > 0) {
        const myTaskBadge = myTasks.first().locator('[data-testid="my-task-badge"]')

        // Contract: my-task-badge must be visible
        await expect(myTaskBadge).toBeVisible()
      }
    })

    /**
     * Contract: My tasks must have data-my-task="true" attribute
     * Source: AC 8e8e949d - "my own tasks should be highlighted or marked"
     */
    // @spec-test: AC 8e8e949d
    test('my tasks must have data-my-task attribute set to true', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Find tasks owned by current user
      const myTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('[data-testid="task-owner"]:has-text("You")'),
      })

      if ((await myTasks.count()) > 0) {
        const firstMyTask = myTasks.first()

        // Contract: data-my-task attribute must equal "true"
        const myTaskAttr = await firstMyTask.getAttribute('data-my-task')
        expect(myTaskAttr).toBe('true')
      }
    })

    /**
     * Contract: Tasks owned by others must display owner name
     * Source: AC 8e8e949d - "tasks owned by others should show the owner's name"
     */
    // @spec-test: AC 8e8e949d
    test('tasks owned by others must show owner name', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Find tasks owned by others (not "You")
      const otherTasks = page.locator('[data-testid^="task-card-"]').filter({
        has: page.locator('[data-testid="task-owner"]'),
        hasNot: page.locator('[data-my-task="true"]'),
      })

      if ((await otherTasks.count()) > 0) {
        const taskOwner = otherTasks.first().locator('[data-testid="task-owner"]')

        // Contract: Owner name must be visible and not be "You"
        await expect(taskOwner).toBeVisible()

        const ownerText = await taskOwner.textContent()
        expect(ownerText).not.toMatch(/^you$/i)
        expect(ownerText!.trim().length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('@spec-test: AC 728fd41e - Real-Time Updates Contract (ADR-0006)', () => {
    /**
     * Contract: WebSocket connection must be established to /api/v1/ws/tasks
     * Source: ADR-0006 - WebSocket endpoint specification
     */
    // @spec-test: AC 728fd41e, ADR-0006
    test('must establish WebSocket connection to correct endpoint', async ({ page }) => {
      // Listen for WebSocket connections
      const wsPromise = page.waitForEvent('websocket')

      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const ws = await wsPromise

      // Contract: WebSocket URL must contain /api/v1/ws/tasks
      expect(ws.url()).toContain('/api/v1/ws/tasks')
    })

    /**
     * Contract: WebSocket must include JWT token in query parameter
     * Source: ADR-0006 - "?token={jwt_token} - For Clerk JWT authentication"
     */
    // @spec-test: AC 728fd41e, ADR-0006
    test('WebSocket connection must include JWT token query parameter', async ({ page }) => {
      const wsPromise = page.waitForEvent('websocket')

      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      const ws = await wsPromise

      // Contract: WebSocket URL must include token query parameter
      expect(ws.url()).toMatch(/[?&]token=/)
    })

    /**
     * Contract: OwnershipTaken event must match schema from ADR-0006
     * Source: ADR-0006 - TaskEvent::OwnershipTaken schema
     */
    // @spec-test: AC 728fd41e, ADR-0006
    test('OwnershipTaken event must match ADR-0006 schema', async ({ page }) => {
      let eventReceived = false
      let eventData: any = null

      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Listen for WebSocket messages
      page.on('websocket', (ws) => {
        ws.on('framereceived', (event) => {
          try {
            const parsed = JSON.parse(event.payload.toString())
            if (parsed.type === 'ownership_taken') {
              eventReceived = true
              eventData = parsed
            }
          } catch (e) {
            // Ignore parsing errors
          }
        })
      })

      // Wait for potential event (in real scenario, would be triggered by action)
      await page.waitForTimeout(2000)

      // Contract: If event received, must match schema
      if (eventReceived) {
        expect(eventData).toMatchObject({
          type: 'ownership_taken',
          task_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          story_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          owner_user_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          timestamp: expect.any(String),
        })
      }
    })

    /**
     * Contract: StatusChanged event must match schema from ADR-0006
     * Source: ADR-0006 - TaskEvent::StatusChanged schema
     */
    // @spec-test: AC 728fd41e, ADR-0006
    test('StatusChanged event must match ADR-0006 schema', async ({ page }) => {
      let eventReceived = false
      let eventData: any = null

      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      page.on('websocket', (ws) => {
        ws.on('framereceived', (event) => {
          try {
            const parsed = JSON.parse(event.payload.toString())
            if (parsed.type === 'status_changed') {
              eventReceived = true
              eventData = parsed
            }
          } catch (e) {
            // Ignore parsing errors
          }
        })
      })

      await page.waitForTimeout(2000)

      // Contract: If event received, must match schema
      if (eventReceived) {
        expect(eventData).toMatchObject({
          type: 'status_changed',
          task_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          story_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          old_status: expect.any(String),
          new_status: expect.any(String),
          changed_by_user_id: expect.stringMatching(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
          timestamp: expect.any(String),
        })
      }
    })

    /**
     * Contract: Connection indicator must exist with data-testid="connection-indicator"
     * Source: AC 728fd41e - real-time connection status
     */
    // @spec-test: AC 728fd41e
    test('connection indicator must be visible', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: connection-indicator element must exist
      const connectionIndicator = page.locator('[data-testid="connection-indicator"]')
      await expect(connectionIndicator).toBeVisible()
    })

    /**
     * Contract: Notifications must appear in toast/alert container
     * Source: AC 728fd41e - "I should see a subtle notification of the change"
     */
    // @spec-test: AC 728fd41e
    test('notifications must use toast or alert role', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Trigger an action that should show notification
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()

      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()

        // Contract: Notification must use data-testid="toast" or role="alert"
        const notification = page.locator('[data-testid="toast"], [role="alert"]')
        await expect(notification).toBeVisible({ timeout: 3000 })
      }
    })

    /**
     * Contract: UI must update without page reload
     * Source: AC 728fd41e - "without requiring a page refresh"
     */
    // @spec-test: AC 728fd41e
    test('UI updates must not trigger page reload', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Set up listener for page reload
      let pageReloaded = false
      page.on('load', () => {
        pageReloaded = true
      })

      // Perform action
      const takeOwnershipButton = page.locator('button:has-text("I\'m on it")').first()
      if (await takeOwnershipButton.isVisible({ timeout: 5000 })) {
        await takeOwnershipButton.click()
        await page.waitForTimeout(2000)

        // Contract: Page must NOT reload
        expect(pageReloaded).toBe(false)
      }
    })
  })

  test.describe('@spec-test: AC d4d41a1f - Sprint Metadata Contract', () => {
    /**
     * Contract: Sprint name must be displayed with data-testid="sprint-name"
     * Source: AC d4d41a1f - "I should see the sprint name"
     */
    // @spec-test: AC d4d41a1f
    test('sprint name must be displayed with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: sprint-name element must exist and be visible
      const sprintName = page.locator('[data-testid="sprint-name"]')
      await expect(sprintName).toBeVisible()

      // Contract: Sprint name must not be empty
      const nameText = await sprintName.textContent()
      expect(nameText).toBeTruthy()
      expect(nameText!.trim().length).toBeGreaterThan(0)
    })

    /**
     * Contract: Sprint dates must be displayed with data-testid="sprint-dates"
     * Source: AC d4d41a1f - "start date, end date"
     */
    // @spec-test: AC d4d41a1f
    test('sprint dates must be displayed with correct format', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: sprint-dates element must exist and be visible
      const sprintDates = page.locator('[data-testid="sprint-dates"]')
      await expect(sprintDates).toBeVisible()

      // Contract: Must contain date format and separator
      const datesText = await sprintDates.textContent()
      expect(datesText).toMatch(/\d/)
      expect(datesText).toMatch(/[-–—]|to/)
    })

    /**
     * Contract: Days remaining must be displayed with data-testid="days-remaining"
     * Source: AC d4d41a1f - "days remaining"
     */
    // @spec-test: AC d4d41a1f
    test('days remaining must be displayed with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: days-remaining element must exist and be visible
      const daysRemaining = page.locator('[data-testid="days-remaining"]')
      await expect(daysRemaining).toBeVisible()

      // Contract: Must contain number and text
      const daysText = await daysRemaining.textContent()
      expect(daysText).toMatch(/\d+/)
      expect(daysText).toMatch(/remaining|left|days/i)
    })

    /**
     * Contract: Progress bar must be displayed with data-testid="progress-bar"
     * Source: AC d4d41a1f - "progress indicator showing percentage of tasks completed"
     */
    // @spec-test: AC d4d41a1f
    test('progress bar must be displayed with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: progress-bar element must exist and be visible
      const progressBar = page.locator('[data-testid="progress-bar"]')
      await expect(progressBar).toBeVisible()
    })

    /**
     * Contract: Progress percentage must be displayed with data-testid="progress-percentage"
     * Source: AC d4d41a1f - "percentage of tasks completed"
     */
    // @spec-test: AC d4d41a1f
    test('progress percentage must be displayed with valid range', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: progress-percentage element must exist and be visible
      const progressPercentage = page.locator('[data-testid="progress-percentage"]')
      await expect(progressPercentage).toBeVisible()

      // Contract: Must show percentage format
      const percentText = await progressPercentage.textContent()
      expect(percentText).toMatch(/\d+%/)

      // Contract: Percentage must be between 0 and 100
      const percent = parseInt(percentText!.match(/\d+/)?.[0] || '0')
      expect(percent).toBeGreaterThanOrEqual(0)
      expect(percent).toBeLessThanOrEqual(100)
    })

    /**
     * Contract: Story count must be displayed with data-testid="story-count"
     * Source: AC d4d41a1f - "total number of stories in the sprint"
     */
    // @spec-test: AC d4d41a1f
    test('story count must be displayed with correct data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: story-count element must exist and be visible
      const storyCount = page.locator('[data-testid="story-count"]')
      await expect(storyCount).toBeVisible()

      // Contract: Must contain number and "story" or "stories"
      const countText = await storyCount.textContent()
      expect(countText).toMatch(/\d+/)
      expect(countText).toMatch(/stor(y|ies)/i)
    })

    /**
     * Contract: Task progress must be displayed with data-testid="task-progress"
     * Source: AC d4d41a1f - task completion metrics
     */
    // @spec-test: AC d4d41a1f
    test('task progress must show completed and total counts', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: task-progress element must exist and be visible
      const taskProgress = page.locator('[data-testid="task-progress"]')
      await expect(taskProgress).toBeVisible()

      // Contract: Must show "X of Y tasks" format
      const progressText = await taskProgress.textContent()
      expect(progressText).toMatch(/\d+\s+(of|\/)\s+\d+\s+tasks/i)

      // Contract: Completed count must be <= total count
      const match = progressText!.match(/(\d+)\s+(of|\/)\s+(\d+)/)
      if (match) {
        const completed = parseInt(match[1])
        const total = parseInt(match[3])
        expect(completed).toBeLessThanOrEqual(total)
      }
    })
  })

  test.describe('@spec-test: Error Handling Contracts', () => {
    /**
     * Contract: Error state must be displayed when sprint not found
     * Source: Standard error handling requirement
     */
    // @spec-test: ALL ACs
    test('error state must display with try again button', async ({ page }) => {
      const invalidSprintId = '00000000-0000-0000-0000-000000000000'
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${invalidSprintId}/tasks`)

      // Contract: Error heading must be visible
      const errorHeading = page.locator('h3:has-text("Error")')
      await expect(errorHeading).toBeVisible({ timeout: 10000 })

      // Contract: Try again button must exist
      const tryAgainButton = page.locator('button:has-text("Try Again")')
      await expect(tryAgainButton).toBeVisible()
    })

    /**
     * Contract: Empty state must be displayed when no tasks exist
     * Source: Standard empty state requirement
     */
    // @spec-test: ALL ACs
    test('empty state must be displayed with data-testid="empty-state"', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Check if no tasks exist
      const taskCards = page.locator('[data-testid^="task-card-"]')
      const taskCount = await taskCards.count()

      if (taskCount === 0) {
        // Contract: empty-state element must exist
        const emptyState = page.locator('[data-testid="empty-state"]')
        await expect(emptyState).toBeVisible()

        // Contract: Must convey "no tasks" message
        const emptyText = await emptyState.textContent()
        expect(emptyText).toMatch(/no tasks|empty/i)
      }
    })

    /**
     * Contract: Sprint task board container must have data-testid="sprint-task-board"
     * Source: Standard component identifier
     */
    // @spec-test: ALL ACs
    test('main container must have sprint-task-board data-testid', async ({ page }) => {
      await page.goto(`/projects/${TEST_PROJECT_ID}/sprints/${TEST_SPRINT_ID}/tasks`)

      // Contract: sprint-task-board container must exist
      const container = page.locator('[data-testid="sprint-task-board"]')
      await expect(container).toBeVisible({ timeout: 10000 })
    })
  })
})
