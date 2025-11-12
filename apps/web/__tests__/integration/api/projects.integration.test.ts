import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectsApi } from '@/lib/api/projects'
import { server } from '@/mocks/server'
import { http, HttpResponse } from 'msw'

const mockProject = {
  id: '1',
  name: 'Test Project',
  description: 'A test project for development',
  organizationId: 'org-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('Projects API Integration with Clerk Authentication', () => {
  const mockClerk = {
    user: {
      id: 'user_test123',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      publicMetadata: {},
      privateMetadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    session: {
      id: 'sess_test123',
      status: 'active',
      lastActiveAt: Date.now(),
      expireAt: Date.now() + 3600000,
      user: 'user_test123',
      getToken: vi.fn().mockResolvedValue('clerk_test_token_123'),
    },
    organization: {
      id: 'org_test123',
      name: 'Test Organization',
      slug: 'test-org',
      membersCount: 5,
      adminDeleteEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup window.Clerk for client-side auth
    window.Clerk = {
      user: mockClerk.user,
      session: mockClerk.session,
      organization: mockClerk.organization,
      getToken: mockClerk.session.getToken,
      signOut: vi.fn(),
      openSignIn: vi.fn(),
      openSignUp: vi.fn(),
    }
  })

  afterEach(() => {
    delete (window as any).Clerk
  })

  describe('Authenticated Project Operations', () => {
    it('should fetch all projects with proper authentication', async () => {
      // Override MSW handler for this specific test
      server.use(
        http.get('*/projects', () => {
          return HttpResponse.json([
            {
              id: 'proj_123',
              name: 'Test Project 1',
              description: 'First test project',
              organizationId: 'org_test123',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 'proj_456',
              name: 'Test Project 2',
              description: 'Second test project',
              organizationId: 'org_test123',
              createdAt: '2024-01-02T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z',
            },
          ])
        })
      )

      const projects = await projectsApi.getProjects()

      expect(projects).toHaveLength(2)
      expect(projects[0]).toMatchObject({
        id: 'proj_123',
        name: 'Test Project 1',
        description: 'First test project',
        organizationId: 'org_test123',
      })
    })

    it('should fetch a specific project with authentication', async () => {
      // Override MSW handler for this specific test
      server.use(
        http.get('*/projects/:id', ({ params }) => {
          return HttpResponse.json({
            id: params.id,
            name: `Project ${params.id}`,
            description: `Description for project ${params.id}`,
            organizationId: 'org_test123',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          })
        })
      )

      const project = await projectsApi.getProject('proj_123')

      expect(project).toMatchObject({
        id: 'proj_123',
        name: 'Project proj_123',
        description: 'Description for project proj_123',
        organizationId: 'org_test123',
      })
    })

    it('should create a new project with authentication', async () => {
      const newProjectData = {
        name: 'New Test Project',
        description: 'A brand new test project',
      }

      // Override MSW handler for this specific test
      server.use(
        http.post('*/projects', async ({ request }) => {
          const body = (await request.json()) as any
          return HttpResponse.json({
            id: 'proj_new_123',
            name: body.name,
            description: body.description,
            organizationId: 'org_test123',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          })
        })
      )

      const createdProject = await projectsApi.createProject(newProjectData)

      expect(createdProject).toMatchObject({
        id: 'proj_new_123',
        name: 'New Test Project',
        description: 'A brand new test project',
        organizationId: 'org_test123',
      })
    })

    it('should update an existing project with authentication', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      }

      await expect(projectsApi.updateProject('proj_123', updateData)).resolves.toBeUndefined()
    })

    it('should delete a project with authentication', async () => {
      await expect(projectsApi.deleteProject('proj_123')).resolves.toBeUndefined()
    })

    it('should update project settings with authentication', async () => {
      const settings = {
        theme: 'dark',
        notifications: true,
        autoSave: false,
      }

      await expect(projectsApi.updateProjectSettings('proj_123', settings)).resolves.toBeUndefined()
    })
  })

  describe('Authentication Failures', () => {
    beforeEach(() => {
      // Remove auth from Clerk to test unauthorized access
      window.Clerk.session.getToken = vi.fn().mockResolvedValue(null)

      // Mock MSW handlers to return 401 for unauthorized requests
      server.use(
        http.get('*/projects', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          if (!authHeader || authHeader === 'Bearer null') {
            return new HttpResponse(null, { status: 401 })
          }
          return HttpResponse.json([mockProject])
        }),
        http.get('*/projects/:id', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          if (!authHeader || authHeader === 'Bearer null') {
            return new HttpResponse(null, { status: 401 })
          }
          return HttpResponse.json(mockProject)
        }),
        http.post('*/projects', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          if (!authHeader || authHeader === 'Bearer null') {
            return new HttpResponse(null, { status: 401 })
          }
          return HttpResponse.json(mockProject)
        })
      )
    })

    it('should handle unauthorized access when fetching projects', async () => {
      const projects = await projectsApi.getProjects()

      // Should return empty array on auth failure due to graceful handling
      expect(projects).toEqual([])
    })

    it('should throw error when fetching specific project without auth', async () => {
      await expect(projectsApi.getProject('proj_123')).rejects.toThrow()
    })

    it('should throw error when creating project without auth', async () => {
      const newProjectData = {
        name: 'Unauthorized Project',
        description: 'Should fail',
      }

      await expect(projectsApi.createProject(newProjectData)).rejects.toThrow()
    })
  })

  describe('Organization Context Switching', () => {
    it('should handle organization context switching', async () => {
      // Switch to different organization
      window.Clerk.organization = {
        id: 'org_different_456',
        name: 'Different Organization',
        slug: 'different-org',
        membersCount: 3,
        adminDeleteEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // Set up organization ID mapping (external Clerk ID -> internal backend ID)
      window.__SALUNGA_ORG_ID_MAP = {
        'org_different_456': 'internal_org_456',
      }

      // Capture headers for verification
      let capturedOrgHeader: string | null = null

      // Update MSW handler to capture organization header
      server.use(
        http.get('*/projects', ({ request }) => {
          capturedOrgHeader = request.headers.get('X-Organization-Id')

          return HttpResponse.json([
            {
              id: 'proj_org2_123',
              name: 'Org 2 Project',
              description: 'Project in different org',
              organizationId: 'internal_org_456',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ])
        })
      )

      const projects = await projectsApi.getProjects()

      // Verify the organization header was sent correctly (should be internal ID from mapping)
      expect(capturedOrgHeader).toBe('internal_org_456')
      expect(projects).toHaveLength(1)
      expect(projects[0].organizationId).toBe('internal_org_456')
    })

    it('should handle personal context when no organization is selected', async () => {
      // Remove organization to test personal context
      window.Clerk.organization = null

      // Capture headers for verification
      let capturedContextType: string | null = null
      let capturedUserHeader: string | null = null
      let capturedOrgHeader: string | null = null

      // Update MSW handler to capture personal context headers
      server.use(
        http.get('*/projects', ({ request }) => {
          capturedContextType = request.headers.get('X-Context-Type')
          capturedUserHeader = request.headers.get('X-User-Id')
          capturedOrgHeader = request.headers.get('X-Organization-Id')

          return HttpResponse.json([
            {
              id: 'proj_personal_123',
              name: 'Personal Project',
              description: 'Personal project',
              organizationId: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ])
        })
      )

      const projects = await projectsApi.getProjects()

      // Verify the personal context headers were sent correctly
      expect(capturedContextType).toBe('personal')
      // In production mode, userId is undefined, so normalizeUserId returns anonymous UUID
      // The backend derives the actual user from the JWT token
      expect(capturedUserHeader).toBe('732de8c6-25e8-524f-9905-e88659bfd9d6') // uuidV5('anonymous')
      expect(capturedOrgHeader).toBeNull()

      expect(projects).toHaveLength(1)
      expect(projects[0].organizationId).toBeNull()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      server.use(
        http.get('*/projects', () => {
          throw new Error('Network Error')
        })
      )

      const projects = await projectsApi.getProjects()

      // Should return empty array on network error
      expect(projects).toEqual([])
    })

    it('should handle server errors gracefully', async () => {
      server.use(
        http.get('*/projects', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const projects = await projectsApi.getProjects()

      // Should return empty array on server error
      expect(projects).toEqual([])
    })

    it('should handle malformed responses gracefully', async () => {
      server.use(
        http.get('*/projects', () => {
          return new HttpResponse('Invalid JSON response', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        })
      )

      const projects = await projectsApi.getProjects()

      // Should return empty array on malformed response
      expect(projects).toEqual([])
    })
  })

  describe('Session Management Integration', () => {
    it('should handle token refresh during long operations', async () => {
      let tokenCallCount = 0

      window.Clerk.session.getToken = vi.fn().mockImplementation(() => {
        tokenCallCount++
        return Promise.resolve(`clerk_test_token_${tokenCallCount}`)
      })

      // First request
      await projectsApi.getProjects()

      // Second request should get a fresh token
      await projectsApi.getProject('proj_123')

      expect(window.Clerk.session.getToken).toHaveBeenCalledTimes(2)
    })

    it('should handle concurrent requests with shared token', async () => {
      // Mock multiple concurrent requests
      const promises = [
        projectsApi.getProjects(),
        projectsApi.getProject('proj_123'),
        projectsApi.getProject('proj_456'),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(Array.isArray(results[0])).toBe(true) // projects list
      expect(results[1]).toHaveProperty('id', 'proj_123')
      expect(results[2]).toHaveProperty('id', 'proj_456')
    })
  })
})
