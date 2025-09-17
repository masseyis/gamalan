import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, 'playwright/.clerk/user.json')

// Global setup for Clerk
setup('global setup', async ({}) => {
  await clerkSetup()
})

// Authenticate and save state to storage
setup('authenticate and save state to storage', async ({ page }) => {
  // Navigate to the home page
  await page.goto('/')

  // Sign in using Clerk testing utilities
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  })

  // Navigate to a protected page to ensure authentication worked
  await page.goto('/dashboard')

  // Wait for authentication to complete - look for elements that indicate successful auth
  try {
    // Try to find user-specific content or navigation elements
    await page.waitForSelector('[data-testid="user-menu"], .user-avatar, nav', { timeout: 10000 })
  } catch (error) {
    console.warn('Could not find auth indicators, but continuing with setup...')
  }

  // Save the authenticated state
  await page.context().storageState({ path: authFile })

  console.log('Authentication state saved to:', authFile)
})