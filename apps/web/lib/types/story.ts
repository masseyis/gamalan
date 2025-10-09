// Updated to match backend enum StoryStatus
export type StoryStatus =
  | 'draft'
  | 'needsrefinement'
  | 'ready'
  | 'committed'
  | 'inprogress'
  | 'taskscomplete'
  | 'deployed'
  | 'awaitingacceptance'
  | 'accepted'

// Updated to match backend enum TaskStatus
export type TaskStatus =
  | 'available'  // Task is created and available for contributors to take ownership
  | 'owned'      // Task is owned by a contributor ("I'm on it")
  | 'inprogress' // Task work is in progress
  | 'completed'  // Task is completed

export type StoryPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Story {
  id: string
  projectId: string
  title: string
  description?: string
  status: StoryStatus
  priority?: StoryPriority
  storyPoints?: number  // Max 8 points
  labels: string[]
  sprintId?: string
  assignedToUserId?: string
  readinessOverride?: boolean
  readinessOverrideBy?: string
  readinessOverrideReason?: string
  readinessOverrideAt?: string
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
  status: TaskStatus
  ownerUserId?: string
  estimatedHours?: number
  createdAt: string
  updatedAt: string
  ownedAt?: string
  completedAt?: string
}

export interface AcceptanceCriterion {
  id: string
  storyId: string
  acId?: string  // Optional for plan pack integration
  description: string
  given: string
  whenClause: string  // Backend uses when_clause to avoid SQL keyword
  thenClause: string  // Backend uses then_clause to avoid SQL keyword
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

// Task ownership interfaces
export interface TaskOwnershipResponse {
  success: boolean
  message: string
}

export interface SetTaskEstimateRequest {
  estimatedHours?: number
}

// Story status update interface
export interface UpdateStoryStatusRequest {
  status: StoryStatus
}
