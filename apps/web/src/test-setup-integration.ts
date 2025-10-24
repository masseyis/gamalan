import '@testing-library/jest-dom'
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '../mocks/server'

// Global type definitions for test environment
declare global {
  interface Window {
    Clerk: {
      user: any
      session: any
      organization: any
      getToken: () => Promise<string>
      signOut: () => Promise<void>
      openSignIn: () => void
      openSignUp: () => void
    }
  }

  interface Error {
    code?: string
  }
}

// Note: axios is not mocked in integration tests to allow MSW to intercept HTTP requests

// Test setup specifically for integration tests using real Clerk testing patterns
// DO NOT mock Clerk in integration tests - use @clerk/testing instead

// Mock Next.js router for integration tests
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

// Mock Next.js Link for integration tests
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return {
      type: 'a',
      props: { href, ...props, children },
    }
  },
}))

// Set up environment for Clerk integration tests
beforeAll(() => {
  // Use test environment variables
  Object.assign(process.env, {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
    CLERK_SECRET_KEY: 'sk_test_bW9jay1rZXktZm9yLXRlc3RpbmctcHVycG9zZXMtb25seQ==',
    NODE_ENV: 'test',
  })

  // Start mock server
  server.listen({ onUnhandledRequest: 'warn' })
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
