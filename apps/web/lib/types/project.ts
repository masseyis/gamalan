import { Story } from './story'

export interface Project {
  id: string
  name: string
  teamId?: string
  organizationId?: string
  description?: string
  createdAt: string
  updatedAt: string
  stories?: Story[]
}

export interface CreateProjectRequest {
  name: string
  teamId?: string
  description?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  teamId?: string | null
}
