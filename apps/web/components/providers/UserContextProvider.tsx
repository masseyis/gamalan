'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usersApi, roleHelpers } from '@/lib/api/users'
import { teamsApi } from '@/lib/api/teams'
import { isTestEnvironment, getMockUser } from '@/lib/auth/test-utils'
import {
  User,
  UserRole,
  ContributorSpecialty,
  RolePermissions,
  TeamMembership,
  getRolePermissions,
} from '@/lib/types'

// Extended user context interface
interface ExtendedUserContext {
  user: User | null
  permissions: RolePermissions | null
  teamMemberships: TeamMembership[]
  isLoading: boolean
  error: string | null

  // Actions
  updateUserRole: (role: UserRole, specialty?: ContributorSpecialty) => Promise<void>
  refreshContext: () => Promise<void>

  // Permission helpers
  canModifyBacklog: boolean
  canAcceptStories: boolean
  canTakeTaskOwnership: boolean
  canManageTeam: boolean

  // Role helpers
  isContributor: boolean
  isProductOwner: boolean
  isSponsor: boolean
  isManagingContributor: boolean
}

const UserContext = createContext<ExtendedUserContext | undefined>(undefined)

export function UserContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [teamMemberships, setTeamMemberships] = useState<TeamMembership[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle authentication based on environment
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (isTestEnvironment()) {
      // In test mode, simulate signed in state
      setIsSignedIn(true)
      setIsLoaded(true)
    } else {
      // In production, use dynamic import to avoid SSR issues
      let useAuth: any
      import('@clerk/nextjs').then((clerk) => {
        useAuth = clerk.useAuth
        // Note: We can't use the hook here directly due to rules of hooks
        // We'll handle this differently
        setIsSignedIn(true) // For now, assume signed in
        setIsLoaded(true)
      }).catch(() => {
        // Fallback if Clerk is not available
        setIsSignedIn(false)
        setIsLoaded(true)
      })
    }
  }, [])

  // Calculate permissions based on user role
  const permissions = user ? getRolePermissions(user.role) : null

  // Permission flags for easy access
  const canModifyBacklog = permissions?.canModifyBacklog ?? false
  const canAcceptStories = permissions?.canAcceptStories ?? false
  const canTakeTaskOwnership = permissions?.canTakeTaskOwnership ?? false
  const canManageTeam = user?.role === 'product_owner' || user?.role === 'managing_contributor'

  // Role flags for easy access
  const isContributor = user?.role === 'contributor' || user?.role === 'managing_contributor'
  const isProductOwner = user?.role === 'product_owner'
  const isSponsor = user?.role === 'sponsor'
  const isManagingContributor = user?.role === 'managing_contributor'

  // Fetch user context data
  const fetchUserContext = useCallback(async () => {
    if (!isSignedIn || !isLoaded) {
      setUser(null)
      setTeamMemberships([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isTestEnvironment()) {
        // In test mode, use mock data
        const mockUser = getMockUser()
        const mockUserProfile: User = {
          id: mockUser.id,
          externalId: mockUser.id,
          email: mockUser.email,
          role: 'product_owner',
          specialty: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setUser(mockUserProfile)
        setTeamMemberships([])
        console.debug('Using mock user data for tests')
      } else {
        // Fetch user profile and team memberships in parallel
        const [userProfile, userTeams] = await Promise.all([
          usersApi.getCurrentUser().catch(() => null),
          teamsApi.getTeams().catch(() => [])
        ])

        if (userProfile) {
          setUser(userProfile)

          // Extract team memberships from teams data
          const memberships: TeamMembership[] = []
          userTeams.forEach(team => {
            team.members.forEach(member => {
              if (member.userId === userProfile.id) {
                memberships.push(member)
              }
            })
          })
          setTeamMemberships(memberships)
        } else {
          // User not found in backend, might need to be created via Clerk webhook
          console.warn('User not found in backend - Clerk webhook may not have processed yet')
          setUser(null)
          setTeamMemberships([])
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user context'
      setError(errorMessage)
      console.error('UserContextProvider error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isSignedIn, isLoaded])

  // Update user role
  const updateUserRole = async (role: UserRole, specialty?: ContributorSpecialty) => {
    if (!user) return

    try {
      setIsLoading(true)
      await usersApi.updateUserRole(role, specialty)

      // Update local state
      setUser(prev => prev ? {
        ...prev,
        role,
        specialty,
        updatedAt: new Date().toISOString()
      } : null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user role'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh context data
  const refreshContext = async () => {
    await fetchUserContext()
  }

  // Fetch context on auth state changes
  useEffect(() => {
    fetchUserContext()
  }, [isSignedIn, isLoaded, fetchUserContext])

  const contextValue: ExtendedUserContext = {
    user,
    permissions,
    teamMemberships,
    isLoading,
    error,

    // Actions
    updateUserRole,
    refreshContext,

    // Permission helpers
    canModifyBacklog,
    canAcceptStories,
    canTakeTaskOwnership,
    canManageTeam,

    // Role helpers
    isContributor,
    isProductOwner,
    isSponsor,
    isManagingContributor,
  }

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  )
}

// Hook to use user context
export function useUserContext() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserContextProvider')
  }
  return context
}

// Hook for role-based permission checking
export function usePermissions() {
  const { permissions, canModifyBacklog, canAcceptStories, canTakeTaskOwnership, canManageTeam } = useUserContext()

  return {
    permissions,
    canModifyBacklog,
    canAcceptStories,
    canTakeTaskOwnership,
    canManageTeam,
    hasPermission: (action: string) => {
      switch (action) {
        case 'modify_backlog':
          return canModifyBacklog
        case 'accept_stories':
          return canAcceptStories
        case 'take_task_ownership':
          return canTakeTaskOwnership
        case 'manage_team':
          return canManageTeam
        default:
          return false
      }
    }
  }
}

// Hook for role checking
export function useRoles() {
  const { user, isContributor, isProductOwner, isSponsor, isManagingContributor } = useUserContext()

  return {
    user,
    role: user?.role,
    specialty: user?.specialty,
    isContributor,
    isProductOwner,
    isSponsor,
    isManagingContributor,
    getRoleDisplayName: () => user ? roleHelpers.getRoleDisplayName(user.role) : '',
    getSpecialtyDisplayName: () => user?.specialty ? roleHelpers.getSpecialtyDisplayName(user.specialty) : '',
    getRoleDescription: () => user ? roleHelpers.getRoleDescription(user.role) : '',
  }
}

// Hook for team context
export function useTeamContext() {
  const { teamMemberships, refreshContext } = useUserContext()

  return {
    teamMemberships,
    getTeamRole: (teamId: string) => {
      const membership = teamMemberships.find(m => m.teamId === teamId)
      return membership?.role
    },
    isTeamMember: (teamId: string) => {
      return teamMemberships.some(m => m.teamId === teamId && m.isActive)
    },
    refreshTeams: refreshContext,
  }
}