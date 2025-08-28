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
  TaskStatus 
} from '@/lib/types/story'

// Mock data for demonstration
const mockStories: Record<string, Story[]> = {
  'proj-1': [
    {
      id: 'story-1',
      title: 'User Authentication System',
      description: 'As a user, I want to securely authenticate using Clerk so that I can access my personal projects and data',
      status: 'ready',
      priority: 'high',
      storyPoints: 8,
      projectId: 'proj-1',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-2',
      title: 'Project Dashboard',
      description: 'As a project manager, I want to see an overview of all my projects with key metrics so that I can quickly assess project health',
      status: 'in-progress',
      priority: 'high',
      storyPoints: 5,
      projectId: 'proj-1',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-3',
      title: 'Drag-and-Drop Sprint Board',
      description: 'As a scrum master, I want to drag stories between sprint board columns so that I can easily update story status during standups',
      status: 'done',
      priority: 'medium',
      storyPoints: 13,
      projectId: 'proj-1',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'story-4',
      title: 'AI Story Readiness Assessment',
      description: 'As a product owner, I want AI to analyze my stories and provide readiness feedback so that I know which stories are ready for development',
      status: 'backlog',
      priority: 'medium',
      storyPoints: 8,
      projectId: 'proj-1',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    }
  ],
  'proj-2': [
    {
      id: 'story-5',
      title: 'Mobile App Setup',
      description: 'As a developer, I want to set up the React Native project structure so that we can begin mobile development',
      status: 'ready',
      priority: 'critical',
      storyPoints: 5,
      projectId: 'proj-2',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]
}

const mockAcceptanceCriteria: Record<string, AcceptanceCriterion[]> = {
  'story-1': [
    {
      id: 'ac-1',
      given: 'I am an unregistered user',
      when: 'I visit the sign-up page',
      then: 'I should see a form to create a new account',
      storyId: 'story-1',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ac-2',
      given: 'I am a registered user with valid credentials',
      when: 'I attempt to sign in',
      then: 'I should be authenticated and redirected to the dashboard',
      storyId: 'story-1',
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]
}

const useMockData = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true'

export const backlogApi = {
  // Stories
  async getStories(projectId: string): Promise<Story[]> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 400))
      return mockStories[projectId] || []
    }
    return backlogClient.get<Story[]>(`/projects/${projectId}/stories`)
  },

  async getStory(projectId: string, storyId: string): Promise<Story> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const stories = mockStories[projectId] || []
      const story = stories.find(s => s.id === storyId)
      if (!story) throw new Error('Story not found')
      return story
    }
    return backlogClient.get<Story>(`/projects/${projectId}/stories/${storyId}`)
  },

  async createStory(projectId: string, data: CreateStoryRequest): Promise<Story> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 600))
      const newStory: Story = {
        id: `story-${Date.now()}`,
        title: data.title,
        description: data.description || '',
        status: 'draft',
        priority: data.priority || 'medium',
        storyPoints: data.storyPoints,
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      if (!mockStories[projectId]) mockStories[projectId] = []
      mockStories[projectId].push(newStory)
      return newStory
    }
    return backlogClient.post<Story>(`/projects/${projectId}/stories`, data)
  },

  async updateStory(projectId: string, storyId: string, data: UpdateStoryRequest): Promise<Story> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 400))
      const stories = mockStories[projectId] || []
      const storyIndex = stories.findIndex(s => s.id === storyId)
      if (storyIndex >= 0) {
        stories[storyIndex] = {
          ...stories[storyIndex],
          ...data,
          updatedAt: new Date().toISOString(),
        }
        return stories[storyIndex]
      }
      throw new Error('Story not found')
    }
    return backlogClient.patch<Story>(`/projects/${projectId}/stories/${storyId}`, data)
  },

  async updateStoryStatus(projectId: string, storyId: string, status: StoryStatus): Promise<Story> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const stories = mockStories[projectId] || []
      const storyIndex = stories.findIndex(s => s.id === storyId)
      if (storyIndex >= 0) {
        stories[storyIndex] = {
          ...stories[storyIndex],
          status,
          updatedAt: new Date().toISOString(),
        }
        return stories[storyIndex]
      }
      throw new Error('Story not found')
    }
    return backlogClient.patch<Story>(`/projects/${projectId}/stories/${storyId}/status`, { status })
  },

  async deleteStory(projectId: string, storyId: string): Promise<void> {
    return backlogClient.delete<void>(`/projects/${projectId}/stories/${storyId}`)
  },

  // Tasks
  async getTasks(projectId: string, storyId: string): Promise<Task[]> {
    return backlogClient.get<Task[]>(`/projects/${projectId}/stories/${storyId}/tasks`)
  },

  async getTask(projectId: string, storyId: string, taskId: string): Promise<Task> {
    return backlogClient.get<Task>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}`)
  },

  async createTask(projectId: string, storyId: string, data: CreateTaskRequest): Promise<Task> {
    return backlogClient.post<Task>(`/projects/${projectId}/stories/${storyId}/tasks`, data)
  },

  async updateTask(projectId: string, storyId: string, taskId: string, data: UpdateTaskRequest): Promise<Task> {
    return backlogClient.patch<Task>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}`, data)
  },

  async updateTaskStatus(projectId: string, storyId: string, taskId: string, status: TaskStatus): Promise<Task> {
    return backlogClient.patch<Task>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/status`, { status })
  },

  async deleteTask(projectId: string, storyId: string, taskId: string): Promise<void> {
    return backlogClient.delete<void>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}`)
  },

  // Acceptance Criteria
  async getAcceptanceCriteria(projectId: string, storyId: string): Promise<AcceptanceCriterion[]> {
    if (useMockData) {
      await new Promise(resolve => setTimeout(resolve, 200))
      return mockAcceptanceCriteria[storyId] || []
    }
    return backlogClient.get<AcceptanceCriterion[]>(`/projects/${projectId}/stories/${storyId}/acceptance-criteria`)
  },

  async createAcceptanceCriterion(projectId: string, storyId: string, data: { 
    given: string
    when: string
    then: string 
  }): Promise<AcceptanceCriterion> {
    return backlogClient.post<AcceptanceCriterion>(`/projects/${projectId}/stories/${storyId}/acceptance-criteria`, data)
  },

  async updateAcceptanceCriterion(projectId: string, storyId: string, criterionId: string, data: {
    given: string
    when: string
    then: string
  }): Promise<AcceptanceCriterion> {
    return backlogClient.patch<AcceptanceCriterion>(`/projects/${projectId}/stories/${storyId}/acceptance-criteria/${criterionId}`, data)
  },

  async deleteAcceptanceCriterion(projectId: string, storyId: string, criterionId: string): Promise<void> {
    return backlogClient.delete<void>(`/projects/${projectId}/stories/${storyId}/acceptance-criteria/${criterionId}`)
  },

  // Backlog management
  async reorderStories(projectId: string, storyIds: string[]): Promise<void> {
    return backlogClient.patch<void>(`/projects/${projectId}/stories/reorder`, { storyIds })
  },

  async reorderTasks(projectId: string, storyId: string, taskIds: string[]): Promise<void> {
    return backlogClient.patch<void>(`/projects/${projectId}/stories/${storyId}/tasks/reorder`, { taskIds })
  },
}