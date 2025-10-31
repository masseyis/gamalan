import { sprintClient } from './client'
import { Sprint } from '@/lib/types/team'

export const sprintApi = {
  async getActiveSprint(projectId: string): Promise<Sprint | null> {
    try {
      const result = await sprintClient.get<Sprint>(`/projects/${projectId}/sprints/active`)
      return result ?? null
    } catch (error) {
      console.warn(
        `Failed to fetch active sprint for project ${projectId}, returning null:`,
        error
      )
      return null
    }
  },

  async getSprint(projectId: string, sprintId: string): Promise<Sprint> {
    return sprintClient.get<Sprint>(`/projects/${projectId}/sprints/${sprintId}`)
  },

  async createSprint(
    projectId: string,
    name: string,
    goal: string,
    stories: string[]
  ): Promise<Sprint> {
    return sprintClient.post<Sprint>(`/projects/${projectId}/sprints`, {
      name,
      goal,
      stories,
    })
  },
}
