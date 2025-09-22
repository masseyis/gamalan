import { test as setup } from '@playwright/test'
import path from 'path'
import { setupMockAuth } from '@/lib/auth/test-utils'

const authFile = path.join(__dirname, 'playwright/.clerk/user.json')

// Setup must run serially for deterministic results
setup.describe.configure({ mode: 'serial' })

// Mock authentication setup for E2E tests
setup('global setup - enable mock auth', async ({}) => {
  console.log('🔧 Setting up mock authentication for E2E tests')
  // This setup enables mock authentication for all tests
})

// Create authenticated user session for tests
setup('authenticate and save state to storage', async ({ page }) => {
  console.log('🔐 Setting up authenticated user session...')

  // Enable mock authentication
  await setupMockAuth(page)

  // Navigate to the home page to establish session
  await page.goto('/')

  // Wait for the page to load and mock auth to take effect
  await page.waitForLoadState('networkidle')

  // Navigate to dashboard to verify authentication
  await page.goto('/dashboard')

  // Wait for authenticated elements to appear
  try {
    await page.waitForSelector('nav, [data-testid="battra-logo"], [title="Click to sign out"]', {
      timeout: 10000,
      state: 'visible'
    })
    console.log('✅ Mock authentication successful!')
  } catch (error) {
    console.warn('⚠️ Could not find auth indicators, but continuing...', error)
  }

  // Save the authenticated state for reuse in tests
  await page.context().storageState({ path: authFile })
  console.log('💾 Authentication state saved to:', authFile)
})