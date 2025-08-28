import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token');
    });
  });

  test('should show projects page', async ({ page }) => {
    await page.goto('/projects');
    
    await expect(page.locator('h1:has-text("Projects")')).toBeVisible();
    await expect(page.locator('text=New Project')).toBeVisible();
  });

  test('should navigate to new project page', async ({ page }) => {
    await page.goto('/projects');
    
    await page.locator('a:has-text("New Project"), button:has-text("New Project")').first().click();
    
    await expect(page).toHaveURL(/.*projects\/new.*/);
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
    
    // Look for empty state indicators
    const emptyStateIndicators = [
      'text=No projects yet',
      'text=Create your first project',
      '[data-testid="empty-projects"]'
    ];
    
    // At least one empty state indicator should be visible if no projects exist
    let foundEmptyState = false;
    for (const selector of emptyStateIndicators) {
      if (await page.locator(selector).isVisible()) {
        foundEmptyState = true;
        break;
      }
    }
    
    // If no empty state found, assume projects exist - check for project cards
    if (!foundEmptyState) {
      await expect(page.locator('[data-testid="project-card"], .project-card')).toBeVisible();
    }
  });
});