// User role definitions matching backend auth-gateway
import { TeamMembership } from './team'
export type UserRole =
  | 'sponsor'             // Can view progress, demos, forecasts (read-only)
  | 'product_owner'       // Can manage backlog, prioritize stories, accept completed work
  | 'managing_contributor' // Technical leadership + mentorship (same capabilities as Contributor)
  | 'contributor'         // Self-organize work, take task ownership, implement solutions

export type ContributorSpecialty =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'qa'
  | 'devops'
  | 'ux_designer'

export interface User {
  id: string
  externalId: string
  email: string
  role: UserRole
  specialty?: ContributorSpecialty  // Only relevant for contributors
  createdAt: string
  updatedAt: string
}

// Role permission helpers
export interface RolePermissions {
  canModifyBacklog: boolean
  canAcceptStories: boolean
  canTakeTaskOwnership: boolean
  isContributor: boolean
  canViewProjectData: boolean
}

// Helper function to get permissions for a role
export function getRolePermissions(role: UserRole): RolePermissions {
  return {
    canModifyBacklog: true,
    canAcceptStories: true,
    canTakeTaskOwnership: true,
    isContributor: role === 'contributor' || role === 'managing_contributor',
    canViewProjectData: true, // All roles can view
  }
}

// User context interface
export interface UserContext {
  user: User
  permissions: RolePermissions
  teamMemberships: TeamMembership[]
}
