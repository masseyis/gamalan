import { useUser, useOrganization } from '@clerk/nextjs'

/**
 * Hook to get the current organization context for API calls
 * Returns the current organization ID or user ID for personal workspace
 */
export function useOrganizationContext() {
  // Use standard Clerk hooks
  const { user } = useUser()
  const { organization } = useOrganization()

  // For API calls, we need to determine the context:
  // - If in an organization, use the organization ID
  // - If personal workspace, use the user ID
  const contextId = organization?.id || user?.id
  const contextType = organization ? 'organization' : 'personal'
  const isPersonal = !organization

  return {
    contextId,
    contextType,
    isPersonal,
    organization,
    user,
    // Helper to get headers for API calls
    getApiHeaders: () => ({
      'X-Organization-Id': organization?.id || '',
      'X-User-Id': user?.id || '',
      'X-Context-Type': contextType
    })
  }
}