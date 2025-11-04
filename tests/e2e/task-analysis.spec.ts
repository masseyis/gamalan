import { test, expect, Page } from '@playwright/test'

/**
 * E2E Test: Task Readiness Analysis and Enhancement Recommendations
 *
 * This test suite verifies the complete workflow for analyzing tasks and providing
 * AI-powered recommendations to improve task clarity and readiness.
 *
 * Story: Task Readiness Analysis and Enhancement Recommendations
 * Task ID: ee410228-c7f2-4821-b913-9e7c2c9ec4a2
 *
 * Acceptance Criteria Coverage:
 * - AC e0261453: Clarity score display with recommendations
 * - AC 81054dee: Technical details recommendations
 * - AC 30639999: Vague language detection and flagging
 * - AC 5649e91e: Missing acceptance criteria detection
 * - AC 3f42fa09: AI agent compatibility evaluation
 * - AC dd7b8a3c: AI-assisted task enrichment
 * - AC bbd83897: One-click enhancement application with examples
 */

// Test data setup helpers
async function setupTestEnvironment(page: Page) {
  // Login as a contributor with necessary permissions
  await page.goto('/')

  // Authenticate via Clerk (assumes test auth is configured)
  await page.getByTestId('sign-in-button').click()
  await page.fill('[name="identifier"]', process.env.TEST_USER_EMAIL || 'test@example.com')
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD || 'testpass123')
  await page.getByRole('button', { name: 'Continue' }).click()

  // Wait for authentication to complete
  await page.waitForURL('**/projects', { timeout: 10000 })
}

async function createTestProject(page: Page, name: string): Promise<string> {
  await page.getByTestId('create-project-button').click()
  await page.fill('[data-testid="project-name-input"]', name)
  await page.getByTestId('save-project-button').click()

  // Extract project ID from URL
  await page.waitForURL('**/projects/*')
  const url = page.url()
  const projectId = url.split('/projects/')[1].split('/')[0]
  return projectId
}

async function createTestStory(
  page: Page,
  projectId: string,
  title: string,
  description?: string
): Promise<string> {
  await page.goto(`/projects/${projectId}/backlog`)
  await page.getByTestId('create-story-button').click()
  await page.fill('[data-testid="story-title-input"]', title)

  if (description) {
    await page.fill('[data-testid="story-description-input"]', description)
  }

  await page.getByTestId('save-story-button').click()

  // Wait for story to be created and extract ID
  await page.waitForSelector('[data-testid^="story-"]')
  const storyElement = page.locator('[data-testid^="story-"]').first()
  const storyTestId = await storyElement.getAttribute('data-testid')
  const storyId = storyTestId?.replace('story-', '') || ''

  return storyId
}

async function createTestTask(
  page: Page,
  storyId: string,
  title: string,
  description?: string,
  acceptanceCriteriaRefs?: string[]
): Promise<string> {
  // Navigate to story detail view
  await page.getByTestId(`story-${storyId}`).click()

  // Create task
  await page.getByTestId('create-task-button').click()
  await page.fill('[data-testid="task-title-input"]', title)

  if (description) {
    await page.fill('[data-testid="task-description-input"]', description)
  }

  // Link acceptance criteria if provided
  if (acceptanceCriteriaRefs && acceptanceCriteriaRefs.length > 0) {
    await page.getByTestId('link-ac-button').click()
    for (const acRef of acceptanceCriteriaRefs) {
      await page.getByTestId(`ac-checkbox-${acRef}`).check()
    }
    await page.getByTestId('confirm-ac-link-button').click()
  }

  await page.getByTestId('save-task-button').click()

  // Extract task ID
  await page.waitForSelector('[data-testid^="task-"]')
  const taskElement = page.locator('[data-testid^="task-"]').last()
  const taskTestId = await taskElement.getAttribute('data-testid')
  const taskId = taskTestId?.replace('task-', '') || ''

  return taskId
}

async function createAcceptanceCriteria(
  page: Page,
  storyId: string,
  criteria: { given: string; when: string; then: string }[]
): Promise<string[]> {
  const acIds: string[] = []

  for (const criterion of criteria) {
    await page.getByTestId('add-acceptance-criteria').click()
    await page.fill('[data-testid="ac-given"]', criterion.given)
    await page.fill('[data-testid="ac-when"]', criterion.when)
    await page.fill('[data-testid="ac-then"]', criterion.then)
    await page.getByTestId('save-ac-button').click()

    // Extract AC ID from the newly created criterion
    await page.waitForSelector('[data-testid^="ac-"]')
    const acElement = page.locator('[data-testid^="ac-"]').last()
    const acTestId = await acElement.getAttribute('data-testid')
    const acId = acTestId?.replace('ac-', '') || ''
    acIds.push(acId)
  }

  return acIds
}

test.describe('Task Readiness Analysis and Enhancement Recommendations', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestEnvironment(page)
  })

  test.describe('AC e0261453: Clarity Score Display', () => {
    test('should display clarity score with recommendations when viewing task', async ({
      page,
    }) => {
      // Given I am viewing a task in the backlog
      const projectId = await createTestProject(page, 'Analysis Test Project')
      const storyId = await createTestStory(
        page,
        projectId,
        'Implement user authentication',
        'Add login functionality to the application'
      )

      // Create a poorly defined task
      const taskId = await createTestTask(
        page,
        storyId,
        'Add authentication',
        'Implement login' // Vague description
      )

      // When the task readiness analysis runs
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()

      // Wait for analysis to complete
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 })

      // Then I should see a clarity score
      const clarityScore = page.getByTestId('clarity-score')
      await expect(clarityScore).toBeVisible()
      await expect(clarityScore).toContainText(/\d+/)

      // And I should see specific recommendations for improvement
      const recommendations = page.getByTestId('recommendations-list')
      await expect(recommendations).toBeVisible()

      const recommendationItems = page.locator('[data-testid^="recommendation-"]')
      const count = await recommendationItems.count()
      expect(count).toBeGreaterThan(0)

      // Verify recommendations contain actionable guidance
      const firstRecommendation = recommendationItems.first()
      await expect(firstRecommendation).toContainText(/(add|specify|define|clarify)/i)
    })

    test('should show high clarity score for well-defined tasks', async ({ page }) => {
      // Given a well-defined task
      const projectId = await createTestProject(page, 'Well-Defined Task Test')
      const storyId = await createTestStory(
        page,
        projectId,
        'User Authentication System'
      )

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'a user visits the login page',
          when: 'they enter valid credentials and click submit',
          then: 'they should be authenticated and redirected to the dashboard',
        },
      ])

      const taskId = await createTestTask(
        page,
        storyId,
        'Implement JWT authentication middleware',
        `Create authentication middleware that:
- Validates JWT tokens from the Authorization header
- Extracts user claims from the token
- Attaches user context to the request
- Returns 401 for invalid/missing tokens

Files to modify:
- src/middleware/auth.ts (create new)
- src/routes/protected.ts (update to use middleware)

Expected inputs: JWT token string
Expected outputs: User context object or 401 error

Test coverage: Unit tests for token validation, integration tests for protected routes`,
        acIds
      )

      // When analysis runs
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Then clarity score should be high (≥80)
      const scoreText = await page.getByTestId('clarity-score').textContent()
      const score = parseInt(scoreText?.match(/\d+/)?.[0] || '0')
      expect(score).toBeGreaterThanOrEqual(80)

      // And should show "AI Agent Ready" indicator
      await expect(page.getByTestId('ai-agent-ready-badge')).toBeVisible()
      await expect(page.getByTestId('ai-agent-ready-badge')).toContainText('Ready')
    })
  })

  test.describe('AC 81054dee: Technical Details Recommendations', () => {
    test('should recommend technical details when task lacks specifics', async ({
      page,
    }) => {
      // Given a task description lacks specific technical details
      const projectId = await createTestProject(page, 'Technical Details Test')
      const storyId = await createTestStory(page, projectId, 'API Integration')
      const taskId = await createTestTask(
        page,
        storyId,
        'Create API endpoint',
        'Add a new endpoint to handle user data' // Lacks technical specifics
      )

      // When the analysis evaluates the task
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Then the system should recommend adding specific technical details
      const recommendations = page.locator('[data-testid^="recommendation-"]')

      // Check for file path recommendation
      const filePathRec = recommendations.filter({
        hasText: /file path|files? to modify/i,
      })
      await expect(filePathRec.first()).toBeVisible()

      // Check for function/component recommendation
      const componentRec = recommendations.filter({
        hasText: /function|component|endpoint|handler/i,
      })
      await expect(componentRec.first()).toBeVisible()

      // Check for inputs/outputs recommendation
      const ioRec = recommendations.filter({
        hasText: /input|output|parameter|return/i,
      })
      await expect(ioRec.first()).toBeVisible()

      // Check for technical approach recommendation
      const approachRec = recommendations.filter({
        hasText: /approach|architecture|pattern|design/i,
      })
      await expect(approachRec.first()).toBeVisible()

      // Verify gap indicators show missing technical details
      const gaps = page.getByTestId('gaps-list')
      await expect(gaps).toContainText(/technical detail|specific/i)
    })

    test('should provide examples in technical recommendations', async ({ page }) => {
      const projectId = await createTestProject(page, 'Examples Test')
      const storyId = await createTestStory(page, projectId, 'Database Migration')
      const taskId = await createTestTask(
        page,
        storyId,
        'Update schema',
        'Change the database'
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Check that recommendations include examples
      const firstRec = page.locator('[data-testid^="recommendation-"]').first()

      // Expand recommendation to see example
      await firstRec.click()

      const example = firstRec.locator('[data-testid="recommendation-example"]')
      await expect(example).toBeVisible()
      await expect(example).not.toBeEmpty()
    })
  })

  test.describe('AC 30639999: Vague Language Detection', () => {
    test('should flag vague terms in task descriptions', async ({ page }) => {
      // Given a task has vague or ambiguous language
      const projectId = await createTestProject(page, 'Vague Language Test')
      const storyId = await createTestStory(page, projectId, 'System Improvements')

      // Create task with multiple vague terms
      const taskId = await createTestTask(
        page,
        storyId,
        'Implement feature',
        'Create something to build the thing and add stuff to fix it'
      )

      // When the analysis evaluates the task
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Then the system should flag vague terms
      const vagueTer msHighlight = page.getByTestId('vague-terms-highlight')
      await expect(vagueTermsHighlight).toBeVisible()

      // And should list the flagged terms
      const flaggedTerms = page.locator('[data-testid^="vague-term-"]')
      const termCount = await flaggedTerms.count()
      expect(termCount).toBeGreaterThan(0)

      // Common vague terms that should be flagged
      const vagueWords = ['implement', 'create', 'build', 'add', 'fix', 'something', 'stuff', 'thing']
      for (const word of vagueWords.slice(0, 3)) {
        const termElement = flaggedTerms.filter({ hasText: new RegExp(word, 'i') })
        if ((await termElement.count()) > 0) {
          await expect(termElement.first()).toBeVisible()
        }
      }

      // And should recommend concrete actions
      const recommendations = page.locator('[data-testid^="recommendation-"]')
      const concreteActionRec = recommendations.filter({
        hasText: /specific|concrete|measurable|clear/i,
      })
      await expect(concreteActionRec.first()).toBeVisible()
    })

    test('should recommend replacing vague terms with specifics', async ({ page }) => {
      const projectId = await createTestProject(page, 'Replace Vague Test')
      const storyId = await createTestStory(page, projectId, 'Feature Work')
      const taskId = await createTestTask(
        page,
        storyId,
        'Fix the system',
        'Improve performance'
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Check for specific replacement suggestions
      const replacementSuggestions = page.getByTestId('replacement-suggestions')
      await expect(replacementSuggestions).toBeVisible()

      // Verify suggestions include measurable outcomes
      await expect(replacementSuggestions).toContainText(/(reduce|increase|implement|refactor) .* (by|to|from)/i)
    })
  })

  test.describe('AC 5649e91e: Missing Acceptance Criteria Detection', () => {
    test('should detect when task is missing AC references', async ({ page }) => {
      // Given a task is missing acceptance criteria references
      const projectId = await createTestProject(page, 'Missing AC Test')
      const storyId = await createTestStory(page, projectId, 'User Profile Feature')

      // Create ACs for the story
      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'a user is logged in',
          when: 'they navigate to their profile',
          then: 'they should see their profile information',
        },
        {
          given: 'a user edits their profile',
          when: 'they save changes',
          then: 'the changes should be persisted',
        },
      ])

      // Create task without linking to ACs
      const taskId = await createTestTask(
        page,
        storyId,
        'Build profile page',
        'Create the user profile interface'
        // Note: no acceptanceCriteriaRefs provided
      )

      // When the analysis evaluates the task
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Then the system should recommend linking to specific AC IDs
      const gaps = page.getByTestId('gaps-list')
      await expect(gaps).toContainText(/acceptance criteria|AC.*link/i)

      const recommendations = page.locator('[data-testid^="recommendation-"]')
      const acRec = recommendations.filter({
        hasText: /link.*acceptance criteria|reference.*AC/i,
      })
      await expect(acRec.first()).toBeVisible()

      // And should suggest which ACs the task addresses
      const suggestedACs = page.getByTestId('suggested-acs-list')
      await expect(suggestedACs).toBeVisible()

      const suggestedItems = suggestedACs.locator('[data-testid^="suggested-ac-"]')
      expect(await suggestedItems.count()).toBeGreaterThan(0)
    })

    test('should show valid status when task properly links to ACs', async ({ page }) => {
      const projectId = await createTestProject(page, 'Valid AC Link Test')
      const storyId = await createTestStory(page, projectId, 'Search Feature')

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'a user enters a search query',
          when: 'they press enter',
          then: 'matching results should be displayed',
        },
      ])

      // Task properly linked to AC
      const taskId = await createTestTask(
        page,
        storyId,
        'Implement search API endpoint',
        'Create RESTful endpoint for search functionality',
        acIds // Properly linked
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Should not show AC-related gaps
      const gaps = page.getByTestId('gaps-list')
      const gapsText = await gaps.textContent()
      expect(gapsText).not.toMatch(/acceptance criteria/i)

      // Should show linked ACs
      const linkedACs = page.getByTestId('linked-acs-display')
      await expect(linkedACs).toBeVisible()
      await expect(linkedACs).toContainText(acIds[0])
    })
  })

  test.describe('AC 3f42fa09: AI Agent Compatibility Check', () => {
    test('should evaluate task for AI agent compatibility', async ({ page }) => {
      // Given a task is analyzed for AI agent compatibility
      const projectId = await createTestProject(page, 'AI Compatibility Test')
      const storyId = await createTestStory(page, projectId, 'Data Processing')
      const taskId = await createTestTask(
        page,
        storyId,
        'Process user data',
        'Handle the data processing'
      )

      // When the readiness check runs
      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Then the system should evaluate required criteria
      const aiCompatCheck = page.getByTestId('ai-compatibility-checklist')
      await expect(aiCompatCheck).toBeVisible()

      // Verify all required checks are present
      const checks = [
        'clear success criteria',
        'explicit dependencies',
        'environment setup',
        'test coverage',
        'definition of done',
      ]

      for (const checkItem of checks) {
        const checkElement = page.locator(`[data-testid="ai-check-${checkItem.replace(/\s+/g, '-')}"]`)
        await expect(checkElement).toBeVisible()
      }

      // Should show overall AI readiness status
      const aiReadyStatus = page.getByTestId('ai-ready-status')
      await expect(aiReadyStatus).toBeVisible()
      await expect(aiReadyStatus).toContainText(/(ready|not ready|needs improvement)/i)
    })

    test('should show AI-ready badge for fully qualified tasks', async ({ page }) => {
      const projectId = await createTestProject(page, 'AI Ready Task Test')
      const storyId = await createTestStory(page, projectId, 'API Development')

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'an API request is received',
          when: 'the data is valid',
          then: 'a success response should be returned',
        },
      ])

      // Create a comprehensive, AI-ready task
      const taskId = await createTestTask(
        page,
        storyId,
        'Implement GET /users/:id endpoint',
        `Create RESTful endpoint to retrieve user by ID.

Success Criteria:
- Returns 200 with user JSON when user exists
- Returns 404 when user not found
- Returns 401 for unauthorized requests

Dependencies:
- User authentication middleware must be complete
- Database connection must be established

Environment Setup:
- PostgreSQL database running
- JWT secret configured
- User table migrated

Test Coverage:
- Unit tests for handler function (>90% coverage)
- Integration tests for full request/response cycle
- Test cases for 200, 404, 401 responses

Definition of Done:
- All tests passing
- Code reviewed and approved
- OpenAPI spec updated
- Changes deployed to staging`,
        acIds
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Should show AI-ready badge
      await expect(page.getByTestId('ai-agent-ready-badge')).toBeVisible()
      await expect(page.getByTestId('ai-agent-ready-badge')).toHaveClass(/success|ready|approved/)

      // Clarity score should be high
      const scoreText = await page.getByTestId('clarity-score').textContent()
      const score = parseInt(scoreText?.match(/\d+/)?.[0] || '0')
      expect(score).toBeGreaterThanOrEqual(80)

      // All compatibility checks should pass
      const failedChecks = page.locator('[data-testid^="ai-check-"][data-status="failed"]')
      expect(await failedChecks.count()).toBe(0)
    })
  })

  test.describe('AC dd7b8a3c: AI-Assisted Task Enrichment', () => {
    test('should generate detailed task description using AI', async ({ page }) => {
      // Given I select a task to enhance
      const projectId = await createTestProject(page, 'AI Enrichment Test')
      const storyId = await createTestStory(
        page,
        projectId,
        'Payment Integration',
        'Integrate payment processing into the checkout flow'
      )

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'a user completes checkout',
          when: 'they submit payment',
          then: 'payment should be processed successfully',
        },
      ])

      const taskId = await createTestTask(
        page,
        storyId,
        'Add payment handler',
        'Process payments',
        acIds
      )

      await page.getByTestId(`task-${taskId}`).click()

      // When I request AI-assisted task enrichment
      await page.getByTestId('enrich-task-button').click()

      // Wait for AI enrichment to complete
      await page.waitForSelector('[data-testid="enrichment-suggestion"]', { timeout: 15000 })

      // Then the system should generate a detailed task description
      const suggestion = page.getByTestId('enrichment-suggestion')
      await expect(suggestion).toBeVisible()

      // Verify enrichment includes comprehensive details
      const suggestionText = await suggestion.textContent()
      expect(suggestionText).toMatch(/file|path|function|component/i) // File references
      expect(suggestionText).toMatch(/test|coverage/i) // Testing requirements
      expect(suggestionText).toMatch(/input|output|parameter|return/i) // I/O specifications

      // And should present it as a suggestion for review
      await expect(page.getByTestId('review-enrichment-panel')).toBeVisible()
      await expect(page.getByTestId('accept-enrichment-button')).toBeVisible()
      await expect(page.getByTestId('reject-enrichment-button')).toBeVisible()
      await expect(page.getByTestId('edit-enrichment-button')).toBeVisible()
    })

    test('should use story context for enrichment', async ({ page }) => {
      const projectId = await createTestProject(page, 'Context Enrichment Test')
      const storyId = await createTestStory(
        page,
        projectId,
        'Email Notification System',
        'Send email notifications for important events. System should support: welcome emails, password resets, order confirmations. Must integrate with SendGrid API.'
      )

      const taskId = await createTestTask(
        page,
        storyId,
        'Implement email service',
        'Create email sender'
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('enrich-task-button').click()
      await page.waitForSelector('[data-testid="enrichment-suggestion"]', { timeout: 15000 })

      // Enrichment should reference story context
      const suggestion = await page.getByTestId('enrichment-suggestion').textContent()
      expect(suggestion).toMatch(/sendgrid|email|notification/i)
      expect(suggestion).toMatch(/welcome|password|order/i)
    })

    test('should allow accepting enrichment suggestions', async ({ page }) => {
      const projectId = await createTestProject(page, 'Accept Enrichment Test')
      const storyId = await createTestStory(page, projectId, 'Feature X')
      const taskId = await createTestTask(page, storyId, 'Build feature', 'Do the work')

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('enrich-task-button').click()
      await page.waitForSelector('[data-testid="enrichment-suggestion"]')

      // Accept the suggestion
      await page.getByTestId('accept-enrichment-button').click()

      // Task description should be updated
      await page.waitForSelector('[data-testid="task-description-updated"]')

      // Verify the enriched content is now in the task description
      const description = page.getByTestId('task-description-display')
      const descText = await description.textContent()
      expect(descText?.length).toBeGreaterThan(50) // Enriched content is substantial
    })
  })

  test.describe('AC bbd83897: One-Click Enhancement Application', () => {
    test('should show examples of well-defined tasks', async ({ page }) => {
      // Given a task analysis is complete
      const projectId = await createTestProject(page, 'Examples Test')
      const storyId = await createTestStory(page, projectId, 'Test Story')
      const taskId = await createTestTask(page, storyId, 'Test task', 'Basic task')

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // When I view the recommendations
      // Then I should see examples of well-defined tasks
      const examplesSection = page.getByTestId('example-tasks-section')
      await expect(examplesSection).toBeVisible()

      const exampleTasks = page.locator('[data-testid^="example-task-"]')
      const exampleCount = await exampleTasks.count()
      expect(exampleCount).toBeGreaterThan(0)

      // Examples should be from same project or similar domains
      const firstExample = exampleTasks.first()
      await expect(firstExample).toBeVisible()
      await expect(firstExample.locator('[data-testid="example-task-title"]')).toBeVisible()
      await expect(firstExample.locator('[data-testid="example-task-description"]')).toBeVisible()
      await expect(firstExample.locator('[data-testid="example-clarity-score"]')).toBeVisible()

      // Should show why this is a good example
      await expect(firstExample.locator('[data-testid="example-rationale"]')).toBeVisible()
    })

    test('should allow one-click application of recommendations', async ({ page }) => {
      const projectId = await createTestProject(page, 'One-Click Test')
      const storyId = await createTestStory(page, projectId, 'Quick Apply Story')

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'test condition',
          when: 'test action',
          then: 'test result',
        },
      ])

      const taskId = await createTestTask(
        page,
        storyId,
        'Incomplete task',
        'This task needs work'
        // Note: AC not linked initially
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Find a recommendation with quick-apply option
      const recommendations = page.locator('[data-testid^="recommendation-"]')
      const firstRec = recommendations.first()

      // Should have an "Apply" button
      const applyButton = firstRec.locator('[data-testid="apply-recommendation-button"]')
      await expect(applyButton).toBeVisible()
      await expect(applyButton).toBeEnabled()

      // Click to apply
      await applyButton.click()

      // Should show confirmation
      await page.waitForSelector('[data-testid="recommendation-applied-toast"]')
      await expect(page.getByTestId('recommendation-applied-toast')).toContainText(/applied|success/i)

      // Task should be updated
      await expect(page.getByTestId('task-updated-indicator')).toBeVisible()

      // Re-analyze to see improvement
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Score should improve or gap should be resolved
      const gaps = page.getByTestId('gaps-list')
      const gapsText = await gaps.textContent()
      expect(gapsText?.length).toBeLessThan(100) // Fewer gaps after applying
    })

    test('should allow applying multiple recommendations at once', async ({ page }) => {
      const projectId = await createTestProject(page, 'Bulk Apply Test')
      const storyId = await createTestStory(page, projectId, 'Bulk Enhancement Story')
      const taskId = await createTestTask(
        page,
        storyId,
        'Needs lots of work',
        'Vague task with many issues'
      )

      await page.getByTestId(`task-${taskId}`).click()
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Select multiple recommendations
      const recommendations = page.locator('[data-testid^="recommendation-"]')
      const recCount = await recommendations.count()

      for (let i = 0; i < Math.min(recCount, 3); i++) {
        const rec = recommendations.nth(i)
        const checkbox = rec.locator('[data-testid="recommendation-checkbox"]')
        if (await checkbox.isVisible()) {
          await checkbox.check()
        }
      }

      // Apply all selected
      await page.getByTestId('apply-selected-recommendations-button').click()

      // Confirm bulk application
      await page.getByTestId('confirm-bulk-apply-button').click()

      // Wait for application to complete
      await page.waitForSelector('[data-testid="bulk-apply-complete-toast"]', { timeout: 10000 })

      // Verify task was enhanced
      await expect(page.getByTestId('task-updated-indicator')).toBeVisible()
    })
  })

  test.describe('Full Analysis Workflow', () => {
    test('should complete full workflow: Create → Analyze → View → Apply → Verify', async ({
      page,
    }) => {
      // Step 1: Create a new task
      const projectId = await createTestProject(page, 'Full Workflow Test')
      const storyId = await createTestStory(
        page,
        projectId,
        'Complete Workflow Story',
        'Test the complete analysis and enhancement workflow'
      )

      const acIds = await createAcceptanceCriteria(page, storyId, [
        {
          given: 'a workflow test runs',
          when: 'all steps complete',
          then: 'the task should be enhanced and ready',
        },
      ])

      const taskId = await createTestTask(
        page,
        storyId,
        'Process data',
        'Handle the data processing task'
        // Intentionally vague for testing
      )

      await page.getByTestId(`task-${taskId}`).click()

      // Step 2: Analyze the task
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 })

      // Verify analysis results are shown
      await expect(page.getByTestId('clarity-score')).toBeVisible()
      await expect(page.getByTestId('recommendations-list')).toBeVisible()
      await expect(page.getByTestId('gaps-list')).toBeVisible()

      // Step 3: View recommendations in detail
      const firstRec = page.locator('[data-testid^="recommendation-"]').first()
      await firstRec.click() // Expand to see details

      await expect(firstRec.locator('[data-testid="recommendation-example"]')).toBeVisible()
      await expect(firstRec.locator('[data-testid="recommendation-priority"]')).toBeVisible()

      // Step 4: Apply recommendations
      await page.getByTestId('apply-all-recommendations-button').click()
      await page.getByTestId('confirm-apply-all-button').click()
      await page.waitForSelector('[data-testid="recommendations-applied-toast"]')

      // Step 5: Verify results - re-analyze to see improvement
      await page.getByTestId('analyze-task-button').click()
      await page.waitForSelector('[data-testid="analysis-results"]')

      // Score should be improved
      const finalScoreText = await page.getByTestId('clarity-score').textContent()
      const finalScore = parseInt(finalScoreText?.match(/\d+/)?.[0] || '0')
      expect(finalScore).toBeGreaterThan(50) // Should improve from initial low score

      // Fewer gaps should remain
      const finalGaps = page.locator('[data-testid^="gap-"]')
      const finalGapCount = await finalGaps.count()
      expect(finalGapCount).toBeLessThan(5) // Should reduce gaps

      // Task should show improvement indicators
      await expect(page.getByTestId('task-improvement-badge')).toBeVisible()
    })
  })
})
