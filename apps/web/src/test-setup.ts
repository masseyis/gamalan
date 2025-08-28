import '@testing-library/jest-dom'
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Mock Clerk
vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({ 
    user: { 
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }]
    },
    isLoaded: true,
    isSignedIn: true
  }),
  useAuth: () => ({
    userId: 'test-user-id',
    getToken: vi.fn().mockResolvedValue('test-token'),
    isLoaded: true,
    isSignedIn: true
  }),
  auth: () => ({
    userId: 'test-user-id',
    getToken: vi.fn().mockResolvedValue('test-token')
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => 'Sign In',
  SignUp: () => 'Sign Up',
  authMiddleware: (config: any) => (req: any, res: any, next: any) => next?.(),
}))

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