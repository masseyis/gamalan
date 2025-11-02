import { Page } from '@playwright/test'

/**
 * Mock data for testing
 */
export const mockData = {
  project: (overrides: Record<string, any> = {}) => ({
    id: 'test-project-123',
    name: 'E2E Test Project',
    description: 'Test project for E2E tests',
    organizationId: 'org-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  story: (overrides: Record<string, any> = {}) => ({
    id: 'test-story-123',
    title: 'Test Story',
    description: 'A test story for development',
    status: 'ready',
    priority: 'medium',
    storyPoints: 5,
    projectId: 'test-project-123',
    labels: ['test'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  acceptanceCriterion: (overrides: Record<string, any> = {}) => ({
    id: 'test-ac-123',
    acId: 'AC-001',
    description: 'Test acceptance criterion',
    given: 'Given I am a test user',
    whenClause: 'When I perform a test action',
    thenClause: 'Then I should see expected results',
    storyId: 'test-story-123',
    createdAt: new Date().toISOString(),
    ...overrides,
  }),

  task: (overrides: Record<string, any> = {}) => ({
    id: 'test-task-123',
    title: 'Test Task',
    description: 'A test task for development',
    status: 'todo',
    estimatedHours: 4,
    actualHours: 0,
    priority: 'medium',
    assigneeId: null,
    storyId: 'test-story-123',
    acceptanceCriteriaRefs: ['AC-001'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  taskAnalysis: (overrides: Record<string, any> = {}) => ({
    taskId: 'test-task-123',
    clarityScore: 85,
    aiCompatibilityScore: 90,
    vagueness: {
      score: 15,
      flaggedTerms: [],
      recommendations: [],
    },
    technicalDetails: {
      score: 85,
      missing: [],
      recommendations: [],
    },
    acceptanceCriteriaRefs: {
      score: 100,
      suggestedRefs: ['AC-001'],
      recommendations: [],
    },
    aiCompatibility: {
      score: 90,
      checks: {
        hasSuccessCriteria: true,
        hasDependencies: true,
        hasEnvironmentSetup: true,
        hasTestCoverage: true,
        hasDefinitionOfDone: true,
      },
      recommendations: [],
    },
    recommendations: [],
    analyzedAt: new Date().toISOString(),
    ...overrides,
  }),
}

/**
 * Setup API mocks for Playwright tests
 * This function intercepts network requests and returns mock responses
 */
export async function setupApiMocks(page: Page) {
  // Mock projects API
  await page.route('**/projects', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockData.project()]),
      })
    } else if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockData.project({
            id: `project-${Date.now()}`,
            ...postData,
          })
        ),
      })
    }
  })

  await page.route('**/projects/*', async (route) => {
    const url = route.request().url()
    const projectId = url.split('/projects/')[1]?.split('/')[0]

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData.project({ id: projectId })),
      })
    } else if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
      await route.fulfill({
        status: 204,
      })
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 204,
      })
    }
  })

  // Mock stories API
  await page.route('**/projects/*/stories', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockData.story()]),
      })
    } else if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockData.story({
            id: `story-${Date.now()}`,
            ...postData,
          })
        ),
      })
    }
  })

  await page.route('**/projects/*/stories/*', async (route) => {
    const url = route.request().url()
    const storyId = url.split('/stories/')[1]?.split('/')[0]

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData.story({ id: storyId })),
      })
    } else if (route.request().method() === 'PATCH') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData.story({ id: storyId, ...postData })),
      })
    }
  })

  // Mock acceptance criteria API
  await page.route('**/projects/*/stories/*/acceptance-criteria', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockData.acceptanceCriterion()]),
      })
    } else if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockData.acceptanceCriterion({
            id: `ac-${Date.now()}`,
            ...postData,
          })
        ),
      })
    }
  })

  // Mock tasks API
  await page.route('**/projects/*/stories/*/tasks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockData.task()]),
      })
    } else if (route.request().method() === 'POST') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          mockData.task({
            id: `task-${Date.now()}`,
            ...postData,
          })
        ),
      })
    }
  })

  // Mock task analysis API
  await page.route('**/tasks/*/analyze', async (route) => {
    if (route.request().method() === 'POST') {
      const taskId = route.request().url().split('/tasks/')[1]?.split('/')[0]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData.taskAnalysis({ taskId })),
      })
    }
  })

  await page.route('**/tasks/*', async (route) => {
    const url = route.request().url()
    const taskId = url.split('/tasks/')[1]?.split('/')[0]

    if (route.request().method() === 'GET') {
      // Check if this is a task analysis request
      if (url.includes('/analysis')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData.taskAnalysis({ taskId })),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData.task({ id: taskId })),
        })
      }
    } else if (route.request().method() === 'PATCH') {
      const postData = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData.task({ id: taskId, ...postData })),
      })
    }
  })

  // Mock readiness evaluation API
  await page.route('**/readiness/*/evaluate', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          score: 85,
          missingItems: [],
          recommendations: ['Verify dependencies before scheduling'],
          summary: 'Story meets the readiness bar and can be scheduled for a sprint.',
          isReady: true,
        }),
      })
    }
  })

  // Mock AI APIs
  await page.route('**/criteria/*/generate', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          mockData.acceptanceCriterion({
            id: 'generated-ac-1',
            acId: 'AC-GEN-1',
            description: 'AI generated acceptance criterion 1',
          }),
          mockData.acceptanceCriterion({
            id: 'generated-ac-2',
            acId: 'AC-GEN-2',
            description: 'AI generated acceptance criterion 2',
          }),
        ]),
      })
    }
  })
}

/**
 * Setup API mocks with custom data
 */
export async function setupApiMocksWithData(
  page: Page,
  data: {
    projects?: any[]
    stories?: any[]
    tasks?: any[]
    acceptanceCriteria?: any[]
  }
) {
  await setupApiMocks(page)

  // Override with custom data if provided
  if (data.projects) {
    await page.route('**/projects', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data.projects),
        })
      }
    })
  }

  // Add more overrides as needed
}
