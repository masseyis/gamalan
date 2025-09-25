import { useConditionalAuth, useMockOrganization } from '@/app/auth-provider-wrapper'

/**
 * Hook to get the current organization context for API calls
 * Returns the current organization ID or user ID for personal workspace
 * Works with both real Clerk auth and mock auth for testing
 */
export function useOrganizationContext() {
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

  // Use mock hooks for E2E tests, real Clerk hooks for production
  const { user } = useConditionalAuth()
  const { organization } = useMockOrganization()

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