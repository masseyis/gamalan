import { projectsClient } from './client'
import { Project, CreateProjectRequest, UpdateProjectRequest } from '@/lib/types/project'

// Mock data for demonstration
const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Salunga Web Platform',
    description: 'Next.js frontend for the AI-enhanced agile project management platform',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj-2', 
    name: 'Mobile App Development',
    description: 'React Native mobile application for project management on the go',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'proj-3',
    name: 'API Gateway Microservice',
    description: 'Rust-based authentication and routing service for backend APIs',
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }
]

const useMockData = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true'

export const projectsApi = {
  // Get all projects
  async getProjects(): Promise<Project[]> {
    if (useMockData) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      return mockProjects
    }
    return projectsClient.get<Project[]>('/projects')
  },

  // Get a specific project
  async getProject(id: string): Promise<Project> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const project = mockProjects.find(p => p.id === id)
      if (!project) throw new Error('Project not found')
      return project
    }
    return projectsClient.get<Project>(`/projects/${id}`)
  },

  // Create a new project
  async createProject(data: CreateProjectRequest): Promise<Project> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 800))
      const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: data.name,
        description: data.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockProjects.push(newProject)
      return newProject
    }
    return projectsClient.post<Project>('/projects', data)
  },

  // Update a project
  async updateProject(id: string, data: UpdateProjectRequest): Promise<void> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 600))
      const projectIndex = mockProjects.findIndex(p => p.id === id)
      if (projectIndex >= 0) {
        mockProjects[projectIndex] = {
          ...mockProjects[projectIndex],
          ...data,
          updatedAt: new Date().toISOString(),
        }
      }
      return
    }
    return projectsClient.patch<void>(`/projects/${id}`, data)
  },

  // Delete a project
  async deleteProject(id: string): Promise<void> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 400))
      const projectIndex = mockProjects.findIndex(p => p.id === id)
      if (projectIndex >= 0) {
        mockProjects.splice(projectIndex, 1)
      }
      return
    }
    return projectsClient.delete<void>(`/projects/${id}`)
  },

  // Update project settings
  async updateProjectSettings(id: string, settings: Record<string, any>): Promise<void> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 500))
      // For demo, just simulate the update
      return
    }
    return projectsClient.patch<void>(`/projects/${id}/settings`, settings)
  },
}