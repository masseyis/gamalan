import { authGatewayClient } from './client'
import {
  User,
  UserRole,
  ContributorSpecialty,
  RolePermissions,
  UserContext,
  ApiResponse,
  UserOrganization,
} from '../types'

// User Management API
export const usersApi = {
  // Get current user profile
  async getCurrentUser(): Promise<User> {
    return authGatewayClient.get<User>('/users/me')
  },

  // Get user by ID
  async getUser(userId: string): Promise<User> {
    return authGatewayClient.get<User>(`/users/${userId}`)
  },

  // Update current user role and specialty
  async updateUserRole(
    role: UserRole,
    specialty?: ContributorSpecialty
  ): Promise<ApiResponse<void>> {
    return authGatewayClient.patch<ApiResponse<void>>('/users/me/role', {
      role,
      specialty,
    })
  },

  // Get user context (user + permissions + team memberships)
  async getUserContext(): Promise<UserContext> {
    return authGatewayClient.get<UserContext>('/users/me/context')
  },

  async getMyOrganizations(): Promise<UserOrganization[]> {
    const response = await authGatewayClient.get<{ organizations: UserOrganization[] }>(
      '/users/me/organizations'
    )
    return response.organizations
  },

  // Search users (for team invitations, etc.)
  async searchUsers(query: string): Promise<User[]> {
    return authGatewayClient.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`)
  },

  // Get users by team
  async getUsersByTeam(teamId: string): Promise<User[]> {
    return authGatewayClient.get<User[]>(`/teams/${teamId}/users`)
  },
}

// Organization Management API (if needed)
export const organizationsApi = {
  // Get current organization
  async getCurrentOrganization(): Promise<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }> {
    return authGatewayClient.get('/organizations/current')
  },

  // Get organization members
  async getOrganizationMembers(): Promise<User[]> {
    return authGatewayClient.get<User[]>('/organizations/current/members')
  },
}

// Role and permission helpers
export const roleHelpers = {
  // Get display name for role
  getRoleDisplayName(role: UserRole): string {
    const roleNames = {
      sponsor: 'Sponsor',
      product_owner: 'Product Owner',
      managing_contributor: 'Managing Contributor',
      contributor: 'Contributor',
    }
    return roleNames[role]
  },

  // Get display name for specialty
  getSpecialtyDisplayName(specialty: ContributorSpecialty): string {
    const specialtyNames = {
      frontend: 'Frontend',
      backend: 'Backend',
      fullstack: 'Fullstack',
      qa: 'QA',
      devops: 'DevOps',
      ux_designer: 'UX Designer',
    }
    return specialtyNames[specialty]
  },

  // Check if user can perform an action
  canUserPerformAction(
    user: User,
    action: 'modify_backlog' | 'accept_stories' | 'take_task_ownership' | 'manage_team'
  ): boolean {
    switch (action) {
      case 'modify_backlog':
        return user.role === 'product_owner'
      case 'accept_stories':
        return user.role === 'product_owner'
      case 'take_task_ownership':
        return user.role === 'contributor' || user.role === 'managing_contributor'
      case 'manage_team':
        return user.role === 'product_owner' || user.role === 'managing_contributor'
      default:
        return false
    }
  },

  // Get role description for UI
  getRoleDescription(role: UserRole): string {
    const descriptions = {
      sponsor: 'View progress, demos, and forecasts (read-only access)',
      product_owner: 'Manage backlog, prioritize stories, and accept completed work',
      managing_contributor: 'Technical leadership, mentorship, and all contributor capabilities',
      contributor: 'Self-organize work, take task ownership, and implement solutions',
    }
    return descriptions[role]
  },

  // Get specialty description for UI
  getSpecialtyDescription(specialty: ContributorSpecialty): string {
    const descriptions = {
      frontend: 'User interface and client-side development',
      backend: 'Server-side logic and API development',
      fullstack: 'Both frontend and backend development',
      qa: 'Quality assurance and testing',
      devops: 'Infrastructure, deployment, and operations',
      ux_designer: 'User experience and interface design',
    }
    return descriptions[specialty]
  },

  // Validate role and specialty combination
  validateRoleSpecialty(
    role: UserRole,
    specialty?: ContributorSpecialty
  ): {
    isValid: boolean
    error?: string
  } {
    // Only contributors can have specialties
    if ((role === 'contributor' || role === 'managing_contributor') && !specialty) {
      return {
        isValid: false,
        error: 'Contributors must specify a specialty',
      }
    }

    // Non-contributors cannot have specialties
    if ((role === 'sponsor' || role === 'product_owner') && specialty) {
      return {
        isValid: false,
        error: 'Non-contributors cannot have specialties',
      }
    }

    return { isValid: true }
  },

  // Get available actions for a user role
  getAvailableActions(role: UserRole): string[] {
    const actions = {
      sponsor: ['View projects', 'View progress', 'View demos', 'View forecasts'],
      product_owner: [
        'Manage backlog',
        'Prioritize stories',
        'Accept completed work',
        'Create projects',
        'Manage teams',
        'View all content',
      ],
      managing_contributor: [
        'Take task ownership',
        'Implement solutions',
        'Provide mentorship',
        'Technical leadership',
        'Self-organize work',
        'Manage team members',
      ],
      contributor: [
        'Take task ownership',
        'Implement solutions',
        'Self-organize work',
        'Estimate tasks',
        'View team progress',
      ],
    }
    return actions[role]
  },
}
