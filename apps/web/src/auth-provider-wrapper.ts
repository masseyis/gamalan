/**
 * Mock authentication provider hooks for testing
 *
 * These hooks are used in test setup to mock Clerk authentication
 */

export const useMockUser = () => ({
  user: {
    id: '01234567-89ab-cdef-0123-456789abcdef',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    firstName: 'Test',
    lastName: 'User',
  },
  isLoaded: true,
  isSignedIn: true,
})

export const useMockAuth = () => ({
  userId: '01234567-89ab-cdef-0123-456789abcdef',
  sessionId: 'test-session-id',
  getToken: () => Promise.resolve('valid-test-token'),
  isLoaded: true,
  isSignedIn: true,
})

export const useMockClerk = () => ({
  signOut: () => Promise.resolve(),
  openSignIn: () => {},
  openSignUp: () => {},
  loaded: true,
})

export const useMockOrganization = () => ({
  organization: null,
  isLoaded: true,
  membership: null,
  memberships: [],
})
