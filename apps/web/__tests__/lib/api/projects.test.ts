import { describe, it, expect, beforeEach, vi } from 'vitest'
import { projectsApi } from '@/lib/api/projects'
import { projectsClient } from '@/lib/api/client'

// Mock the API client setup
vi.mock('@/lib/api/client', () => ({
  projectsClient: {
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

      vi.mocked(projectsClient.get).mockResolvedValue(mockProjects)

      const result = await projectsApi.getProjects()

      expect(projectsClient.get).toHaveBeenCalledWith('/projects')
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

      vi.mocked(projectsClient.get).mockResolvedValue(mockProject)

      const result = await projectsApi.getProject(projectId)

      expect(projectsClient.get).toHaveBeenCalledWith(`/projects/${projectId}`)
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

      vi.mocked(projectsClient.post).mockResolvedValue(mockResponse)

      const result = await projectsApi.createProject(createData)

      expect(projectsClient.post).toHaveBeenCalledWith('/projects', createData)
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

      vi.mocked(projectsClient.put).mockResolvedValue(undefined)

      await projectsApi.updateProject(projectId, updateData)

      expect(projectsClient.put).toHaveBeenCalledWith(`/projects/${projectId}`, updateData)
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectId = 'test-id'

      vi.mocked(projectsClient.delete).mockResolvedValue(undefined)

      await projectsApi.deleteProject(projectId)

      expect(projectsClient.delete).toHaveBeenCalledWith(`/projects/${projectId}`)
    })
  })

  describe('updateProjectSettings', () => {
    it('should update project settings', async () => {
      const projectId = 'test-id'
      const settings = {
        theme: 'dark',
        notifications: true,
      }

      vi.mocked(projectsClient.patch).mockResolvedValue(undefined)

      await projectsApi.updateProjectSettings(projectId, settings)

      expect(projectsClient.patch).toHaveBeenCalledWith(`/projects/${projectId}/settings`, settings)
    })
  })
})
