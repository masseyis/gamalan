import { backlogClient } from './client'
import {
  Story,
  Task,
  CreateStoryRequest,
  UpdateStoryRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '@/lib/types/story'

export const storiesApi = {
  // Stories
  async getStories(projectId?: string): Promise<Story[]> {
    const url = projectId ? `/stories?projectId=${projectId}` : '/stories'
    return backlogClient.get<Story[]>(url)
  },

  async getStory(id: string): Promise<Story> {
    return backlogClient.get<Story>(`/stories/${id}`)
  },

  async createStory(data: CreateStoryRequest): Promise<{ storyId: string }> {
    return backlogClient.post<{ storyId: string }>('/stories', data)
  },

  async updateStory(id: string, data: UpdateStoryRequest): Promise<void> {
    return backlogClient.patch<void>(`/stories/${id}`, data)
  },

  async deleteStory(id: string): Promise<void> {
    return backlogClient.delete<void>(`/stories/${id}`)
  },

  // Tasks
  async getTasks(storyId: string): Promise<Task[]> {
    return backlogClient.get<Task[]>(`/stories/${storyId}/tasks`)
  },

  async getTask(id: string): Promise<Task> {
    return backlogClient.get<Task>(`/tasks/${id}`)
  },

  async createTask(data: CreateTaskRequest): Promise<{ taskId: string }> {
    return backlogClient.post<{ taskId: string }>('/tasks', data)
  },

  async updateTask(id: string, data: UpdateTaskRequest): Promise<void> {
    return backlogClient.patch<void>(`/tasks/${id}`, data)
  },

  async deleteTask(id: string): Promise<void> {
    return backlogClient.delete<void>(`/tasks/${id}`)
  },
}
