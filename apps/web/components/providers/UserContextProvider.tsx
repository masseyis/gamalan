'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/nextjs'
import { usersApi, roleHelpers } from '@/lib/api/users'
import { teamsApi } from '@/lib/api/teams'
import {
  setGlobalAuthToken,
  setGlobalApiKey,
  projectsClient,
  backlogClient,
  readinessClient,
  promptBuilderClient,
  orchestratorClient,
  authGatewayClient,
  sprintClient,
} from '@/lib/api/client'
import { normalizeUserId } from '@/lib/utils/uuid'
import {
  User,
  UserRole,
  ContributorSpecialty,
  RolePermissions,
  TeamMembership,
  UserOrganization,
  getRolePermissions,
} from '@/lib/types'

// Extended user context interface
interface ExtendedUserContext {
  user: User | null
  permissions: RolePermissions | null
  teamMemberships: TeamMembership[]
  organizations: UserOrganization[]
  organizationMap: Record<string, string>
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

  // Organization helpers
  resolveOrganizationId: (externalId: string) => string | undefined
}

const UserContext = createContext<ExtendedUserContext | undefined>(undefined)

export function UserContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [teamMemberships, setTeamMemberships] = useState<TeamMembership[]>([])
  const [organizations, setOrganizations] = useState<UserOrganization[]>([])
  const [organizationMap, setOrganizationMap] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { getToken } = useAuth()
  const { isLoaded: isClerkLoaded, isSignedIn, user: clerkUser } = useUser()
  const personaApiKey = process.env.NEXT_PUBLIC_BATTRA_API_KEY

  const updateOrganizationMapping = useCallback((orgs: UserOrganization[]) => {
    setOrganizations(orgs)
    const mapping: Record<string, string> = {}
    orgs.forEach((org) => {
      if (org.externalId) {
        mapping[org.externalId] = org.id
      }
    })
    setOrganizationMap(mapping)
    if (typeof window !== 'undefined') {
      ;(window as any).__SALUNGA_ORG_ID_MAP = mapping
    }
  }, [])

  // Helper to clear user context on all API clients
  // Note: We don't set X-User-Id headers anymore - the backend derives user from JWT
  const clearAllClientsUserContext = useCallback(() => {
    const clients = [
      projectsClient,
      backlogClient,
      readinessClient,
      promptBuilderClient,
      orchestratorClient,
      authGatewayClient,
      sprintClient,
    ]

    clients.forEach((client) => client.clearUserContext())
  }, [])

  const clearOrganizationMapping = useCallback(() => {
    setOrganizations([])
    setOrganizationMap({})
    if (typeof window !== 'undefined') {
      delete (window as any).__SALUNGA_ORG_ID_MAP
    }
  }, [])

  useEffect(() => {
    if (personaApiKey) {
      setGlobalApiKey(personaApiKey)
      return () => {
        setGlobalApiKey()
      }
    }
    setGlobalApiKey()
    return () => {
      setGlobalApiKey()
    }
  }, [personaApiKey])

  // Calculate permissions based on user role
  const permissions = user ? getRolePermissions(user.role) : null

  // Permission flags for easy access
  const canModifyBacklog = permissions?.canModifyBacklog ?? true
  const canAcceptStories = permissions?.canAcceptStories ?? true
  const canTakeTaskOwnership = permissions?.canTakeTaskOwnership ?? true
  const canManageTeam = user?.role === 'product_owner' || user?.role === 'managing_contributor'

  // Role flags for easy access
  const isContributor = user?.role === 'contributor' || user?.role === 'managing_contributor'
  const isProductOwner = user?.role === 'product_owner'
  const isSponsor = user?.role === 'sponsor'
  const isManagingContributor = user?.role === 'managing_contributor'

  // Fetch user context data
  const fetchUserContext = useCallback(async () => {
    if (!isClerkLoaded || !isSignedIn) {
      setUser(null)
      clearAllClientsUserContext()
      setTeamMemberships([])
      clearOrganizationMapping()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = typeof getToken === 'function' ? await getToken() : null
      if (!token) {
        setGlobalAuthToken()
        setUser(null)
        clearAllClientsUserContext()
        setTeamMemberships([])
        clearOrganizationMapping()
        return
      }

      setGlobalAuthToken(token)

      const [userProfile, orgs] = await Promise.all([
        usersApi.getCurrentUser().catch(() => null),
        usersApi.getMyOrganizations().catch(() => [] as UserOrganization[]),
      ])

      updateOrganizationMapping(orgs)

      const userTeams = userProfile ? await teamsApi.getTeams().catch(() => []) : []

      let resolvedUser = userProfile

      if (!resolvedUser && clerkUser) {
        const primaryEmail =
          clerkUser.emailAddresses?.[0]?.emailAddress ??
          clerkUser.primaryEmailAddress?.emailAddress ??
          'unknown@example.com'
        const fallbackId =
          clerkUser.id ??
          (() => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
              return crypto.randomUUID()
            }
            return `fallback-${Date.now()}`
          })()
        resolvedUser = {
          id: fallbackId,
          externalId: clerkUser.id ?? fallbackId,
          email: primaryEmail,
          role: 'product_owner',
          specialty: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        console.warn(
          'User not found in backend - using Clerk profile as fallback',
          clerkUser?.id ? { clerkUserId: clerkUser.id } : undefined
        )
      }

      if (resolvedUser) {
        // If user came from backend, use their ID as-is (already correct internal UUID)
        // Only normalize if we're using the fallback (Clerk-only) user
        const userId = userProfile
          ? resolvedUser.id // Backend user - use ID directly
          : normalizeUserId(resolvedUser.id ?? resolvedUser.externalId ?? resolvedUser.email) // Fallback - normalize Clerk ID

        const externalId =
          resolvedUser.externalId ?? resolvedUser.id ?? resolvedUser.email ?? 'unknown'

        const finalUser: User = {
          ...resolvedUser,
          id: userId,
          externalId,
        }

        setUser(finalUser)

        if (userTeams.length) {
          const memberships: TeamMembership[] = []
          userTeams.forEach((team) => {
            team.members.forEach((member) => {
              if (member.userId === finalUser.id) {
                memberships.push(member)
              }
            })
          })
          setTeamMemberships(memberships)
        } else {
          setTeamMemberships([])
        }
      } else {
        setUser(null)
        clearAllClientsUserContext()
        setTeamMemberships([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user context'
      setError(errorMessage)
      clearOrganizationMapping()
      console.error('UserContextProvider error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [
    clerkUser,
    getToken,
    isClerkLoaded,
    isSignedIn,
    clearOrganizationMapping,
    updateOrganizationMapping,
    clearAllClientsUserContext,
  ])

  // Update user role
  const updateUserRole = async (role: UserRole, specialty?: ContributorSpecialty) => {
    if (!user) return

    try {
      setIsLoading(true)
      await usersApi.updateUserRole(role, specialty)

      // Update local state
      setUser((prev) =>
        prev
          ? {
              ...prev,
              role,
              specialty,
              updatedAt: new Date().toISOString(),
            }
          : null
      )
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
    if (!isClerkLoaded) {
      return
    }

    if (!isSignedIn) {
      setGlobalAuthToken()
      setUser(null)
      setTeamMemberships([])
      clearOrganizationMapping()
      return
    }

    fetchUserContext()
  }, [clearOrganizationMapping, fetchUserContext, isClerkLoaded, isSignedIn])

  const resolveOrganizationId = useCallback(
    (externalId: string) => organizationMap[externalId],
    [organizationMap]
  )

  const contextValue: ExtendedUserContext = {
    user,
    permissions,
    teamMemberships,
    organizations,
    organizationMap,
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

    // Organization helpers
    resolveOrganizationId,
  }

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
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
  const { permissions, canModifyBacklog, canAcceptStories, canTakeTaskOwnership, canManageTeam } =
    useUserContext()

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
          return true
      }
    },
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
    getRoleDisplayName: () => (user ? roleHelpers.getRoleDisplayName(user.role) : ''),
    getSpecialtyDisplayName: () =>
      user?.specialty ? roleHelpers.getSpecialtyDisplayName(user.specialty) : '',
    getRoleDescription: () => (user ? roleHelpers.getRoleDescription(user.role) : ''),
  }
}

// Hook for team context
export function useTeamContext() {
  const { teamMemberships, refreshContext } = useUserContext()

  return {
    teamMemberships,
    getTeamRole: (teamId: string) => {
      const membership = teamMemberships.find((m) => m.teamId === teamId)
      return membership?.role
    },
    isTeamMember: (teamId: string) => {
      return teamMemberships.some((m) => m.teamId === teamId && m.isActive)
    },
    refreshTeams: refreshContext,
  }
}
