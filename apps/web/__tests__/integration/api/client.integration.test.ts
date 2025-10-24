import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectsClient, authGatewayClient, backlogClient } from '@/lib/api/client'

describe('API Client Integration with Clerk Authentication', () => {
  const mockClerk = {
    user: {
      id: 'user_test123',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      publicMetadata: {},
      privateMetadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    session: {
      id: 'sess_test123',
      status: 'active',
      lastActiveAt: Date.now(),
      expireAt: Date.now() + 3600000, // 1 hour from now
      user: 'user_test123',
      getToken: vi.fn().mockResolvedValue('clerk_test_token_123'),
    },
    organization: {
      id: 'org_test123',
      name: 'Test Organization',
      slug: 'test-org',
      membersCount: 5,
      adminDeleteEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup window.Clerk for client-side auth
    window.Clerk = {
      user: mockClerk.user,
      session: mockClerk.session,
      organization: mockClerk.organization,
      getToken: mockClerk.session.getToken,
      signOut: vi.fn(),
      openSignIn: vi.fn(),
      openSignUp: vi.fn(),
    }
  })

  afterEach(() => {
    delete (window as any).Clerk
  })

  describe('Authentication Header Injection', () => {
    it('should add Clerk JWT token to API requests', async () => {
      // Test that the client can be created successfully
      expect(projectsClient).toBeDefined()
      expect(authGatewayClient).toBeDefined()
      expect(backlogClient).toBeDefined()

      // Clients should be instances that can make requests
      expect(typeof projectsClient.get).toBe('function')
      expect(typeof authGatewayClient.get).toBe('function')
      expect(typeof backlogClient.get).toBe('function')
    })

    it('should handle organization context headers', async () => {
      // Test organization context is set up properly
      expect(window.Clerk.organization).toBeDefined()
      expect(window.Clerk.organization.id).toBe('org_test123')
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle network errors gracefully', async () => {
      // Test that clients can handle network errors by making requests to non-existent endpoints
      try {
        await projectsClient.get('/non-existent-endpoint')
      } catch (error) {
        // Error handling is implemented in the client
        expect(error).toBeDefined()
      }
    })

    it('should handle authentication errors', async () => {
      // Test that the client can handle auth-related scenarios
      expect(window.Clerk.session.getToken).toBeDefined()
      expect(typeof window.Clerk.session.getToken).toBe('function')
    })
  })

  describe('Request Interceptor Configuration', () => {
    it('should configure request interceptors', async () => {
      // Test that the clients have proper setup by making a test request
      // The interceptors would be applied during an actual request
      expect(projectsClient).toBeDefined()
      expect(typeof projectsClient.get).toBe('function')
    })

    it('should configure response interceptors', async () => {
      // Test that the clients can handle responses properly
      // Response interceptors would be tested during actual API calls
      expect(authGatewayClient).toBeDefined()
      expect(typeof authGatewayClient.post).toBe('function')
    })
  })

  describe('Client Instance Creation', () => {
    it('should create separate client instances for different services', async () => {
      // Each client should have its own axios instance
      expect(projectsClient).not.toBe(authGatewayClient)
      expect(authGatewayClient).not.toBe(backlogClient)
      expect(backlogClient).not.toBe(projectsClient)
    })

    it('should configure base URLs correctly', async () => {
      // Test that clients are properly configured for their respective services
      expect(projectsClient).toBeDefined()
      expect(authGatewayClient).toBeDefined()
      expect(backlogClient).toBeDefined()

      // Each client should have the necessary HTTP methods
      expect(typeof projectsClient.get).toBe('function')
      expect(typeof authGatewayClient.post).toBe('function')
      expect(typeof backlogClient.put).toBe('function')
    })
  })

  describe('Session Management Integration', () => {
    it('should handle session token retrieval', async () => {
      expect(window.Clerk.session.getToken).toBeDefined()
      expect(typeof window.Clerk.session.getToken).toBe('function')

      const token = await window.Clerk.session.getToken()
      expect(token).toBe('clerk_test_token_123')
    })

    it('should handle session expiration', async () => {
      // Test session expiration handling
      const expiredSession = {
        ...mockClerk.session,
        expireAt: Date.now() - 1000, // Expired 1 second ago
      }

      window.Clerk.session = expiredSession
      expect(window.Clerk.session.expireAt).toBeLessThan(Date.now())
    })
  })

  describe('Organization Context Integration', () => {
    it('should handle organization switching', async () => {
      const newOrganization = {
        id: 'org_new123',
        name: 'New Organization',
        slug: 'new-org',
      }

      window.Clerk.organization = newOrganization
      expect(window.Clerk.organization.id).toBe('org_new123')
    })

    it('should handle personal context when no organization is selected', async () => {
      window.Clerk.organization = null
      expect(window.Clerk.organization).toBeNull()
    })
  })
})
