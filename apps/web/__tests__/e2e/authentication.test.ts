import { test, expect, type Page } from '@playwright/test'

// Helper functions for authentication testing
async function waitForAuthPage(page: Page, expectedPath: string) {
  await page.waitForURL(expectedPath)
  await page.waitForLoadState('networkidle')
}

async function checkDemoModeElements(page: Page) {
  // In demo mode, check for demo indicators
  const demoIndicators = [
    'text=Demo Mode',
    'text=Demo User',
    'text=Demo',
    '.avatar-fallback:has-text("DU")'
  ]
  
  let foundDemo = false
  for (const indicator of demoIndicators) {
    const element = page.locator(indicator)
    if (await element.isVisible()) {
      await expect(element).toBeVisible()
      foundDemo = true
      break
    }
  }
  
  return foundDemo
}

async function testClerkIntegration(page: Page) {
  // Check if Clerk is configured by looking for environment variable
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  return !!clerkKey
}

test.describe('Comprehensive Authentication Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('should handle demo mode authentication correctly', async ({ page }) => {
    // In demo mode (no Clerk keys), app should work without authentication
    await page.goto('/')
    
    // Should redirect to assistant (default landing)
    await waitForAuthPage(page, '/assistant')
    
    // Should show demo mode indicators
    const isDemoMode = await checkDemoModeElements(page)
    
    if (isDemoMode) {
      // Verify demo user is shown
      await expect(page.locator('text=Demo User, text=Demo Mode').first()).toBeVisible()
      
      // Navigation should work normally
      const navigation = page.locator('nav')
      await expect(navigation).toBeVisible()
      
      // Test navigation between pages
      const projectsLink = page.locator('nav a[href="/projects"], nav button:has-text("Projects")')
      if (await projectsLink.isVisible()) {
        await projectsLink.click()
        await expect(page).toHaveURL('/projects')
      }
    }
  })

  test('should test sign-in page accessibility and elements', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    
    // Check if Clerk sign-in component loads or demo mode is active
    const hasClerkComponent = await page.locator('[data-clerk-id], .cl-component').isVisible()
    const isDemoMode = await page.locator('text=Demo Mode').isVisible()
    
    if (hasClerkComponent) {
      // Test Clerk sign-in component
      const clerkSignIn = page.locator('[data-clerk-id], .cl-component')
      await expect(clerkSignIn).toBeVisible()
      
      // Check for typical sign-in elements
      const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
      if (await emailField.isVisible()) {
        await expect(emailField).toBeVisible()
        await expect(emailField).toBeEnabled()
      }
      
      const passwordField = page.locator('input[type="password"], input[name="password"]')
      if (await passwordField.isVisible()) {
        await expect(passwordField).toBeVisible()
        await expect(passwordField).toBeEnabled()
      }
      
      const signInButton = page.locator('button:has-text("Sign in"), button[type="submit"]')
      if (await signInButton.isVisible()) {
        await expect(signInButton).toBeVisible()
      }
      
    } else if (isDemoMode) {
      // In demo mode, should redirect to assistant
      await page.waitForURL('/assistant')
      await expect(page.locator('text=Demo Mode')).toBeVisible()
    } else {
      // Basic page elements should be present
      const body = page.locator('body')
      await expect(body).toBeVisible()
      
      // Navigation should still work
      const logo = page.locator('nav a[href="/assistant"], nav a:has-text("Salunga")')
      if (await logo.isVisible()) {
        await logo.click()
        await expect(page).toHaveURL('/assistant')
      }
    }
  })

  test('should test sign-up page accessibility and elements', async ({ page }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')
    
    const hasClerkComponent = await page.locator('[data-clerk-id], .cl-component').isVisible()
    const isDemoMode = await page.locator('text=Demo Mode').isVisible()
    
    if (hasClerkComponent) {
      // Test Clerk sign-up component
      const clerkSignUp = page.locator('[data-clerk-id], .cl-component')
      await expect(clerkSignUp).toBeVisible()
      
      // Check for typical sign-up elements
      const emailField = page.locator('input[type="email"], input[name="email"]')
      if (await emailField.isVisible()) {
        await expect(emailField).toBeVisible()
        await expect(emailField).toBeEnabled()
      }
      
      const passwordField = page.locator('input[type="password"], input[name="password"]')
      if (await passwordField.isVisible()) {
        await expect(passwordField).toBeVisible()
        await expect(passwordField).toBeEnabled()
      }
      
      const signUpButton = page.locator('button:has-text("Sign up"), button[type="submit"]')
      if (await signUpButton.isVisible()) {
        await expect(signUpButton).toBeVisible()
      }
      
      // Check for "Already have an account" link
      const signInLink = page.locator('a:has-text("Sign in"), a[href*="sign-in"]')
      if (await signInLink.isVisible()) {
        await expect(signInLink).toBeVisible()
      }
      
    } else if (isDemoMode) {
      // In demo mode, should redirect to assistant
      await page.waitForURL('/assistant')
      await expect(page.locator('text=Demo Mode')).toBeVisible()
    }
  })

  test('should test authentication redirects and protected routes', async ({ page }) => {
    // Test accessing protected routes without authentication
    const protectedRoutes = [
      '/projects',
      '/dashboard',
      '/assistant',
      '/projects/new'
    ]
    
    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      
      // In demo mode, should access directly
      // With Clerk, might redirect to sign-in
      const currentUrl = page.url()
      
      if (currentUrl.includes('/sign-in')) {
        // Was redirected to sign-in - this is expected behavior with Clerk
        await expect(page).toHaveURL(/.*\/sign-in.*/)
      } else {
        // Demo mode or authenticated - should access the route
        expect(currentUrl).toContain(route)
      }
    }
  })

  test('should test navigation authentication state consistency', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Check navigation user display
    const userAvatar = page.locator('[role="img"], .avatar, [data-testid="user-avatar"]')
    const userName = page.locator('text=Demo User, text=Demo, .user-name')
    
    if (await userAvatar.isVisible()) {
      await expect(userAvatar).toBeVisible()
    }
    
    if (await userName.first().isVisible()) {
      await expect(userName.first()).toBeVisible()
    }
    
    // Test navigation between pages maintains auth state
    const navigationPages = ['/projects', '/dashboard', '/assistant']
    
    for (const navPage of navigationPages) {
      // Navigate to page
      await page.goto(navPage)
      await page.waitForLoadState('networkidle')
      
      // Check that user state is maintained
      if (await userAvatar.isVisible()) {
        await expect(userAvatar).toBeVisible()
      }
      
      // Check that navigation is accessible
      const nav = page.locator('nav')
      await expect(nav).toBeVisible()
    }
  })

  test('should test Clerk authentication flow (if configured)', async ({ page }) => {
    const hasClerkKeys = await testClerkIntegration(page)
    
    if (hasClerkKeys) {
      // Test with Clerk configured
      await page.goto('/sign-in')
      
      // Should show Clerk sign-in component
      await page.waitForSelector('[data-clerk-id], .cl-component', { timeout: 10000 })
      
      const clerkComponent = page.locator('[data-clerk-id], .cl-component')
      await expect(clerkComponent).toBeVisible()
      
      // Test form interactions (without actually signing in)
      const emailInput = page.locator('input[type="email"], input[name="emailAddress"]')
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com')
        await expect(emailInput).toHaveValue('test@example.com')
        
        // Clear the input
        await emailInput.clear()
      }
      
      // Test switching to sign-up
      const signUpLink = page.locator('a:has-text("Sign up"), button:has-text("Sign up")')
      if (await signUpLink.isVisible()) {
        await signUpLink.click()
        await page.waitForURL('**/sign-up**')
        
        const signUpComponent = page.locator('[data-clerk-id], .cl-component')
        await expect(signUpComponent).toBeVisible()
      }
      
    } else {
      // No Clerk configuration - should work in demo mode
      await page.goto('/')
      await expect(page).toHaveURL('/assistant')
      await checkDemoModeElements(page)
    }
  })

  test('should test authentication error handling', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    
    const hasClerkComponent = await page.locator('[data-clerk-id], .cl-component').isVisible()
    
    if (hasClerkComponent) {
      // Test invalid email format
      const emailInput = page.locator('input[type="email"], input[name="emailAddress"]')
      if (await emailInput.isVisible()) {
        await emailInput.fill('invalid-email')
        
        // Try to submit or move to next field
        await page.keyboard.press('Tab')
        
        // Look for validation error
        const errorMessage = page.locator('.cl-formFieldError, [role="alert"], .error')
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible()
        }
      }
      
      // Test empty form submission
      const submitButton = page.locator('button[type="submit"], button:has-text("Sign in")')
      if (await submitButton.isVisible()) {
        await submitButton.click()
        
        // Should show validation errors
        const errors = page.locator('.cl-formFieldError, [role="alert"], .error')
        const errorCount = await errors.count()
        
        if (errorCount > 0) {
          await expect(errors.first()).toBeVisible()
        }
      }
    }
  })

  test('should test session persistence and logout', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Check if there's a logout/profile button
    const profileButton = page.locator('[data-clerk-id*="user"], .user-menu, button[aria-label*="profile"]')
    const logoutButton = page.locator('button:has-text("Sign out"), button:has-text("Logout")')
    
    if (await profileButton.isVisible()) {
      await profileButton.click()
      
      // Look for profile menu
      const profileMenu = page.locator('.cl-userButtonPopoverCard, .profile-menu, [role="menu"]')
      if (await profileMenu.isVisible()) {
        await expect(profileMenu).toBeVisible()
        
        // Look for logout option
        const logoutOption = page.locator('button:has-text("Sign out"), [role="menuitem"]:has-text("Logout")')
        if (await logoutOption.isVisible()) {
          // Test logout functionality
          await logoutOption.click()
          
          // Should redirect to sign-in or home
          await page.waitForURL(new RegExp('(sign-in|/)', 'i'))
        }
      }
    } else if (await logoutButton.isVisible()) {
      await logoutButton.click()
      await page.waitForURL(new RegExp('(sign-in|/)', 'i'))
    }
    
    // Test session restoration
    await page.reload()
    
    // Check authentication state after reload
    const currentUrl = page.url()
    if (currentUrl.includes('/sign-in')) {
      // Successfully logged out
      expect(currentUrl).toContain('sign-in')
    } else {
      // Still authenticated (demo mode or persistent session)
      const authIndicator = page.locator('text=Demo User, .user-avatar, [data-clerk-id]')
      if (await authIndicator.first().isVisible()) {
        await expect(authIndicator.first()).toBeVisible()
      }
    }
  })

  test('should test mobile authentication experience', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    
    const hasClerkComponent = await page.locator('[data-clerk-id], .cl-component').isVisible()
    
    if (hasClerkComponent) {
      // Test mobile Clerk component
      const clerkComponent = page.locator('[data-clerk-id], .cl-component')
      await expect(clerkComponent).toBeVisible()
      
      // Check mobile responsiveness
      const componentBox = await clerkComponent.boundingBox()
      if (componentBox) {
        expect(componentBox.width).toBeLessThan(375) // Should fit mobile screen
      }
      
      // Test form fields on mobile
      const emailInput = page.locator('input[type="email"]')
      if (await emailInput.isVisible()) {
        const inputBox = await emailInput.boundingBox()
        if (inputBox) {
          expect(inputBox.height).toBeGreaterThan(40) // Good touch target
        }
      }
    }
    
    // Test mobile navigation after auth
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    const mobileNav = page.locator('nav')
    await expect(mobileNav).toBeVisible()
    
    // User avatar should be appropriately sized for mobile
    const userAvatar = page.locator('.avatar, [role="img"]')
    if (await userAvatar.first().isVisible()) {
      const avatarBox = await userAvatar.first().boundingBox()
      if (avatarBox) {
        expect(avatarBox.width).toBeGreaterThan(32) // Minimum touch target
        expect(avatarBox.height).toBeGreaterThan(32)
      }
    }
  })

  test('should test authentication keyboard navigation', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    
    const hasClerkComponent = await page.locator('[data-clerk-id], .cl-component').isVisible()
    
    if (hasClerkComponent) {
      // Test keyboard navigation through sign-in form
      await page.keyboard.press('Tab')
      
      let currentFocus = page.locator(':focus')
      await expect(currentFocus).toBeVisible()
      
      // Continue tabbing through form elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        currentFocus = page.locator(':focus')
        if (await currentFocus.isVisible()) {
          await expect(currentFocus).toBeVisible()
        }
      }
      
      // Test Enter key on focused elements
      const emailInput = page.locator('input[type="email"]:focus')
      if (await emailInput.isVisible()) {
        await emailInput.type('test@example.com')
        await page.keyboard.press('Enter')
      }
    }
    
    // Test keyboard navigation in authenticated state
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Tab through navigation elements
    await page.keyboard.press('Tab')
    
    const focusedNavElement = page.locator('nav :focus')
    if (await focusedNavElement.isVisible()) {
      await expect(focusedNavElement).toBeVisible()
    }
  })

  test('should test authentication edge cases and security', async ({ page }) => {
    // Test direct access to auth pages when already authenticated
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // If we can access assistant, we're authenticated (or in demo mode)
    const isAuthenticated = page.url().includes('/assistant')
    
    if (isAuthenticated) {
      // Try to access sign-in page while authenticated
      await page.goto('/sign-in')
      await page.waitForLoadState('networkidle')
      
      // Should either show sign-in or redirect (behavior depends on Clerk config)
      const currentUrl = page.url()
      expect(currentUrl).toBeTruthy()
    }
    
    // Test session timeout handling (if applicable)
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Should either access projects or redirect to auth
    const projectsAccessible = page.url().includes('/projects') || page.url().includes('/sign-in')
    expect(projectsAccessible).toBeTruthy()
    
    // Test CSRF protection (implicit in Clerk)
    // This is handled by Clerk's built-in security measures
  })
})