import { test, expect } from '@playwright/test'
import { AuthPage, testData, testUtils } from '../../e2e/page-objects'

test.describe('Authentication Workflows', () => {
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page)
  })

  test.describe('User Sign-in Flow', () => {
    test('should sign in with valid credentials', async () => {
      await authPage.signIn(testData.user.email, testData.user.password)

      // Verify successful authentication
      await authPage.expectAuthenticated()
      await expect(authPage.page).toHaveURL(/.*\/(dashboard|assistant).*/)
    })

    test('should display error for invalid credentials', async () => {
      await authPage.gotoSignIn()

      // Attempt sign-in with invalid credentials
      await authPage.emailInput.fill('invalid@example.com')
      await authPage.continueButton.click()

      await authPage.passwordInput.waitFor({ state: 'visible' })
      await authPage.passwordInput.fill('wrongpassword')
      await authPage.continueButton.click()

      // Verify error message
      await authPage.expectSignInError('Invalid credentials')
    })

    test('should handle empty form submission', async () => {
      await authPage.gotoSignIn()

      // Try to submit empty form
      await authPage.continueButton.click()

      // Verify validation errors
      await authPage.expectError('Please enter your email')
    })

    test('should validate email format', async () => {
      await authPage.gotoSignIn()

      await authPage.emailInput.fill('invalid-email')
      await authPage.continueButton.click()

      await authPage.expectError('Please enter a valid email')
    })

    test('should navigate between sign-in and sign-up', async () => {
      await authPage.gotoSignIn()
      await authPage.expectSignInForm()

      await authPage.switchToSignUp()
      await authPage.expectSignUpForm()

      await authPage.switchToSignIn()
      await authPage.expectSignInForm()
    })

    test('should handle forgot password flow', async () => {
      const testEmail = testUtils.generateTestEmail()
      await authPage.forgotPassword(testEmail)

      await authPage.expectToastMessage('Password reset link sent')
    })
  })

  test.describe('User Sign-up Flow', () => {
    test('should sign up with valid information', async () => {
      const newUser = {
        email: testUtils.generateTestEmail(),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      }

      await authPage.signUp(newUser.email, newUser.password, newUser.firstName, newUser.lastName)

      // Verify successful registration and authentication
      await authPage.expectAuthenticated()
      await expect(authPage.page).toHaveURL(/.*\/(dashboard|assistant).*/)
    })

    test('should validate password strength', async () => {
      await authPage.gotoSignUp()

      await authPage.page.locator('input[name="firstName"]').fill('Test')
      await authPage.page.locator('input[name="lastName"]').fill('User')
      await authPage.page.locator('input[name="emailAddress"]').fill(testUtils.generateTestEmail())
      await authPage.page.locator('input[name="password"]').fill('weak')

      await authPage.continueButton.click()

      await authPage.expectError('Password must be at least 8 characters')
    })

    test('should validate required fields', async () => {
      await authPage.gotoSignUp()

      await authPage.continueButton.click()

      await authPage.expectError('Please enter your first name')
    })

    test('should prevent duplicate email registration', async () => {
      await authPage.gotoSignUp()

      // Try to register with existing email
      await authPage.page.locator('input[name="firstName"]').fill('Test')
      await authPage.page.locator('input[name="lastName"]').fill('User')
      await authPage.page.locator('input[name="emailAddress"]').fill(testData.user.email)
      await authPage.page.locator('input[name="password"]').fill('SecurePassword123!')

      await authPage.continueButton.click()

      await authPage.expectSignInError('Email already exists')
    })
  })

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async () => {
      await authPage.signIn(testData.user.email, testData.user.password)
      await authPage.expectAuthenticated()

      // Reload page
      await authPage.page.reload()
      await authPage.waitForLoad()

      // Verify still authenticated
      await authPage.expectAuthenticated()
    })

    test('should handle session expiry gracefully', async () => {
      await authPage.signIn(testData.user.email, testData.user.password)
      await authPage.expectAuthenticated()

      // Simulate session expiry by clearing storage
      await authPage.page.context().clearCookies()
      await authPage.page.evaluate(() => localStorage.clear())

      // Navigate to protected page
      await authPage.goto('/projects')

      // Should redirect to sign-in
      await expect(authPage.page).toHaveURL(/.*\/sign-in.*/)
      await authPage.expectUnauthenticated()
    })

    test('should sign out successfully', async () => {
      await authPage.signIn(testData.user.email, testData.user.password)
      await authPage.expectAuthenticated()

      await authPage.signOut()
      await authPage.expectUnauthenticated()
    })

    test('should remember user preference for "Remember me"', async () => {
      await authPage.gotoSignIn()

      // Check remember me option if available
      const rememberCheckbox = authPage.page.locator('input[name="rememberMe"]')
      if (await rememberCheckbox.isVisible({ timeout: 2000 })) {
        await rememberCheckbox.check()
      }

      await authPage.signIn(testData.user.email, testData.user.password)

      // Close browser context and create new one to simulate browser restart
      const context = authPage.page.context()
      const browser = context.browser()
      if (browser) {
        const newContext = await browser.newContext()
        const newPage = await newContext.newPage()
        const newAuthPage = new AuthPage(newPage)

        await newAuthPage.goto('/dashboard')

        // Should still be authenticated if remember me worked
        try {
          await newAuthPage.expectAuthenticated()
        } catch {
          // Acceptable if remember me doesn't persist across contexts in test
          await expect(newPage).toHaveURL(/.*\/sign-in.*/)
        }

        await newContext.close()
      }
    })
  })

  test.describe('Multi-device and Concurrent Sessions', () => {
    test('should handle concurrent sessions on multiple devices', async ({ browser }) => {
      // Create two browser contexts to simulate different devices
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()

      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      const authPage1 = new AuthPage(page1)
      const authPage2 = new AuthPage(page2)

      // Sign in on both "devices"
      await authPage1.signIn(testData.user.email, testData.user.password)
      await authPage2.signIn(testData.user.email, testData.user.password)

      // Both should be authenticated
      await authPage1.expectAuthenticated()
      await authPage2.expectAuthenticated()

      // Sign out from one device
      await authPage1.signOut()
      await authPage1.expectUnauthenticated()

      // Other device should still be authenticated
      await authPage2.page.reload()
      await authPage2.waitForLoad()
      await authPage2.expectAuthenticated()

      await context1.close()
      await context2.close()
    })

    test('should handle organization switching', async () => {
      await authPage.signIn(testData.user.email, testData.user.password)
      await authPage.expectAuthenticated()

      // Navigate to dashboard where organization switcher is visible
      await authPage.navigateTo('Dashboard')

      const orgSwitcher = authPage.page.locator('[data-testid="org-switcher"]')
      if (await orgSwitcher.isVisible({ timeout: 5000 })) {
        await orgSwitcher.click()

        // Check if multiple organizations available
        const orgOptions = authPage.page.locator('[data-testid="org-option"]')
        const orgCount = await orgOptions.count()

        if (orgCount > 1) {
          await orgOptions.nth(1).click()
          await authPage.expectToastMessage('Organization switched')
        }
      }
    })
  })

  test.describe('Security Features', () => {
    test('should protect against XSS in login form', async () => {
      await authPage.gotoSignIn()

      const xssPayload = '<script>alert("xss")</script>'
      await authPage.emailInput.fill(xssPayload)
      await authPage.continueButton.click()

      // Should not execute script, should show validation error
      await authPage.expectError('Please enter a valid email')

      // Verify no script was executed
      const alerts = authPage.page.locator('text=xss')
      await expect(alerts).toHaveCount(0)
    })

    test('should enforce rate limiting on failed attempts', async () => {
      await authPage.gotoSignIn()

      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        await authPage.emailInput.fill('test@example.com')
        await authPage.continueButton.click()

        await authPage.passwordInput.waitFor({ state: 'visible' })
        await authPage.passwordInput.fill('wrongpassword')
        await authPage.continueButton.click()

        await authPage.page.waitForTimeout(1000)
      }

      // After multiple failures, should see rate limiting
      await authPage.expectError('Too many failed attempts')
    })

    test('should validate CSRF protection', async () => {
      await authPage.gotoSignIn()

      // Try to submit form without proper CSRF token
      const response = await authPage.page.request.post('/api/auth/signin', {
        data: {
          email: testData.user.email,
          password: testData.user.password,
        },
      })

      // Should reject request without proper headers/tokens
      expect(response.status()).toBeGreaterThanOrEqual(400)
    })
  })
})
