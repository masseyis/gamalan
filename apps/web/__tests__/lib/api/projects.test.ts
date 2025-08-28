import { describe, it, expect, beforeEach, vi } from 'vitest'
import { projectsApi } from '@/lib/api/projects'
import { apiClients } from '@/lib/api/client'

// Mock the API client setup
vi.mock('@/lib/api/client', () => ({
  apiClients: {
    projects: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
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

      vi.mocked(apiClients.projects.get).mockResolvedValue(mockProjects)

      const result = await projectsApi.getProjects()

      expect(apiClients.projects.get).toHaveBeenCalledWith('/projects')
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

      vi.mocked(apiClients.projects.get).mockResolvedValue(mockProject)

      const result = await projectsApi.getProject(projectId)

      expect(apiClients.projects.get).toHaveBeenCalledWith(`/projects/${projectId}`)
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

      vi.mocked(apiClients.projects.post).mockResolvedValue(mockResponse)

      const result = await projectsApi.createProject(createData)

      expect(apiClients.projects.post).toHaveBeenCalledWith('/projects', createData)
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

      vi.mocked(apiClients.projects.patch).mockResolvedValue(undefined)

      await projectsApi.updateProject(projectId, updateData)

      expect(apiClients.projects.patch).toHaveBeenCalledWith(`/projects/${projectId}`, updateData)
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const projectId = 'test-id'

      vi.mocked(apiClients.projects.delete).mockResolvedValue(undefined)

      await projectsApi.deleteProject(projectId)

      expect(apiClients.projects.delete).toHaveBeenCalledWith(`/projects/${projectId}`)
    })
  })

  describe('updateProjectSettings', () => {
    it('should update project settings', async () => {
      const projectId = 'test-id'
      const settings = {
        theme: 'dark',
        notifications: true,
      }

      vi.mocked(apiClients.projects.patch).mockResolvedValue(undefined)

      await projectsApi.updateProjectSettings(projectId, settings)

      expect(apiClients.projects.patch).toHaveBeenCalledWith(`/projects/${projectId}/settings`, settings)
    })
  })
})