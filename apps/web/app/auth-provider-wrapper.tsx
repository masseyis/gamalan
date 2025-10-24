'use client'

import { ClerkProvider } from '@clerk/nextjs'
import React, { ReactNode } from 'react'

// Main wrapper component that uses standard Clerk
export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error(
      'Missing Clerk publishable key. Please add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to your environment variables.'
    )
  }

  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up'
  const afterSignInUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/assistant'
  const afterSignUpUrl = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/assistant'

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      afterSignInUrl={afterSignInUrl}
      afterSignUpUrl={afterSignUpUrl}
      appearance={{
        elements: {
          organizationSwitcherTriggerIcon: 'text-muted-foreground',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}

// Mock hooks for unit tests only - these are used by test-setup.ts
export const useMockUser = () => {
  return {
    user: {
      id: '01234567-89ab-cdef-0123-456789abcdef',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
    isSignedIn: true,
    isLoaded: true,
  }
}

export const useMockAuth = () => {
  return {
    userId: '01234567-89ab-cdef-0123-456789abcdef',
    isSignedIn: true,
    isLoaded: true,
    getToken: () => Promise.resolve('valid-test-token'),
  }
}

export const useMockClerk = () => {
  return {
    signOut: (_?: unknown) => Promise.resolve(),
  }
}

export const useMockOrganization = () => {
  return {
    organization: {
      id: 'test-org-123',
      name: 'Test Organization',
    },
    isLoaded: true,
  }
}
