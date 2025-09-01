export type StoryStatus = 'backlog' | 'in-progress' | 'in-review' | 'done'

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked'

export type StoryPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Story {
  id: string
  projectId: string
  title: string
  description?: string
  status: StoryStatus
  priority?: StoryPriority
  storyPoints?: number
  labels: string[]
  createdAt: string
  updatedAt: string
  tasks?: Task[]
  acceptanceCriteria?: AcceptanceCriterion[]
}

export interface Task {
  id: string
  storyId: string
  title: string
  description?: string
  acceptanceCriteriaRefs: string[]
  createdAt: string
  updatedAt: string
}

export interface AcceptanceCriterion {
  id: string
  storyId: string
  acId: string
  given: string
  when: string
  then: string
  createdAt: string
}

export interface CreateStoryRequest {
  projectId: string
  title: string
  description?: string
  priority?: StoryPriority
  storyPoints?: number
  labels?: string[]
}

export interface UpdateStoryRequest {
  title?: string
  description?: string
  status?: StoryStatus
  labels?: string[]
}

export interface CreateTaskRequest {
  storyId: string
  title: string
  description?: string
  acceptanceCriteriaRefs: string[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  acceptanceCriteriaRefs?: string[]
}