/**
 * Authentication utilities for testing
 * Provides mock authentication for local E2E tests without requiring real Clerk credentials
 */

export interface MockUser {
  id: string
  email: string
  firstName: string
  lastName: string
  organizationId?: string
  imageUrl?: string
}

export const isTestEnvironment = (): boolean => {
  // Check browser-side flags first (most reliable in test environment)
  if (typeof window !== 'undefined') {
    if (window.__MOCK_AUTH__ || window.__MOCK_DATA__) {
      return true
    }
  }

  // Check environment variables (works during build and server-side)
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true'
  )
}

export const getMockUser = (): MockUser => ({
  id: 'test-user-123',
  email: 'testuser@example.com',
  firstName: 'Test',
  lastName: 'User',
  organizationId: 'test-org-123',
  imageUrl: 'https://via.placeholder.com/64x64/4F46E5/FFFFFF?text=TU'
})

export const getMockSession = () => ({
  user: getMockUser(),
  session: {
    id: 'test-session-123',
    status: 'active',
    lastActiveAt: new Date(),
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },
  organization: {
    id: 'test-org-123',
    name: 'Test Organization',
    slug: 'test-org'
  }
})

/**
 * Setup mock authentication for Playwright tests
 * Call this in test.beforeEach() to enable mock auth
 */
export const setupMockAuth = async (page: any) => {
  // Set environment variable to enable mock auth in middleware
  await page.addInitScript(() => {
    // Override process.env to enable mock auth
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'process', {
        value: {
          env: {
            ...window.process?.env,
            NEXT_PUBLIC_ENABLE_MOCK_AUTH: 'true',
            NEXT_PUBLIC_ENABLE_MOCK_DATA: 'true'
          }
        }
      })
    }

    // Set global flags for mock auth and data
    window.__MOCK_AUTH__ = true
    window.__MOCK_DATA__ = true
    window.__TEST_USER__ = {
      id: 'test-user-123',
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'test-org-123',
      imageUrl: 'https://via.placeholder.com/64x64/4F46E5/FFFFFF?text=TU'
    }

    // Mock localStorage for JWT token
    window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token-for-testing')
    window.localStorage.setItem('__clerk_user', JSON.stringify(window.__TEST_USER__))

    // Mock sessionStorage if needed
    window.sessionStorage.setItem('clerk-session', 'mock-session-123')

    // Mock any direct Clerk hook calls that might happen
    // Create global mock functions that can be used if Clerk hooks are called
    ;(window as any).__MOCK_CLERK_HOOKS__ = {
      useAuth: () => ({
        userId: 'test-user-123',
        isSignedIn: true,
        isLoaded: true,
        getToken: () => Promise.resolve('mock-jwt-token-for-testing')
      }),
      useUser: () => ({
        user: window.__TEST_USER__,
        isSignedIn: true,
        isLoaded: true
      }),
      useOrganization: () => ({
        organization: {
          id: 'test-org-123',
          name: 'Test Organization'
        },
        isLoaded: true
      }),
      useOrganizationList: () => ({
        userMemberships: {
          data: [{
            organization: {
              id: 'test-org-123',
              name: 'Test Organization',
              membersCount: 5
            }
          }]
        },
        setActive: () => Promise.resolve(),
        isLoaded: true
      })
    }

    // Log when we're in test mode for debugging
    console.log('Mock auth setup completed - test environment enabled')
  })

  // Also set the environment variable at the page level
  await page.context().addInitScript(() => {
    window.process = window.process || { env: {} }
    window.process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = 'true'
    window.process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA = 'true'
  })
}

/**
 * Mock API responses for testing
 * Use this to provide consistent test data
 */
export const getMockProjects = () => [
  {
    id: 'project-1',
    name: 'Test Project Alpha',
    description: 'A test project for automated testing',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ownerId: 'test-user-123'
  },
  {
    id: 'project-2',
    name: 'Test Project Beta',
    description: 'Another test project for validation',
    status: 'active',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    ownerId: 'test-user-123'
  }
]

export const getMockStories = () => [
  {
    id: 'story-1',
    projectId: 'project-1',
    title: 'User Authentication System',
    description: 'As a user, I want to log in to access the application securely',
    status: 'inprogress',
    priority: 'high',
    points: 8,
    acceptanceCriteria: [
      {
        id: 'ac-1',
        given: 'I am on the login page',
        when: 'I enter valid credentials',
        then: 'I should be redirected to the dashboard'
      }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'story-2',
    projectId: 'project-1',
    title: 'Project Dashboard',
    description: 'As a user, I want to create new projects to organize my work',
    status: 'inprogress',
    priority: 'medium',
    points: 5,
    acceptanceCriteria: [
      {
        id: 'ac-2',
        given: 'I am on the projects page',
        when: 'I click create project',
        then: 'I should see a project creation form'
      }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'story-3',
    projectId: 'project-1',
    title: 'Drag-and-Drop Sprint Board',
    description: 'As a product owner, I want to estimate story complexity',
    status: 'accepted',
    priority: 'low',
    points: 3,
    acceptanceCriteria: [
      {
        id: 'ac-3',
        given: 'I have a story with acceptance criteria',
        when: 'I assign story points',
        then: 'The estimation should be saved'
      }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

// Global type augmentation for test environment
declare global {
  interface Window {
    __MOCK_AUTH__?: boolean
    __MOCK_DATA__?: boolean
    __TEST_USER__?: MockUser
  }
}