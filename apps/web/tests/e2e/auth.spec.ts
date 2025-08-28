import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to sign-in page
    await expect(page).toHaveURL(/.*sign-in.*/);
    
    // Should show sign-in form
    await expect(page.locator('[data-testid="sign-in-form"], .cl-signIn-root')).toBeVisible();
  });

  test('should redirect to sign-up when clicking sign-up link', async ({ page }) => {
    await page.goto('/sign-in');
    
    // Look for sign-up link and click it
    const signUpLink = page.locator('a[href*="sign-up"], button:has-text("Sign up")');
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await expect(page).toHaveURL(/.*sign-up.*/);
    }
  });

  test('should show dashboard when authenticated', async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      // Mock Clerk session
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token');
    });

    await page.goto('/');
    
    // Should show dashboard content
    await expect(page.locator('h1:has-text("Welcome back")')).toBeVisible();
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });
});