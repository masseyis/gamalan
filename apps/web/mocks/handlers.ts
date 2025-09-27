import { http, HttpResponse } from 'msw'

const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'A test project for development',
  organizationId: 'org-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockStory = {
  id: '1',
  title: 'Test Story',
  description: 'A test story for development',
  status: 'ready',
  priority: 'medium',
  storyPoints: 5,
  projectId: '1',
  labels: ['test'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockTask = {
  id: '1',
  title: 'Test Task',
  description: 'A test task for development',
  status: 'todo',
  estimatedHours: 4,
  actualHours: 0,
  priority: 'medium',
  assigneeId: null,
  storyId: '1',
  acceptanceCriteriaRefs: ['ac-1'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockAcceptanceCriterion = {
  id: 'ac-1',
  acId: 'ac-1',
  description: 'Test acceptance criterion',
  given: 'Given I am a test user',
  whenClause: 'When I perform a test action',
  thenClause: 'Then I should see expected results',
  storyId: '1',
  createdAt: new Date().toISOString(),
}

export const handlers = [
  // Projects API
  http.get('*/projects', () => {
    return HttpResponse.json([mockProject])
  }),

  http.get('*/projects/:id', ({ params }) => {
    return HttpResponse.json({
      ...mockProject,
      id: params.id,
    })
  }),

  http.post('*/projects', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockProject,
      ...body,
      id: 'new-project-id',
    })
  }),

  http.patch('*/projects/:id', async ({ params, request }) => {
    const body = await request.json() as any
    // Return void (no content) for PATCH operations in this API design
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('*/projects/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('*/projects/:id/settings', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Stories API
  http.get('*/projects/:projectId/stories', () => {
    return HttpResponse.json([mockStory])
  }),

  http.get('*/projects/:projectId/stories/:storyId', ({ params }) => {
    return HttpResponse.json({
      ...mockStory,
      id: params.storyId,
      projectId: params.projectId,
    })
  }),

  http.post('*/projects/:projectId/stories', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockStory,
      ...body,
      id: 'new-story-id',
      projectId: params.projectId,
    })
  }),

  http.patch('*/projects/:projectId/stories/:storyId', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockStory,
      ...body,
      id: params.storyId,
      projectId: params.projectId,
    })
  }),

  http.patch('*/projects/:projectId/stories/:storyId/status', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockStory,
      id: params.storyId,
      projectId: params.projectId,
      status: body.status,
    })
  }),

  // Tasks API
  http.get('*/projects/:projectId/stories/:storyId/tasks', () => {
    return HttpResponse.json([mockTask])
  }),

  http.post('*/projects/:projectId/stories/:storyId/tasks', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockTask,
      ...body,
      id: 'new-task-id',
      storyId: params.storyId,
    })
  }),

  // Acceptance Criteria API
  http.get('*/projects/:projectId/stories/:storyId/acceptance-criteria', () => {
    return HttpResponse.json([mockAcceptanceCriterion])
  }),

  http.post('*/projects/:projectId/stories/:storyId/acceptance-criteria', async ({ params, request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      ...mockAcceptanceCriterion,
      ...body,
      id: 'new-ac-id',
      storyId: params.storyId,
    })
  }),

  // AI API
  http.post('*/projects/:projectId/stories/:storyId/readiness-check', () => {
    return HttpResponse.json({
      id: 'readiness-check-id',
      storyId: 'test-story-id',
      status: 'ready',
      score: 85,
      checks: [
        { name: 'Acceptance Criteria', passed: true, message: 'Story has well-defined acceptance criteria' },
        { name: 'Story Points', passed: true, message: 'Story is properly estimated' },
        { name: 'Dependencies', passed: false, message: 'Story has unresolved dependencies' },
      ],
      createdAt: new Date().toISOString(),
    })
  }),

  http.post('*/projects/:projectId/stories/:storyId/generate-acceptance-criteria', () => {
    return HttpResponse.json({
      suggestions: [
        {
          given: 'Given I am a logged-in user',
          when: 'When I navigate to the dashboard',
          then: 'Then I should see my project list',
        },
        {
          given: 'Given I have no projects',
          when: 'When I view the dashboard',
          then: 'Then I should see an empty state with create project option',
        },
      ],
    })
  }),

  http.post('*/projects/:projectId/stories/:storyId/suggest-breakdown', () => {
    return HttpResponse.json({
      suggestions: [
        {
          title: 'Create user authentication',
          description: 'Implement login and registration functionality',
          estimatedPoints: 8,
          priority: 'high' as const,
        },
        {
          title: 'Design dashboard layout',
          description: 'Create responsive dashboard design',
          estimatedPoints: 5,
          priority: 'medium' as const,
        },
      ],
    })
  }),

  // Fallback handler for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return new HttpResponse(null, { status: 404 })
  }),
]