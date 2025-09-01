export interface Project {
  id: string
  name: string
  teamId?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  teamId?: string
  description?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
}