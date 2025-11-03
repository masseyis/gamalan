import '@testing-library/jest-dom'
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'
import { server } from '../mocks/server'

// Mock Clerk module to use our test wrapper hooks
vi.mock('@clerk/nextjs', async () => {
  const authMocks = await import('../app/auth-provider-wrapper')

  return {
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    useUser: authMocks.useMockUser,
    useAuth: authMocks.useMockAuth,
    useClerk: authMocks.useMockClerk,
    useOrganization: authMocks.useMockOrganization,
    SignedIn: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SignedOut: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SignInButton: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    auth: () => ({
      userId: '01234567-89ab-cdef-0123-456789abcdef',
      getToken: vi.fn().mockResolvedValue('valid-test-token'),
    }),
    SignIn: () =>
      React.createElement('div', { 'data-testid': 'mock-sign-in' }, 'Mock Sign In Component'),
    SignUp: () =>
      React.createElement('div', { 'data-testid': 'mock-sign-up' }, 'Mock Sign Up Component'),
    OrganizationSwitcher: () =>
      React.createElement(
        'div',
        { 'data-testid': 'mock-org-switcher' },
        'Mock Organization Switcher'
      ),
    UserButton: () =>
      React.createElement('div', { 'data-testid': 'mock-user-button' }, 'Mock User Button'),
    authMiddleware: (config: any) => (req: any, res: any, next: any) => next?.(),
  }
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({
    id: 'test-project-id',
    storyId: 'test-story-id',
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/test-path',
  redirect: vi.fn(),
}))

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return {
      type: 'a',
      props: { href, ...props, children },
    }
  },
}))

// Start mock server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Reset handlers after each test
afterEach(() => {
  cleanup()
  server.resetHandlers()
})

// Clean up after all tests
afterAll(() => {
  server.close()
})
