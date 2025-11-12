import { describe, it, expect, beforeEach, vi } from 'vitest'
import { projectsApi } from '@/lib/api/projects'
import { authGatewayClient } from '@/lib/api/client'

// Mock the API client setup
vi.mock('@/lib/api/client', () => ({
  projectsClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  authGatewayClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  sprintClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  backlogClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  readinessClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  promptBuilderClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  orchestratorClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('Projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProjects', () => {
    it('should fetch all projects', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Project 1',
          description: 'First project',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ]

      vi.mocked(authGatewayClient.get).mockResolvedValue(mockProjects)

      const result = await projectsApi.getProjects()

      expect(authGatewayClient.get).toHaveBeenCalledWith('/projects')
      expect(result).toEqual(mockProjects)
    })
  })

  describe('getProject', () => {
    it('should fetch a specific project', async () => {
      const projectId = 'test-id'
      const mockProject = {
        id: projectId,
        name: 'Test Project',
        description: 'Test project description',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(authGatewayClient.get).mockResolvedValue(mockProject)

      const result = await projectsApi.getProject(projectId)

      expect(authGatewayClient.get).toHaveBeenCalledWith(`/projects/${projectId}`)
      expect(result).toEqual(mockProject)
    })
  })

  describe('createProject', () => {
    it('should create a new project', async () => {
      const createData = {
        name: 'New Project',
        description: 'New project description',
      }
      const mockResponse = {
        id: 'new-project-id',
        ...createData,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      vi.mocked(authGatewayClient.post).mockResolvedValue(mockResponse)

      const result = await projectsApi.createProject(createData)

      expect(authGatewayClient.post).toHaveBeenCalledWith('/projects', createData)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateProject', () => {
    it('should update an existing project', async () => {
      const projectId = 'test-id'
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
      }

      vi.mocked(authGatewayClient.put).mockResolvedValue(undefined)

      await projectsApi.updateProject(projectId, updateData)

      expect(authGatewayClient.put).toHaveBeenCalledWith(`/projects/${projectId}`, updateData)
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectId = 'test-id'

      vi.mocked(authGatewayClient.delete).mockResolvedValue(undefined)

      await projectsApi.deleteProject(projectId)

      expect(authGatewayClient.delete).toHaveBeenCalledWith(`/projects/${projectId}`)
    })
  })

  describe('updateProjectSettings', () => {
    it('should update project settings', async () => {
      const projectId = 'test-id'
      const settings = {
        theme: 'dark',
        notifications: true,
      }

      vi.mocked(authGatewayClient.patch).mockResolvedValue(undefined)

      await projectsApi.updateProjectSettings(projectId, settings)

      expect(authGatewayClient.patch).toHaveBeenCalledWith(`/projects/${projectId}/settings`, settings)
    })
  })
})
