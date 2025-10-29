import { authGatewayClient } from './client'
import {
  Team,
  TeamMembership,
  TeamWithMembers,
  CreateTeamRequest,
  CreateTeamResponse,
  JoinTeamRequest,
  Sprint,
  CreateSprintRequest,
  CreateSprintResponse,
  UpdateSprintRequest,
  UpdateSprintStatusRequest,
  SprintStatus,
  ApiResponse,
  AddTeamMemberRequest,
} from '../types'

type RawTeamResponse = {
  id: string
  name: string
  description?: string | null
  organizationId: string
  activeSprintId?: string | null
  currentSprint?: RawSprintResponse | null
  velocityHistory?: number[]
  createdAt: string
  updatedAt: string
  members?: RawTeamMemberResponse[]
}

type RawTeamMemberResponse = {
  id?: string
  teamId: string
  userId: string
  role: string
  specialty?: string | null
  isActive: boolean
  joinedAt: string
  updatedAt?: string
  userEmail?: string | null
  userName?: string | null
}

type RawSprintResponse = {
  id: string
  teamId: string
  name: string
  goal: string
  status: string
  capacityPoints?: number | null
  committedPoints?: number | null
  committedStoryPoints?: number | null
  completedPoints?: number | null
  completedStoryPoints?: number | null
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
}

const toSprint = (raw?: RawSprintResponse | null): Sprint | undefined => {
  if (!raw) {
    return undefined
  }

  return {
    id: raw.id,
    teamId: raw.teamId,
    name: raw.name,
    goal: raw.goal,
    status: (raw.status as SprintStatus) ?? 'planning',
    capacityPoints: raw.capacityPoints ?? 0,
    committedPoints: raw.committedPoints ?? raw.committedStoryPoints ?? 0,
    completedPoints: raw.completedPoints ?? raw.completedStoryPoints ?? 0,
    startDate: raw.startDate,
    endDate: raw.endDate,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

const toTeamWithMembers = (raw: RawTeamResponse): TeamWithMembers => {
  const members = (raw.members ?? []).map((member) => ({
    id: member.id ?? `${member.teamId}:${member.userId}`,
    teamId: member.teamId,
    userId: member.userId,
    role: member.role as TeamMembership['role'],
    specialty: (member.specialty ?? undefined) as TeamMembership['specialty'],
    isActive: member.isActive,
    joinedAt: member.joinedAt,
    updatedAt: member.updatedAt ?? member.joinedAt,
    userEmail: member.userEmail ?? undefined,
    userName: member.userName ?? undefined,
  }))

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    organizationId: raw.organizationId,
    activeSprintId: raw.activeSprintId ?? undefined,
    velocityHistory: raw.velocityHistory ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    members,
    currentSprint: toSprint(raw.currentSprint),
  }
}

// Team Management API
export const teamsApi = {
  // Get teams for current user/organization
  async getTeams(): Promise<TeamWithMembers[]> {
    const response = await authGatewayClient.get<RawTeamResponse[]>('/teams')
    if (!Array.isArray(response)) {
      return []
    }
    return response.map(toTeamWithMembers)
  },

  // Get specific team with members
  async getTeam(teamId: string): Promise<TeamWithMembers> {
    const response = await authGatewayClient.get<RawTeamResponse>(`/teams/${teamId}`)
    return toTeamWithMembers(response)
  },

  // Create a new team
  async createTeam(request: CreateTeamRequest): Promise<CreateTeamResponse> {
    const response = await authGatewayClient.post<RawTeamResponse>('/teams', {
      name: request.name,
    })
    return toTeamWithMembers(response)
  },

  // Update team details
  async updateTeam(
    teamId: string,
    updates: { name: string; description?: string }
  ): Promise<ApiResponse<void>> {
    return authGatewayClient.put<ApiResponse<void>>(`/teams/${teamId}`, updates)
  },

  // Delete team
  async deleteTeam(teamId: string): Promise<ApiResponse<void>> {
    return authGatewayClient.delete<ApiResponse<void>>(`/teams/${teamId}`)
  },

  async addMember(teamId: string, request: AddTeamMemberRequest): Promise<ApiResponse<void>> {
    return authGatewayClient.post<ApiResponse<void>>(`/teams/${teamId}/members`, {
      user_id: request.userId,
      role: request.role,
      specialty: request.specialty,
    })
  },

  // Join an existing team
  async joinTeam(request: JoinTeamRequest): Promise<ApiResponse<void>> {
    return authGatewayClient.post<ApiResponse<void>>('/teams/join', request)
  },

  // Get team members
  async getTeamMembers(teamId: string): Promise<TeamMembership[]> {
    return authGatewayClient.get<TeamMembership[]>(`/teams/${teamId}/members`)
  },

  // Leave a team
  async leaveTeam(teamId: string): Promise<ApiResponse<void>> {
    return authGatewayClient.delete<ApiResponse<void>>(`/teams/${teamId}/members/me`)
  },

  // Update team membership (for managers)
  async updateMembership(
    teamId: string,
    userId: string,
    updates: Partial<Pick<TeamMembership, 'role' | 'specialty' | 'isActive'>>
  ): Promise<ApiResponse<void>> {
    return authGatewayClient.patch<ApiResponse<void>>(`/teams/${teamId}/members/${userId}`, updates)
  },

  // Remove team member (for managers)
  async removeMember(teamId: string, userId: string): Promise<ApiResponse<void>> {
    return authGatewayClient.delete<ApiResponse<void>>(`/teams/${teamId}/members/${userId}`)
  },
}

// Sprint Management API
export const sprintsApi = {
  // Get sprints for a team
  async getSprints(teamId: string): Promise<Sprint[]> {
    return authGatewayClient.get<Sprint[]>(`/teams/${teamId}/sprints`)
  },

  // Get specific sprint
  async getSprint(teamId: string, sprintId: string): Promise<Sprint> {
    const response = await authGatewayClient.get<RawSprintResponse>(`/sprints/${sprintId}`)
    const sprint = toSprint(response)
    if (!sprint) {
      throw new Error('Sprint not found')
    }
    return sprint
  },

  // Get all sprints for team
  async getTeamSprints(teamId: string): Promise<Sprint[]> {
    return authGatewayClient.get<Sprint[]>(`/teams/${teamId}/sprints`)
  },

  // Get current active sprint for team
  async getActiveSprint(teamId: string): Promise<Sprint | null> {
    return authGatewayClient.get<Sprint | null>(`/teams/${teamId}/sprints/active`)
  },

  // Create a new sprint
  async createSprint(request: CreateSprintRequest): Promise<CreateSprintResponse> {
    return authGatewayClient.post<CreateSprintResponse>('/sprints', request)
  },

  // Update sprint details
  async updateSprint(sprintId: string, updates: UpdateSprintRequest): Promise<ApiResponse<void>> {
    return authGatewayClient.patch<ApiResponse<void>>(`/sprints/${sprintId}`, updates)
  },

  // Update sprint status (start, end, complete, etc.)
  async updateSprintStatus(
    sprintId: string,
    request: UpdateSprintStatusRequest
  ): Promise<ApiResponse<void>> {
    switch (request.status) {
      case 'active':
        return authGatewayClient.post<ApiResponse<void>>(`/sprints/${sprintId}/start`)
      case 'review':
        return authGatewayClient.patch<ApiResponse<void>>(`/sprints/${sprintId}/review`)
      case 'completed':
        return authGatewayClient.post<ApiResponse<void>>(`/sprints/${sprintId}/complete`)
      case 'planning':
      default:
        throw new Error(`Unsupported sprint status transition to ${request.status}`)
    }
  },

  // Delete sprint (only if in planning)
  async deleteSprint(sprintId: string): Promise<ApiResponse<void>> {
    return authGatewayClient.delete<ApiResponse<void>>(`/sprints/${sprintId}`)
  },

  // Get sprint velocity data
  async getSprintVelocity(sprintId: string): Promise<{
    sprintId: string
    capacityPoints: number
    committedPoints: number
    completedPoints: number
    velocity: number
  }> {
    return authGatewayClient.get(`/sprints/${sprintId}/velocity`)
  },

  // Get team velocity history
  async getTeamVelocityHistory(teamId: string): Promise<{
    teamId: string
    velocityHistory: number[]
    averageVelocity: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }> {
    return authGatewayClient.get(`/teams/${teamId}/velocity`)
  },
}

// Helper functions for sprint workflow
export const sprintHelpers = {
  // Check if sprint can be started
  canStartSprint(sprint: Sprint): boolean {
    return sprint.status === 'planning' && sprint.committedPoints > 0
  },

  // Check if sprint can be ended
  canEndSprint(sprint: Sprint): boolean {
    return sprint.status === 'active'
  },

  // Check if sprint can be completed
  canCompleteSprint(sprint: Sprint): boolean {
    return sprint.status === 'review'
  },

  // Calculate sprint progress
  calculateSprintProgress(sprint: Sprint): {
    progressPercentage: number
    pointsRemaining: number
    isOnTrack: boolean
  } {
    const progressPercentage =
      sprint.committedPoints > 0 ? (sprint.completedPoints / sprint.committedPoints) * 100 : 0

    const pointsRemaining = sprint.committedPoints - sprint.completedPoints

    // Simple heuristic: on track if we're completing points roughly in line with time elapsed
    const now = new Date()
    const start = new Date(sprint.startDate)
    const end = new Date(sprint.endDate)
    const totalDuration = end.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    const timeProgressPercentage = Math.min((elapsed / totalDuration) * 100, 100)

    const isOnTrack = progressPercentage >= timeProgressPercentage * 0.8 // 80% of expected progress

    return {
      progressPercentage,
      pointsRemaining,
      isOnTrack,
    }
  },

  // Get days remaining in sprint
  getDaysRemaining(sprint: Sprint): number {
    const now = new Date()
    const end = new Date(sprint.endDate)
    const msPerDay = 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))
  },

  // Validate sprint dates
  validateSprintDates(
    startDate: string,
    endDate: string
  ): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (end <= start) {
      errors.push('End date must be after start date')
    }

    const duration = end.getTime() - start.getTime()
    const days = duration / (24 * 60 * 60 * 1000)

    if (days > 28) {
      errors.push('Sprint cannot exceed 28 days (4 weeks)')
    }

    if (days < 1) {
      errors.push('Sprint must be at least 1 day long')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  },
}
