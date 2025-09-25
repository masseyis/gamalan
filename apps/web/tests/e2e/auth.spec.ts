import { test, expect } from '@playwright/test';
import { setupMockAuth } from '@/lib/auth/test-utils';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock authentication for testing
    await setupMockAuth(page);
  });

  test('should show home page when not authenticated in mock mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // In mock mode, we should see the home page with welcome message
    await expect(page.locator('h1:has-text("Welcome to")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=AI-Enhanced Agile Project Management')).toBeVisible();

    // Should show main action buttons
    await expect(page.locator('text=Start with AI Assistant')).toBeVisible();
    await expect(page.locator('text=Go to Dashboard')).toBeVisible();
  });

  test('should navigate to dashboard from home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click on "Go to Dashboard" button
    await page.locator('text=Go to Dashboard').click();
    await page.waitForLoadState('networkidle');

    // Should navigate to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show dashboard when navigating directly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for the page to fully load and render
    await page.waitForTimeout(2000); // Allow time for React to render

    // Should show dashboard content - updated to match actual rendered content
    await expect(page.locator('h1:has-text("Welcome back,")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });
});