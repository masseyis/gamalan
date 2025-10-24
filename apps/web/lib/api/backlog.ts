import { backlogClient } from './client'
import {
  Story,
  Task,
  AcceptanceCriterion,
  CreateStoryRequest,
  UpdateStoryRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  StoryStatus,
  TaskStatus,
  TaskOwnershipResponse,
  SetTaskEstimateRequest,
  UpdateStoryStatusRequest,
} from '@/lib/types/story'

// Mock data for demonstration
const mockStories: Record<string, Story[]> = {
  'project-1': [
    {
      id: 'story-1',
      title: 'User Authentication System',
      description:
        'As a user, I want to securely authenticate using Clerk so that I can access my personal projects and data',
      status: 'ready',
      priority: 'high',
      storyPoints: 8,
      projectId: 'project-1',
      labels: ['authentication', 'security'],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-2',
      title: 'Project Dashboard',
      description:
        'As a project manager, I want to see an overview of all my projects with key metrics so that I can quickly assess project health',
      status: 'inprogress',
      priority: 'high',
      storyPoints: 5,
      projectId: 'project-1',
      labels: ['dashboard', 'metrics'],
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-3',
      title: 'Drag-and-Drop Sprint Board',
      description:
        'As a scrum master, I want to drag stories between sprint board columns so that I can easily update story status during standups',
      status: 'accepted',
      priority: 'medium',
      storyPoints: 13,
      projectId: 'project-1',
      labels: ['sprint', 'ui'],
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-4',
      title: 'AI Story Readiness Assessment',
      description:
        'As a product owner, I want AI to analyze my stories and provide readiness feedback so that I know which stories are ready for development',
      status: 'ready',
      priority: 'medium',
      storyPoints: 8,
      projectId: 'project-1',
      labels: ['ai', 'assessment'],
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'project-2': [
    {
      id: 'story-5',
      title: 'Mobile App Setup',
      description:
        'As a developer, I want to set up the React Native project structure so that we can begin mobile development',
      status: 'ready',
      priority: 'critical',
      storyPoints: 5,
      projectId: 'project-2',
      labels: ['mobile', 'setup'],
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}

const mockAcceptanceCriteria: Record<string, AcceptanceCriterion[]> = {
  'story-1': [
    {
      id: 'ac-1',
      acId: 'ac-1',
      description: 'User registration form visibility',
      given: 'I am an unregistered user',
      whenClause: 'I visit the sign-up page',
      thenClause: 'I should see a form to create a new account',
      storyId: 'story-1',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ac-2',
      acId: 'ac-2',
      description: 'User authentication success flow',
      given: 'I am a registered user with valid credentials',
      whenClause: 'I attempt to sign in',
      thenClause: 'I should be authenticated and redirected to the dashboard',
      storyId: 'story-1',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}

export const backlogApi = {
  // Stories
  async getStories(
    projectId: string,
    sprintId?: string,
    status?: StoryStatus,
    options?: { includeTasks?: boolean }
  ): Promise<Story[]> {
    try {
      let url = `/projects/${projectId}/stories`
      const params = new URLSearchParams()
      if (sprintId) {
        params.append('sprintId', sprintId)
      }
      if (status) {
        params.append('status', status)
      }
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      const stories = (await backlogClient.get<Story[]>(url)) || []

      if (options?.includeTasks && stories.length > 0) {
        const storiesWithTasks = await Promise.all(
          stories.map(async (story) => {
            try {
              const tasks = await backlogClient.get<Task[]>(`/stories/${story.id}/tasks`)
              return { ...story, tasks }
            } catch (taskError) {
              console.warn(
                `Failed to fetch tasks for story ${story.id}, continuing without tasks:`,
                taskError
              )
              return story
            }
          })
        )

        return storiesWithTasks
      }

      return stories
    } catch (error) {
      console.warn(
        `Failed to fetch stories for project ${projectId}, returning empty array:`,
        error
      )
      return []
    }
  },

  async getStory(projectId: string, storyId: string): Promise<Story> {
    return backlogClient.get<Story>(`/stories/${storyId}`)
  },

  async createStory(projectId: string, data: CreateStoryRequest): Promise<Story> {
    return backlogClient.post<Story>(`/projects/${projectId}/stories`, data)
  },

  async updateStory(projectId: string, storyId: string, data: UpdateStoryRequest): Promise<Story> {
    return backlogClient.patch<Story>(`/stories/${storyId}`, data)
  },

  async overrideStoryReady(projectId: string, storyId: string, reason?: string): Promise<Story> {
    return backlogClient.put<Story>(`/stories/${storyId}/ready-override`, { reason })
  },

  async updateStoryStatus(projectId: string, storyId: string, status: StoryStatus): Promise<Story> {
    return backlogClient.patch<Story>(`/stories/${storyId}/status`, { status })
  },

  async deleteStory(projectId: string, storyId: string): Promise<void> {
    return backlogClient.delete<void>(`/stories/${storyId}`)
  },

  // Tasks
  async getTasks(projectId: string, storyId: string): Promise<Task[]> {
    return backlogClient.get<Task[]>(`/stories/${storyId}/tasks`)
  },

  async getTask(projectId: string, storyId: string, taskId: string): Promise<Task> {
    return backlogClient.get<Task>(`/stories/${storyId}/tasks/${taskId}`)
  },

  async createTask(projectId: string, storyId: string, data: CreateTaskRequest): Promise<Task> {
    return backlogClient.post<Task>(`/stories/${storyId}/tasks`, {
      title: data.title,
      description: data.description,
      acceptance_criteria_refs: data.acceptanceCriteriaRefs,
    })
  },

  async updateTask(
    projectId: string,
    storyId: string,
    taskId: string,
    data: UpdateTaskRequest
  ): Promise<Task> {
    return backlogClient.patch<Task>(`/stories/${storyId}/tasks/${taskId}`, data)
  },

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return backlogClient.patch<Task>(`/tasks/${taskId}/status`, { status })
  },

  async deleteTask(projectId: string, storyId: string, taskId: string): Promise<void> {
    return backlogClient.delete<void>(`/stories/${storyId}/tasks/${taskId}`)
  },

  // Acceptance Criteria
  async getAcceptanceCriteria(projectId: string, storyId: string): Promise<AcceptanceCriterion[]> {
    return backlogClient.get<AcceptanceCriterion[]>(`/stories/${storyId}/acceptance-criteria`)
  },

  async createAcceptanceCriterion(
    projectId: string,
    storyId: string,
    data: {
      given: string
      when: string
      then: string
    }
  ): Promise<AcceptanceCriterion> {
    return backlogClient.post<AcceptanceCriterion>(`/stories/${storyId}/acceptance-criteria`, data)
  },

  async updateAcceptanceCriterion(
    projectId: string,
    storyId: string,
    criterionId: string,
    data: {
      given: string
      when: string
      then: string
    }
  ): Promise<AcceptanceCriterion> {
    return backlogClient.patch<AcceptanceCriterion>(
      `/stories/${storyId}/acceptance-criteria/${criterionId}`,
      data
    )
  },

  async deleteAcceptanceCriterion(
    projectId: string,
    storyId: string,
    criterionId: string
  ): Promise<void> {
    return backlogClient.delete<void>(`/stories/${storyId}/acceptance-criteria/${criterionId}`)
  },

  // Backlog management
  async reorderStories(projectId: string, storyIds: string[]): Promise<void> {
    return backlogClient.patch<void>(`/projects/${projectId}/stories/reorder`, { storyIds })
  },

  async reorderTasks(projectId: string, storyId: string, taskIds: string[]): Promise<void> {
    return backlogClient.patch<void>(`/projects/${projectId}/stories/${storyId}/tasks/reorder`, {
      taskIds,
    })
  },

  // Task Ownership API (Self-Selection "I'm on it" workflow)
  async getAvailableTasks(storyId: string): Promise<Task[]> {
    return backlogClient.get<Task[]>(`/stories/${storyId}/tasks/available`)
  },

  async getUserOwnedTasks(): Promise<Task[]> {
    return backlogClient.get<Task[]>('/tasks/owned')
  },

  async takeTaskOwnership(taskId: string): Promise<TaskOwnershipResponse> {
    return backlogClient.put<TaskOwnershipResponse>(`/tasks/${taskId}/ownership`)
  },

  async releaseTaskOwnership(taskId: string): Promise<TaskOwnershipResponse> {
    return backlogClient.delete<TaskOwnershipResponse>(`/tasks/${taskId}/ownership`)
  },

  async startTaskWork(taskId: string): Promise<TaskOwnershipResponse> {
    return backlogClient.post<TaskOwnershipResponse>(`/tasks/${taskId}/work/start`)
  },

  async completeTaskWork(taskId: string): Promise<TaskOwnershipResponse> {
    return backlogClient.post<TaskOwnershipResponse>(`/tasks/${taskId}/work/complete`)
  },

  async setTaskEstimate(
    taskId: string,
    request: SetTaskEstimateRequest
  ): Promise<TaskOwnershipResponse> {
    return backlogClient.patch<TaskOwnershipResponse>(`/tasks/${taskId}/estimate`, request)
  },

  // Enhanced story status updates
  async updateStoryStatusEnhanced(
    storyId: string,
    request: UpdateStoryStatusRequest
  ): Promise<Story> {
    return backlogClient.patch<Story>(`/stories/${storyId}/status`, request)
  },
}
