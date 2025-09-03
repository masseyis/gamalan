import { projectsClient } from './client'
import { Project, CreateProjectRequest, UpdateProjectRequest } from '@/lib/types/project'

export const projectsApi = {
  // Get all projects
  async getProjects(): Promise<Project[]> {
    try {
      const result = await projectsClient.get<Project[]>('/projects')
      return result || []
    } catch (error) {
      console.warn('Failed to fetch projects, returning empty array:', error)
      return []
    }
  },

  // Get a specific project
  async getProject(id: string): Promise<Project> {
    try {
      return await projectsClient.get<Project>(`/projects/${id}`)
    } catch (error) {
      console.warn(`Failed to fetch project ${id}:`, error)
      throw error // Let component handle this error
    }
  },

  // Create a new project
  async createProject(data: CreateProjectRequest): Promise<Project> {
    return projectsClient.post<Project>('/projects', data)
  },

  // Update a project
  async updateProject(id: string, data: UpdateProjectRequest): Promise<void> {
    return projectsClient.patch<void>(`/projects/${id}`, data)
  },

  // Delete a project
  async deleteProject(id: string): Promise<void> {
    return projectsClient.delete<void>(`/projects/${id}`)
  },

  // Update project settings
  async updateProjectSettings(id: string, settings: Record<string, any>): Promise<void> {
    return projectsClient.patch<void>(`/projects/${id}/settings`, settings)
  },
}