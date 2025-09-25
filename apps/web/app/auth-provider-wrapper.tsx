'use client'

import { ClerkProvider } from '@clerk/nextjs'
import React, { createContext, useContext, ReactNode } from 'react'

// Mock auth context for E2E tests
interface MockAuthContext {
  user: {
    id: string
    firstName: string
    lastName: string
    emailAddresses: { emailAddress: string }[]
  }
  isSignedIn: boolean
  isLoaded: boolean
}

const MockAuthContext = createContext<MockAuthContext | null>(null)

// Mock provider for E2E tests that provides the same interface as Clerk
function MockAuthProvider({ children }: { children: ReactNode }) {
  const mockUser = {
    id: '01234567-89ab-cdef-0123-456789abcdef',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }]
  }

  const contextValue: MockAuthContext = {
    user: mockUser,
    isSignedIn: true,
    isLoaded: true
  }

  return (
    <MockAuthContext.Provider value={contextValue}>
      {children}
    </MockAuthContext.Provider>
  )
}

// Custom hook that handles conditional auth logic
export const useConditionalAuth = () => {
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

  // Always call mock hooks (to follow rules of hooks)
  const mockAuth = useMockUser()
  const mockClerk = useMockClerk()

  // Return the appropriate auth data based on mode
  if (isTestMode) {
    return {
      user: mockAuth.user,
      isSignedIn: mockAuth.isSignedIn,
      isLoaded: mockAuth.isLoaded,
      signOut: mockClerk.signOut
    }
  }

  // In production mode, return safe fallback values (component shouldn't be used in production without ClerkProvider anyway)
  return {
    user: null,
    isSignedIn: false,
    isLoaded: true,
    signOut: () => Promise.resolve()
  }
}

// Mock hooks for E2E tests
export const useMockUser = () => {
  const context = useContext(MockAuthContext)

  // If no context available, provide fallback values (for when called outside provider)
  if (!context) {
    return {
      user: {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [{ emailAddress: 'test@example.com' }]
      },
      isSignedIn: true,
      isLoaded: true
    }
  }

  return {
    user: context.user,
    isSignedIn: context.isSignedIn,
    isLoaded: context.isLoaded
  }
}

export const useMockAuth = () => {
  const context = useContext(MockAuthContext)

  // If no context available, provide fallback values (for when called outside provider)
  if (!context) {
    return {
      userId: '01234567-89ab-cdef-0123-456789abcdef',
      isSignedIn: true,
      isLoaded: true,
      getToken: () => Promise.resolve('valid-test-token')
    }
  }

  return {
    userId: context.user.id,
    isSignedIn: context.isSignedIn,
    isLoaded: context.isLoaded,
    getToken: () => Promise.resolve('valid-test-token')
  }
}

export const useMockClerk = () => {
  return {
    signOut: () => Promise.resolve()
  }
}

export const useMockOrganization = () => {
  return {
    organization: {
      id: 'test-org-123',
      name: 'Test Organization'
    },
    isLoaded: true
  }
}

// Main wrapper component that always uses ClerkProvider
// In test mode, uses mock keys that don't validate against a real Clerk instance
export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error(
      'Missing Clerk publishable key. Please add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your environment variables.'
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      domain={undefined}
    >
      {children}
    </ClerkProvider>
  )
}