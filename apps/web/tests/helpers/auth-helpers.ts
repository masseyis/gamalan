/**
 * Authentication Helper Functions for E2E Tests
 * 
 * Reusable utilities for managing authentication state in staging tests.
 * These helpers ensure consistent auth handling across all test suites.
 */

import { Page, expect } from '@playwright/test'

// Test credentials - using existing account for sign-in (NOT sign-up)
export const TEST_CREDENTIALS = {
  email: 'masseyis@me.com',
  password: 'Penguinchicken123'
} as const

/**
 * Clear all authentication state from the browser context
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('about:blank')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * Check if we're currently on an authentication page
 */
export async function isOnAuthPage(page: Page): Promise<boolean> {
  const indicators = await Promise.all([
    page.url().includes('sign-in'),
    page.url().includes('sign-up'),  
    page.url().includes('clerk'),
    page.locator('input[type="email"]').isVisible({ timeout: 5000 }),
    page.locator('[data-clerk-id]').isVisible({ timeout: 5000 }),
    page.locator('.cl-component').isVisible({ timeout: 5000 })
  ])
  
  return indicators.some(indicator => indicator)
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for authenticated UI indicators
  const authIndicators = await Promise.all([
    page.locator('[data-testid="user-menu"]').isVisible({ timeout: 5000 }),
    page.locator('nav').isVisible({ timeout: 5000 }),
    page.locator('text=Dashboard').isVisible({ timeout: 5000 }),
    page.locator('text=Welcome').isVisible({ timeout: 5000 })
  ])
  
  const hasAuthUI = authIndicators.some(indicator => indicator)
  const notOnAuthPage = !(await isOnAuthPage(page))
  
  return hasAuthUI && notOnAuthPage
}

/**
 * Sign in using test credentials with robust error handling
 */
export async function signInWithTestCredentials(page: Page, baseUrl: string): Promise<void> {
  console.log('🔐 Starting sign-in process...')
  
  // Navigate to base URL (should redirect to auth if not authenticated)
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  
  // Wait for auth interface to appear
  const authVisible = await Promise.race([
    page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 15000 }),
    page.locator('[data-clerk-id]').first().waitFor({ state: 'visible', timeout: 15000 }),
    page.locator('.cl-component').first().waitFor({ state: 'visible', timeout: 15000 })
  ]).then(() => true).catch(() => false)
  
  if (!authVisible) {
    // Try direct navigation to sign-in page
    console.log('🔍 Auth interface not found, trying direct sign-in URL...')
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle' })
  }
  
  // Find and fill email field
  const emailSelectors = [
    'input[type="email"]',
    'input[name="identifier"]', 
    'input[name="emailAddress"]'
  ]
  
  let emailInput
  for (const selector of emailSelectors) {
    emailInput = page.locator(selector).first()
    if (await emailInput.isVisible({ timeout: 3000 })) {
      break
    }
  }
  
  if (!emailInput || !(await emailInput.isVisible())) {
    throw new Error('❌ Could not find email input field')
  }
  
  await emailInput.fill(TEST_CREDENTIALS.email)
  console.log('📧 Filled email field')
  
  // Try to click continue/next button if present
  const continueSelectors = [
    'button:has-text("Continue")',
    'button:has-text("Next")',
    'button[type="submit"]'
  ]
  
  let clickedContinue = false
  for (const selector of continueSelectors) {
    const button = page.locator(selector).first()
    if (await button.isVisible({ timeout: 2000 })) {
      await button.click()
      console.log('➡️  Clicked continue button')
      clickedContinue = true
      await page.waitForTimeout(2000) // Wait for password field
      break
    }
  }
  
  // Find and fill password field
  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]'
  ]
  
  let passwordInput
  for (const selector of passwordSelectors) {
    passwordInput = page.locator(selector).first()
    if (await passwordInput.isVisible({ timeout: 5000 })) {
      break
    }
  }
  
  if (!passwordInput || !(await passwordInput.isVisible())) {
    throw new Error('❌ Could not find password input field')
  }
  
  await passwordInput.fill(TEST_CREDENTIALS.password)
  console.log('🔑 Filled password field')
  
  // Find and click sign-in button
  const signInSelectors = [
    'button:has-text("Sign in")',
    'button:has-text("Continue")',
    'button:has-text("Submit")',
    'button[type="submit"]'
  ]
  
  let signInButton
  for (const selector of signInSelectors) {
    signInButton = page.locator(selector).first()
    if (await signInButton.isVisible({ timeout: 2000 })) {
      break
    }
  }
  
  if (!signInButton || !(await signInButton.isVisible())) {
    throw new Error('❌ Could not find sign-in button')
  }
  
  await signInButton.click()
  console.log('🚀 Clicked sign-in button')
  
  // Wait for authentication to complete
  await page.waitForLoadState('networkidle')
  
  // Verify authentication succeeded
  const authSuccess = await isAuthenticated(page)
  if (!authSuccess) {
    throw new Error('❌ Sign-in did not complete successfully - no authenticated indicators found')
  }
  
  console.log('✅ Sign-in completed successfully')
}

/**
 * Sign out the current user
 */
export async function signOut(page: Page, baseUrl: string): Promise<void> {
  console.log('🚪 Starting sign-out process...')
  
  // Try different sign-out methods
  const userMenuVisible = await page.locator('[data-testid="user-menu"]').isVisible({ timeout: 5000 })
  const signOutButtonVisible = await page.locator('text=Sign out').isVisible({ timeout: 5000 })

  if (userMenuVisible) {
    console.log('👤 Found user menu, clicking to reveal sign-out option')
    await page.locator('[data-testid="user-menu"]').click()
    await page.waitForTimeout(1000)
    
    const signOutOption = page.locator('text=Sign out').first()
    await expect(signOutOption).toBeVisible({ timeout: 5000 })
    await signOutOption.click()
  } else if (signOutButtonVisible) {
    console.log('🔲 Found direct sign-out button')
    await page.locator('text=Sign out').first().click()
  } else {
    // Try Clerk sign-out URL
    console.log('🔗 No sign-out UI found, trying Clerk sign-out URL')
    await page.goto(`${baseUrl}/sign-out`, { waitUntil: 'networkidle' })
  }

  // Wait for sign-out to complete
  await page.waitForLoadState('networkidle')
  console.log('✅ Sign-out completed')
}

/**
 * Get authentication token from browser storage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('clerk-session') || 
           localStorage.getItem('__clerk_jwt') ||
           sessionStorage.getItem('clerk-session') ||
           null
  })
}

/**
 * Validate that a route is properly protected
 */
export async function validateRouteProtection(page: Page, baseUrl: string, route: string): Promise<void> {
  console.log(`🔒 Testing protection for: ${route}`)
  
  // Ensure we're not authenticated
  await clearAuthState(page)
  
  // Try to access the protected route
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  
  // Should either redirect to auth (200) or return auth required (401) 
  const validStatuses = [200, 401]
  expect(validStatuses.includes(response?.status() || 0), 
    `${route} should require auth (200 redirect or 401), got ${response?.status()}`
  ).toBe(true)
  
  // If we got 200, should be on auth page
  if (response?.status() === 200) {
    const onAuthPage = await isOnAuthPage(page)
    expect(onAuthPage, `${route} returned 200 but should redirect to authentication`).toBe(true)
  }
  
  console.log(`✅ ${route} - Properly protected (${response?.status()})`)
}

/**
 * Test authenticated access to a route
 */
export async function validateAuthenticatedAccess(
  page: Page, 
  baseUrl: string, 
  route: string, 
  expectedContent: string[]
): Promise<void> {
  console.log(`🔓 Testing authenticated access to: ${route}`)
  
  const response = await page.goto(`${baseUrl}${route}`, { 
    waitUntil: 'networkidle',
    timeout: 20000 
  })
  
  // Should get 200 response when authenticated
  expect(response?.status()).toBe(200)
  
  // Should not be redirected to auth
  const onAuthPage = await isOnAuthPage(page)
  expect(onAuthPage, `Should not redirect to auth when accessing ${route} while authenticated`).toBe(false)
  
  // Check for expected content (at least one should be visible)
  const hasExpectedContent = await Promise.race(
    expectedContent.map(content => 
      page.locator(`text=${content}`).first().isVisible({ timeout: 10000 })
    )
  )
  
  // Allow for loading states if content isn't immediately visible
  const hasLoadingState = await page.locator('text=Loading').isVisible({ timeout: 2000 })
  
  expect(hasExpectedContent || hasLoadingState, 
    `Expected content or loading state should be visible on ${route}`).toBe(true)
  
  console.log(`✅ ${route} - Successfully accessed while authenticated`)
}