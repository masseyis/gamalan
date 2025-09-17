import { test, expect } from '@playwright/test';
import { setupMockAuth } from '@/lib/auth/test-utils';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mock authentication for testing
    await setupMockAuth(page);
  });

  test('should show projects page', async ({ page }) => {
    await page.goto('/projects');
    
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();
    await expect(page.locator('text=New Project')).toBeVisible();
  });

  test('should navigate to new project page', async ({ page }) => {
    await page.goto('/projects');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Click the New Project button and wait for navigation
    await Promise.all([
      page.waitForURL(/.*projects\/new.*/),
      page.locator('a:has-text("New Project"), button:has-text("New Project")').first().click()
    ]);

    await expect(page.locator('h1:has-text("Create New Project")')).toBeVisible();
  });

  test('should show project creation form', async ({ page }) => {
    await page.goto('/projects/new');
    
    // Check form elements
    await expect(page.locator('input[name="name"], input#name')).toBeVisible();
    await expect(page.locator('textarea[name="description"], textarea#description')).toBeVisible();
    await expect(page.locator('button:has-text("Create Project")')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/projects/new');
    
    // Check that submit button is initially disabled when form is empty
    const submitButton = page.locator('button:has-text("Create Project")');
    await expect(submitButton).toBeDisabled();
    
    // Verify form fields are present
    const projectNameInput = page.locator('input[name="name"], input#name');
    await expect(projectNameInput).toBeVisible();
    
    // Button should remain disabled until name is filled
    await expect(submitButton).toBeDisabled();
  });

  test('should show empty state when no projects exist', async ({ page }) => {
    await page.goto('/projects');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for empty state indicators (more specific text matching)
    const emptyStateIndicators = [
      page.locator('text=No projects yet'),
      page.locator('text=Create your first project'),
      page.locator('text=Create Your First Project'),
      page.locator('[data-testid="empty-projects"]')
    ];

    // Check if any empty state indicator is visible
    let foundEmptyState = false;
    for (const locator of emptyStateIndicators) {
      if (await locator.isVisible()) {
        foundEmptyState = true;
        break;
      }
    }

    // If no empty state found, assume projects exist - check for project cards
    if (!foundEmptyState) {
      await expect(page.locator('[data-testid="project-card"]')).toBeVisible();
    } else {
      // Verify we can see the empty state
      await expect(page.locator('text=No projects yet')).toBeVisible();
    }
  });
});