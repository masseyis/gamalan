import { Page, expect } from '@playwright/test'

/**
 * Get test credentials from environment variables
 */
export function getTestCredentials() {
  return {
    email: process.env.E2E_CLERK_USER_USERNAME || 'dummy+clerk_test@mock.com',
    password: process.env.E2E_CLERK_USER_PASSWORD || 'punvyx-ceczIf-3remza',
  }
}

/**
 * Verify that the user is authenticated (should be used in authenticated tests)
 */
export async function ensureAuthenticated(page: Page) {
  // Check if we're on a protected page or can access protected content
  const isOnDashboard = page.url().includes('/dashboard')
  const isOnProjects = page.url().includes('/projects')
  const isOnAssistant = page.url().includes('/assistant')

  if (!isOnDashboard && !isOnProjects && !isOnAssistant) {
    // Navigate to dashboard to verify authentication
    await page.goto('/dashboard')
  }

  // Verify we're not redirected to sign-in
  await expect(page).not.toHaveURL(/.*\/sign-in.*/)

  // Verify some authenticated content is visible
  await expect(
    page.locator('[data-testid="battra-logo"]').or(page.locator('h1')).first()
  ).toBeVisible()
}

/**
 * Ensure the user is NOT authenticated (for testing sign-in flows)
 */
export async function ensureUnauthenticated(page: Page) {
  // Try to go to a protected page
  await page.goto('/dashboard')

  // Should be redirected to sign-in
  await page.waitForURL(/.*\/sign-in.*/, { timeout: 10000 })

  // Verify sign-in form is visible
  await expect(page.locator('text=Sign in to Gamalan')).toBeVisible()
}

/**
 * Sign out the current user (if authenticated)
 */
export async function signOut(page: Page) {
  try {
    // Look for sign out button/menu
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="user-avatar"]')

    if (await userMenu.isVisible({ timeout: 2000 })) {
      await userMenu.click()

      // Look for sign out option
      const signOutButton = page.locator('text=Sign out, text=Logout, button:has-text("Sign out")')
      if (await signOutButton.isVisible({ timeout: 2000 })) {
        await signOutButton.click()
      }
    }

    // Wait for redirect to sign-in or home page
    await page.waitForURL(/.*\/(sign-in|$).*/, { timeout: 5000 })
  } catch (error) {
    // If sign out fails, clear storage and refresh
    await page.context().clearCookies()
    await page.goto('/sign-in')
  }
}

/**
 * Perform sign-in with test credentials
 */
export async function signInWithTestCredentials(page: Page) {
  const { email, password } = getTestCredentials()

  await page.goto('/sign-in')

  // Wait for Clerk sign-in form to load
  await page.waitForSelector('text=Sign in to Gamalan', { timeout: 10000 })

  // Fill email field
  const emailInput = page.locator('input[name="identifier"]').first()
  await emailInput.waitFor({ state: 'visible' })
  await emailInput.fill(email)

  // Click continue
  await page.locator('button:has-text("Continue")').first().click()

  // Fill password field
  const passwordInput = page.locator('input[name="password"]').first()
  await passwordInput.waitFor({ state: 'visible' })
  await passwordInput.fill(password)

  // Click sign in
  await page.locator('button:has-text("Continue")').first().click()

  // Wait for successful authentication
  await page.waitForURL(/.*\/(dashboard|assistant).*/, { timeout: 15000 })
}
