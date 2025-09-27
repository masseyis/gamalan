import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base-page'

export class AuthPage extends BasePage {
  readonly signInButton: Locator
  readonly signUpButton: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly continueButton: Locator
  readonly forgotPasswordLink: Locator
  readonly clerkSignInForm: Locator
  readonly clerkSignUpForm: Locator

  constructor(page: Page) {
    super(page)
    this.signInButton = page.locator('button:has-text("Sign In")')
    this.signUpButton = page.locator('button:has-text("Sign Up")')
    this.emailInput = page.locator('input[name="identifier"], input[name="emailAddress"]')
    this.passwordInput = page.locator('input[name="password"]')
    this.continueButton = page.locator('button:has-text("Continue")')
    this.forgotPasswordLink = page.locator('a:has-text("Forgot password")')
    this.clerkSignInForm = page.locator('text=Sign in to Gamalan')
    this.clerkSignUpForm = page.locator('text=Create your account')
  }

  async gotoSignIn() {
    await this.goto('/sign-in')
    await this.clerkSignInForm.waitFor({ state: 'visible', timeout: 10000 })
  }

  async gotoSignUp() {
    await this.goto('/sign-up')
    await this.clerkSignUpForm.waitFor({ state: 'visible', timeout: 10000 })
  }

  async signIn(email: string, password: string) {
    await this.gotoSignIn()

    // Fill email
    await this.emailInput.fill(email)
    await this.continueButton.click()

    // Wait for password field to appear
    await this.passwordInput.waitFor({ state: 'visible' })
    await this.passwordInput.fill(password)
    await this.continueButton.click()

    // Wait for successful redirect
    await this.page.waitForURL(/.*\/(dashboard|assistant).*/, { timeout: 15000 })
    await this.expectAuthenticated()
  }

  async signUp(email: string, password: string, firstName: string = 'Test', lastName: string = 'User') {
    await this.gotoSignUp()

    // Fill registration form
    await this.page.locator('input[name="firstName"]').fill(firstName)
    await this.page.locator('input[name="lastName"]').fill(lastName)
    await this.page.locator('input[name="emailAddress"]').fill(email)
    await this.page.locator('input[name="password"]').fill(password)

    await this.continueButton.click()

    // Handle email verification (mock for tests)
    const verificationInput = this.page.locator('input[name="code"]')
    if (await verificationInput.isVisible({ timeout: 5000 })) {
      await verificationInput.fill('123456') // Mock verification code
      await this.continueButton.click()
    }

    // Wait for successful redirect
    await this.page.waitForURL(/.*\/(dashboard|assistant).*/, { timeout: 15000 })
    await this.expectAuthenticated()
  }

  async signOut() {
    await super.signOut()
    await this.page.waitForURL(/.*\/(sign-in|$).*/, { timeout: 10000 })
    await this.expectUnauthenticated()
  }

  async forgotPassword(email: string) {
    await this.gotoSignIn()
    await this.forgotPasswordLink.click()

    const resetEmailInput = this.page.locator('input[name="identifier"]')
    await resetEmailInput.fill(email)
    await this.continueButton.click()

    await this.expectToastMessage('Password reset link sent')
  }

  async expectSignInError(message: string) {
    const errorMessage = this.page.locator(`[role="alert"]:has-text("${message}")`)
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  }

  async expectSignInForm() {
    await expect(this.clerkSignInForm).toBeVisible()
    await expect(this.emailInput).toBeVisible()
  }

  async expectSignUpForm() {
    await expect(this.clerkSignUpForm).toBeVisible()
    await expect(this.page.locator('input[name="firstName"]')).toBeVisible()
    await expect(this.page.locator('input[name="lastName"]')).toBeVisible()
    await expect(this.page.locator('input[name="emailAddress"]')).toBeVisible()
    await expect(this.page.locator('input[name="password"]')).toBeVisible()
  }

  async switchToSignUp() {
    const signUpLink = this.page.locator('a:has-text("Sign up")')
    await signUpLink.click()
    await this.expectSignUpForm()
  }

  async switchToSignIn() {
    const signInLink = this.page.locator('a:has-text("Sign in")')
    await signInLink.click()
    await this.expectSignInForm()
  }
}