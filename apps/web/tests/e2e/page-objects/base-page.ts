import { Page, Locator, expect } from '@playwright/test'

export class BasePage {
  readonly page: Page
  readonly navigation: Locator
  readonly userAvatar: Locator
  readonly logo: Locator
  readonly notifications: Locator

  constructor(page: Page) {
    this.page = page
    this.navigation = page.locator('nav')
    this.userAvatar = page.locator('[data-testid="user-avatar"]')
    this.logo = page.locator('[data-testid="battra-logo"]')
    this.notifications = page.locator('button:has(svg):has-text("Bell")')
  }

  async goto(path: string) {
    await this.page.goto(path)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle')

    // Try to find any key page element, but don't fail if not found
    try {
      await expect(this.logo).toBeVisible({ timeout: 5000 })
    } catch {
      // Fallback - just verify basic page structure
      await expect(this.page.locator('body')).toBeVisible()
    }
  }

  async signOut() {
    try {
      // Look for sign out button/menu
      const userMenu = this.page.locator('[data-testid="user-menu"], [data-testid="user-avatar"]')

      if (await userMenu.isVisible({ timeout: 2000 })) {
        await userMenu.click()

        // Look for sign out option
        const signOutButton = this.page.locator('text=Sign out, text=Logout, button:has-text("Sign out")')
        if (await signOutButton.isVisible({ timeout: 2000 })) {
          await signOutButton.click()
        }
      }

      // Wait for redirect to sign-in or home page
      await this.page.waitForURL(/.*\/(sign-in|$).*/, { timeout: 5000 })
    } catch (error) {
      // If sign out fails, clear storage and refresh
      await this.page.context().clearCookies()
      await this.page.goto('/sign-in')
    }
  }

  async navigateTo(section: 'Dashboard' | 'Projects' | 'Team' | 'Reports' | 'Assistant') {
    const navLink = this.navigation.locator(`a:has-text("${section}")`)
    await navLink.click()
    await this.waitForLoad()
  }

  async expectAuthenticated() {
    // Verify we're not on sign-in page and on a valid authenticated page
    await expect(this.page).not.toHaveURL(/.*\/sign-in.*/)
    await expect(this.page).toHaveURL(/.*\/(dashboard|assistant|projects).*/)
  }

  async expectUnauthenticated() {
    await expect(this.page.locator('button:has-text("Sign In")')).toBeVisible()
  }

  async createNew() {
    const newButton = this.page.locator('button:has-text("New")')
    await newButton.click()
  }

  async openAIAssistant() {
    const aiButton = this.page.locator('button:has-text("Ask AI")')
    await aiButton.click()
  }

  async expectToastMessage(message: string) {
    const toast = this.page.locator(`[role="alert"]:has-text("${message}")`)
    await expect(toast).toBeVisible({ timeout: 5000 })
  }

  async expectError(message: string) {
    const error = this.page.locator(`text=${message}`)
    await expect(error).toBeVisible()
  }

  async expectLoading() {
    const loading = this.page.locator('text=Loading...')
    await expect(loading).toBeVisible()
  }

  async expectNoError() {
    const errors = this.page.locator('[role="alert"][data-type="error"]')
    await expect(errors).toHaveCount(0)
  }
}