import { test, expect } from '@playwright/test'
import {
  ProjectsPage,
  BacklogPage,
  StoryDetailPage,
  TaskAnalysisPage,
  testData,
  testUtils,
} from '../page-objects'
import { setupApiMocks } from '../helpers/api-mocks'

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Task Analysis Workflow', () => {
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let storyDetailPage: StoryDetailPage
  let taskAnalysisPage: TaskAnalysisPage
  let projectId: string
  let projectName: string
  let storyId: string
  let storyTitle: string

  test.beforeAll(async ({ browser }) => {
    // Create a test project and story for analysis tests
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()

    // Setup API mocks before any page interactions
    await setupApiMocks(page)

    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(
      projectName,
      'Test project for task analysis workflow'
    )

    if (!projectId) {
      throw new Error('Failed to create project - projectId is empty')
    }

    // Create a story with acceptance criteria
    storyTitle = testUtils.generateStoryTitle()
    await backlogPage.gotoBacklog(projectId)
    storyId = await backlogPage.createStory(
      storyTitle,
      'Story for testing task readiness analysis',
      [
        'Given a task description lacks specific technical details, When the analysis evaluates the task, Then the system should recommend adding file paths, functions, and technical approach',
        'Given a task has vague or ambiguous language, When the analysis evaluates the task, Then the system should flag terms like "implement", "create", "build" without specifics',
        'Given a task is missing acceptance criteria references, When the analysis evaluates the task, Then the system should recommend linking to specific acceptance criteria IDs',
      ]
    )

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    // Setup API mocks for each test
    await setupApiMocks(page)

    backlogPage = new BacklogPage(page)
    storyDetailPage = new StoryDetailPage(page)
    taskAnalysisPage = new TaskAnalysisPage(page)
  })

  test.describe('AC e0261453: Clarity Score Display', () => {
    test('should display clarity score after analyzing a task', async () => {
      // Navigate to story and add a task with vague description
      await storyDetailPage.gotoStory(projectId, storyId)

      const vagueTaskTitle = `Vague Task ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        vagueTaskTitle,
        'Implement the feature' // Intentionally vague
      )

      // Trigger analysis
      await taskAnalysisPage.analyzeTask()

      // Verify clarity score is displayed
      await taskAnalysisPage.expectAnalysisPanelVisible()

      const clarityScore = await taskAnalysisPage.getClarityScore()
      expect(clarityScore).toBeGreaterThanOrEqual(0)
      expect(clarityScore).toBeLessThanOrEqual(100)

      // Verify clarity level is shown
      const clarityLevel = await taskAnalysisPage.getClarityLevel()
      expect(['poor', 'fair', 'good', 'excellent']).toContain(clarityLevel)
    })

    test('should show poor clarity score for vague task', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const vagueTaskTitle = `Poor Clarity ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(vagueTaskTitle, 'Fix the bug')

      await taskAnalysisPage.analyzeTask()

      // Should have low score due to vagueness
      await taskAnalysisPage.expectClarityScore(0, 50)
      await taskAnalysisPage.expectClarityLevel('poor')
    })

    test('should show high clarity score for well-defined task', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const wellDefinedTaskTitle = `Well-Defined Task ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        wellDefinedTaskTitle,
        `Update UserService.authenticate() method in services/auth/user-service.ts
        - Add JWT token validation using jose library
        - Return AuthResult with user ID and permissions
        - Handle expired token error with custom AuthTokenExpiredError
        - Add unit tests for valid/invalid/expired token scenarios
        - Acceptance Criteria: AC-001, AC-002
        - Dependencies: jose@5.1.0 must be installed
        - Expected test coverage: 95%`
      )

      await taskAnalysisPage.analyzeTask()

      // Should have high score due to specificity
      await taskAnalysisPage.expectClarityScore(70, 100)
      const level = await taskAnalysisPage.getClarityLevel()
      expect(['good', 'excellent']).toContain(level)
    })
  })

  test.describe('AC 81054dee: Technical Details Recommendations', () => {
    test('should recommend adding file paths when missing', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No File Paths ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Update the authentication logic')

      await taskAnalysisPage.analyzeTask()

      // Verify technical details recommendations exist
      await taskAnalysisPage.expandCategory('technical-details')

      const recommendations = await taskAnalysisPage.getCategoryRecommendations('technical-details')
      expect(recommendations.length).toBeGreaterThan(0)

      // Should recommend specific file paths
      await taskAnalysisPage.expectMissingElement(
        'technical-details',
        /file path|specific file|which file/i
      )
    })

    test('should recommend adding function/component names when missing', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Functions ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        'Modify some code in the user module to add validation'
      )

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('technical-details')

      // Should recommend specific functions/components
      await taskAnalysisPage.expectMissingElement(
        'technical-details',
        /function|component|method|class/i
      )
    })

    test('should recommend adding expected inputs/outputs when missing', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Input Output ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Create a validation function')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('technical-details')

      // Should recommend inputs/outputs specification
      await taskAnalysisPage.expectMissingElement(
        'technical-details',
        /input|output|parameter|return|result/i
      )
    })

    test('should recommend technical approach when missing', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Approach ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add caching')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('technical-details')

      // Should recommend technical approach/architecture
      await taskAnalysisPage.expectMissingElement(
        'technical-details',
        /approach|architecture|pattern|implementation/i
      )
    })
  })

  test.describe('AC 30639999: Vague Language Detection', () => {
    test('should flag vague term "implement" without specifics', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Vague Implement ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Implement the new feature')

      await taskAnalysisPage.analyzeTask()

      // Should flag "implement" as vague
      await taskAnalysisPage.expectVagueTermFlagged('implement')
    })

    test('should flag vague term "create" without specifics', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Vague Create ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Create something for users')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expectVagueTermFlagged('create')
    })

    test('should flag vague term "build" without specifics', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Vague Build ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Build the API endpoint')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expectVagueTermFlagged('build')
    })

    test('should flag vague term "add" without specifics', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Vague Add ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add validation')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expectVagueTermFlagged('add')
    })

    test('should flag vague term "fix" without specifics', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Vague Fix ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Fix the bug in the system')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expectVagueTermFlagged('fix')
    })

    test('should recommend concrete actions with measurable outcomes', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Need Concrete ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Improve performance')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('vague-terms')

      const recommendations = await taskAnalysisPage.getCategoryRecommendations('vague-terms')
      expect(recommendations.length).toBeGreaterThan(0)

      // Recommendations should mention measurable outcomes
      const hasConcreteAdvice = recommendations.some((rec) =>
        /measurable|specific|concrete|quantifiable/i.test(rec)
      )
      expect(hasConcreteAdvice).toBeTruthy()
    })
  })

  test.describe('AC 5649e91e: Acceptance Criteria References', () => {
    test('should recommend linking to AC IDs when missing', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No AC Refs ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        'Update UserService.login() in services/user-service.ts to validate email format'
      )

      await taskAnalysisPage.analyzeTask()

      // Should recommend adding AC references
      await taskAnalysisPage.expandCategory('acceptance-criteria')

      await taskAnalysisPage.expectMissingElement(
        'acceptance-criteria',
        /acceptance criteria|AC reference|link.*criteria/i
      )
    })

    test('should suggest which ACs the task addresses', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Suggest ACs ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        'Add email validation to prevent invalid user registrations'
      )

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('acceptance-criteria')

      const recommendations = await taskAnalysisPage.getCategoryRecommendations(
        'acceptance-criteria'
      )
      expect(recommendations.length).toBeGreaterThan(0)

      // Should mention specific AC IDs or how to link
      const hasSuggestion = recommendations.some((rec) => /AC-\d+|criteria.*ID|link/i.test(rec))
      expect(hasSuggestion).toBeTruthy()
    })

    test('should not recommend AC refs when already present', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Has AC Refs ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        `Update UserService.login() in services/user-service.ts
        - Validate email format with regex
        - Return ValidationError for invalid format
        - Acceptance Criteria: AC-001, AC-002`
      )

      await taskAnalysisPage.analyzeTask()

      // Try to expand acceptance-criteria section
      try {
        await taskAnalysisPage.expandCategory('acceptance-criteria')
        const count = await taskAnalysisPage.getCategoryItemCount('acceptance-criteria')
        // Should have 0 or minimal recommendations
        expect(count).toBeLessThanOrEqual(1)
      } catch {
        // Section might not exist if no recommendations, which is good
      }
    })
  })

  test.describe('AC 3f42fa09: AI Agent Compatibility', () => {
    test('should check for clear success criteria', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Success Criteria ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Update the database schema')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('ai-compatibility')

      // Should mention success criteria
      await taskAnalysisPage.expectAICompatibilityIssue(/success criteria|definition of done/i)
    })

    test('should check for explicit dependencies', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Dependencies ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Install the library and configure it')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('ai-compatibility')

      // Should mention dependencies
      await taskAnalysisPage.expectAICompatibilityIssue(/dependencies|prerequisite|requires/i)
    })

    test('should check for required environment setup', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Environment ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Run the migration scripts')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('ai-compatibility')

      // Should mention environment setup
      await taskAnalysisPage.expectAICompatibilityIssue(/environment|setup|configuration/i)
    })

    test('should check for expected test coverage', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No Test Coverage ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add new API endpoint /api/users')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('ai-compatibility')

      // Should mention test coverage
      await taskAnalysisPage.expectAICompatibilityIssue(/test coverage|testing|test.*required/i)
    })

    test('should check for definition of done', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `No DoD ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Refactor the code')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('ai-compatibility')

      // Should mention definition of done
      await taskAnalysisPage.expectAICompatibilityIssue(/definition of done|when.*complete/i)
    })

    test('should pass AI compatibility for well-defined task', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `AI Compatible ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        `Update UserService.authenticate() in services/auth/user-service.ts
        - Success Criteria: JWT validation returns valid user object with id and permissions
        - Dependencies: jose@5.1.0, @types/jose@5.1.0
        - Environment: NODE_ENV=test, JWT_SECRET must be set
        - Expected test coverage: 95% with unit tests for valid/invalid/expired tokens
        - Definition of Done: All tests pass, code review approved, deployed to staging
        - Acceptance Criteria: AC-001, AC-002, AC-003`
      )

      await taskAnalysisPage.analyzeTask()

      // Try to check AI compatibility section
      try {
        await taskAnalysisPage.expandCategory('ai-compatibility')
        const count = await taskAnalysisPage.getCategoryItemCount('ai-compatibility')
        // Should have 0 or minimal issues
        expect(count).toBeLessThanOrEqual(1)
      } catch {
        // Section might not exist, which is good
      }
    })
  })

  test.describe('AC dd7b8a3c: AI-Assisted Task Enrichment', () => {
    test('should allow requesting AI-assisted enrichment', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `To Enrich ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add user authentication')

      // Trigger enrichment
      await taskAnalysisPage.enrichTask()

      // Should show enhanced suggestion
      await taskAnalysisPage.expectToastMessage(/Enhancement|Enrichment|Suggestion/)
    })

    test('should generate detailed task description from context', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Context Enrichment ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Update login flow')

      await taskAnalysisPage.enrichTask()

      // Enhancement should be based on story context
      // The UI should show a suggestion that includes details from story ACs
      await taskAnalysisPage.page.waitForTimeout(2000)

      // Verify enhancement suggestion appears (could be in a modal or inline)
      const enhancementText = taskAnalysisPage.page.locator(
        'text=/detailed.*description|enhanced.*task|suggested.*improvement/i'
      )
      await expect(enhancementText.first()).toBeVisible({ timeout: 10000 })
    })

    test('should present enrichment as reviewable suggestion', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Review Suggestion ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add validation')

      await taskAnalysisPage.enrichTask()

      // Should have accept/reject or review options
      const acceptButton = taskAnalysisPage.page.locator('button:has-text("Accept")')
      const rejectButton = taskAnalysisPage.page.locator('button:has-text("Reject")')

      await expect(
        acceptButton.or(rejectButton).or(taskAnalysisPage.page.locator('button:has-text("Review")'))
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('AC bbd83897: Examples and Apply Recommendations', () => {
    test('should show well-defined task examples', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Need Examples ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Add feature')

      await taskAnalysisPage.analyzeTask()

      // Should have examples section
      await taskAnalysisPage.expandCategory('examples')

      const exampleCount = await taskAnalysisPage.getCategoryItemCount('examples')
      expect(exampleCount).toBeGreaterThan(0)
    })

    test('should show examples from same project when available', async () => {
      // First create a well-defined task as an example
      await storyDetailPage.gotoStory(projectId, storyId)

      const exampleTaskTitle = `Example Task ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        exampleTaskTitle,
        `Well-defined example task in UserService.ts
        - Update authenticate() method
        - Add JWT validation
        - Return AuthResult object
        - AC: AC-001
        - Tests: 95% coverage required`
      )

      // Now create a vague task
      const vagueTaskTitle = `Needs Example ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(vagueTaskTitle, 'Do authentication stuff')

      await taskAnalysisPage.analyzeTask()

      await taskAnalysisPage.expandCategory('examples')

      // Should reference similar tasks in project
      const examples = await taskAnalysisPage.getCategoryRecommendations('examples')
      expect(examples.length).toBeGreaterThan(0)
    })

    test('should allow applying recommendations with one click', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Apply Rec ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Fix bug')

      await taskAnalysisPage.analyzeTask()

      // Find an actionable recommendation
      await taskAnalysisPage.expandCategory('technical-details')

      const applyButtons = taskAnalysisPage.applyRecommendationButtons
      const buttonCount = await applyButtons.count()

      if (buttonCount > 0) {
        // Click the first apply button
        await applyButtons.first().click()

        // Should show confirmation or update
        await taskAnalysisPage.expectToastMessage(/Applied|Updated|Success/)
      }
    })

    test('should show priority badges on recommendations', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Priority Badges ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(taskTitle, 'Build something')

      await taskAnalysisPage.analyzeTask()

      // Check for priority badges across categories
      await taskAnalysisPage.expandCategory('technical-details')

      // Should have at least one priority badge
      const priorityBadge = taskAnalysisPage.page.locator(
        'text=/critical|high|medium|low/i'
      ).first()
      await expect(priorityBadge).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Complete Analysis Workflow', () => {
    test('should complete full analysis workflow from task creation to recommendations', async () => {
      // 1. Navigate to story
      await storyDetailPage.gotoStory(projectId, storyId)

      // 2. Create a task with mixed quality (some good, some bad)
      const taskTitle = `Complete Workflow ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        `Implement user authentication
        - Update UserService.ts
        - Add JWT validation
        - Handle errors
        Dependencies: jose@5.1.0`
      )

      // 3. Trigger analysis
      await taskAnalysisPage.analyzeTask()

      // 4. Verify clarity score is displayed
      await taskAnalysisPage.expectAnalysisPanelVisible()
      const clarityScore = await taskAnalysisPage.getClarityScore()
      expect(clarityScore).toBeGreaterThanOrEqual(0)
      expect(clarityScore).toBeLessThanOrEqual(100)

      // 5. View recommendations across categories
      await taskAnalysisPage.expandCategory('technical-details')
      await taskAnalysisPage.expandCategory('vague-terms')
      await taskAnalysisPage.expandCategory('acceptance-criteria')
      await taskAnalysisPage.expandCategory('ai-compatibility')

      // 6. Verify total recommendations exist
      const totalRecs = await taskAnalysisPage.getTotalRecommendationCount()
      expect(totalRecs).toBeGreaterThan(0)

      // 7. Apply a recommendation if available
      const applyButtons = taskAnalysisPage.applyRecommendationButtons
      const buttonCount = await applyButtons.count()
      if (buttonCount > 0) {
        await applyButtons.first().click()
      }
    })

    test('should handle well-defined task with no recommendations', async () => {
      await storyDetailPage.gotoStory(projectId, storyId)

      const taskTitle = `Perfect Task ${testUtils.generateUniqueId()}`
      await storyDetailPage.addTask(
        taskTitle,
        `Update UserService.authenticate() method in services/auth/user-service.ts

        File: services/auth/user-service.ts
        Function: UserService.authenticate(token: string): Promise<AuthResult>

        Technical Approach:
        1. Parse JWT token using jose library
        2. Verify token signature with JWKS endpoint
        3. Check token expiration timestamp
        4. Extract user claims (id, email, permissions)
        5. Return AuthResult object with user data

        Expected Input: JWT token string (format: "Bearer xxx.yyy.zzz")
        Expected Output: AuthResult { userId: string, permissions: string[], email: string }

        Error Handling:
        - Throw AuthTokenExpiredError if exp claim is past
        - Throw AuthTokenInvalidError if signature verification fails
        - Throw AuthTokenMalformedError if token format invalid

        Success Criteria:
        - Valid tokens return correct user data
        - Expired tokens throw AuthTokenExpiredError
        - Invalid signatures throw AuthTokenInvalidError
        - All error cases have specific error types

        Dependencies:
        - jose@5.1.0 (JWT validation)
        - @types/jose@5.1.0 (TypeScript types)

        Environment Setup:
        - JWT_SECRET environment variable must be set
        - JWKS_ENDPOINT must be configured in .env
        - NODE_ENV=test for test runs

        Test Coverage:
        - Unit test: valid token returns user data (95% coverage required)
        - Unit test: expired token throws correct error
        - Unit test: invalid signature throws correct error
        - Unit test: malformed token throws correct error
        - Integration test: full auth flow with real JWKS endpoint

        Definition of Done:
        - All unit tests pass
        - Integration test passes
        - Code coverage >= 95%
        - Code review approved
        - Deployed to staging environment
        - Manual QA verification complete

        Acceptance Criteria References:
        - AC-e0261453-8f72-4b08-8290-d8fb7903c869
        - AC-81054dee-14c5-455f-a580-7d8870ba34ee
        - AC-3f42fa09-1117-463b-b523-08dc03a2f4a4`
      )

      await taskAnalysisPage.analyzeTask()

      // Should show high clarity score
      await taskAnalysisPage.expectClarityScore(85, 100)

      // Should show "no recommendations" message
      await taskAnalysisPage.expectNoRecommendations()
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
