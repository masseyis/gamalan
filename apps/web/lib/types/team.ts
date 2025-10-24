import { UserRole, ContributorSpecialty } from './user'

export interface Team {
  id: string
  name: string
  description?: string
  organizationId: string
  activeSprintId?: string
  velocityHistory: number[] // Array of last 10 sprint velocities
  createdAt: string
  updatedAt: string
}

export interface TeamMembership {
  id: string
  teamId: string
  userId: string
  role: UserRole
  specialty?: ContributorSpecialty // Only for contributors
  isActive: boolean
  joinedAt: string
  updatedAt: string
}

export interface AddTeamMemberRequest {
  userId: string
  role: UserRole
  specialty?: ContributorSpecialty
}

export interface Sprint {
  id: string
  teamId: string
  name: string
  goal: string
  status: SprintStatus
  capacityPoints: number
  committedPoints: number
  completedPoints: number
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
}

export type SprintStatus = 'planning' | 'active' | 'review' | 'completed'

// Request/Response interfaces
export interface CreateTeamRequest {
  name: string
}

export type CreateTeamResponse = TeamWithMembers

export interface JoinTeamRequest {
  teamId: string
  role: UserRole
  specialty?: ContributorSpecialty
}

export interface CreateSprintRequest {
  teamId: string
  name: string
  goal: string
  capacityPoints: number
  startDate: string
  endDate: string
}

export interface CreateSprintResponse {
  sprintId: string
}

export interface UpdateSprintStatusRequest {
  status: SprintStatus
}

export interface UpdateSprintRequest {
  name?: string
  goal?: string
  capacityPoints?: number
  startDate?: string
  endDate?: string
}

// Sprint constraints
export const SPRINT_CONSTRAINTS = {
  MAX_DURATION_DAYS: 28,
  MIN_DURATION_DAYS: 1,
} as const

// Team with members interface for UI
export interface TeamWithMembers extends Team {
  members: (TeamMembership & {
    userEmail?: string
    userName?: string
  })[]
  currentSprint?: Sprint
}
