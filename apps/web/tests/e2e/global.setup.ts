import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../playwright/.clerk/user.json')

setup('authenticate', async ({ page }) => {
  // Navigate to sign-in page
  await page.goto('/sign-in')

  // Real Clerk authentication mode
  console.log('Using real Clerk authentication mode')

  // Wait for Clerk sign-in form to load
  await page.waitForSelector('text=Sign in to Gamalan', { timeout: 10000 })

  // Fill in test credentials
  const email = process.env.E2E_CLERK_USER_USERNAME || 'dummy+clerk_test@mock.com'
  const password = process.env.E2E_CLERK_USER_PASSWORD || 'punvyx-ceczIf-3remza'

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

  // Wait for successful authentication - check for redirect to dashboard
  await page.waitForURL(/.*\/(dashboard|assistant).*/, { timeout: 15000 })

  // Verify we're authenticated by checking for user navigation or dashboard content
  await expect(
    page.locator('[data-testid="battra-logo"]').or(page.locator('h1')).first()
  ).toBeVisible()

  // Save signed-in state
  await page.context().storageState({ path: authFile })
})

setup.describe.configure({ mode: 'serial' })
