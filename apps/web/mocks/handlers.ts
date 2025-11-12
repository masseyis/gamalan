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
    const body = (await request.json()) as any
    return HttpResponse.json({
      ...mockProject,
      ...body,
      id: 'new-project-id',
    })
  }),

  http.put('*/projects/:id', async ({ params, request }) => {
    const body = (await request.json()) as any
    // Return void (no content) for PUT operations in this API design
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('*/projects/:id', async ({ params, request }) => {
    const body = (await request.json()) as any
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
    const body = (await request.json()) as any
    return HttpResponse.json({
      ...mockStory,
      ...body,
      id: 'new-story-id',
      projectId: params.projectId,
    })
  }),

  http.patch('*/projects/:projectId/stories/:storyId', async ({ params, request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json({
      ...mockStory,
      ...body,
      id: params.storyId,
      projectId: params.projectId,
    })
  }),

  http.patch('*/projects/:projectId/stories/:storyId/status', async ({ params, request }) => {
    const body = (await request.json()) as any
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
    const body = (await request.json()) as any
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

  http.post(
    '*/projects/:projectId/stories/:storyId/acceptance-criteria',
    async ({ params, request }) => {
      const body = (await request.json()) as any
      return HttpResponse.json({
        ...mockAcceptanceCriterion,
        ...body,
        id: 'new-ac-id',
        storyId: params.storyId,
      })
    }
  ),

  // AI API
  http.post('*/readiness/:storyId/evaluate', () => {
    return HttpResponse.json({
      score: 85,
      missingItems: [],
      recommendations: ['Verify dependencies before scheduling'],
      summary: 'Story meets the readiness bar and can be scheduled for a sprint.',
      isReady: true,
    })
  }),

  http.post('*/criteria/:storyId/generate', () => {
    return HttpResponse.json([
      {
        id: 'mock-ac-1',
        story_id: 'mock-story',
        ac_id: 'AC1',
        given: 'a user is viewing the dashboard',
        when: 'they have pending tasks',
        then: 'the dashboard displays the tasks in priority order',
      },
      {
        id: 'mock-ac-2',
        story_id: 'mock-story',
        ac_id: 'AC2',
        given: 'a user has unread notifications',
        when: 'they open the dashboard',
        then: 'a notification badge shows the unread count',
      },
    ])
  }),

  http.post('*/plans/from-story/:storyId', () => {
    return HttpResponse.json({
      proposed_tasks: [
        {
          title: 'Implement authentication UI',
          description: 'Build login and registration forms with error handling',
          acceptance_criteria_refs: ['AC1'],
          estimated_effort: '3',
          technical_notes: 'Use shared form components',
        },
        {
          title: 'Create API gateway routes',
          description: 'Configure routes for authentication and user management',
          acceptance_criteria_refs: ['AC2'],
          estimated_effort: '5',
          technical_notes: null,
        },
        {
          title: 'Add integration tests',
          description: 'Write integration tests covering happy path and failure modes',
          acceptance_criteria_refs: ['AC1', 'AC2'],
          estimated_effort: '2',
          technical_notes: 'Focus on regression scenarios',
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
