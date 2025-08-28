import { test, expect } from '@playwright/test';

test.describe('Backlog Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token');
    });
  });

  test('should show backlog page for a project', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog`);
    
    await expect(page.locator('h1:has-text("Backlog")')).toBeVisible();
    await expect(page.locator('text=New Story')).toBeVisible();
  });

  test('should navigate to new story page', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog`);
    
    await page.locator('a:has-text("New Story"), button:has-text("New Story")').first().click();
    
    await expect(page).toHaveURL(new RegExp(`.*projects/${projectId}/backlog/new.*`));
    await expect(page.locator('h1:has-text("Create New Story")')).toBeVisible();
  });

  test('should show story creation form', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog/new`);
    
    // Check form elements
    await expect(page.locator('input[name="title"], input#title')).toBeVisible();
    await expect(page.locator('textarea[name="description"], textarea#description')).toBeVisible();
    await expect(page.locator('button:has-text("Create Story")')).toBeVisible();
  });

  test('should show AI assistant in backlog', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog`);
    
    // Look for AI Assistant component
    await expect(page.locator('text=AI Assistant')).toBeVisible();
    await expect(page.locator('text=Beta')).toBeVisible();
  });

  test('should expand AI assistant when clicked', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog`);
    
    // Click expand button
    await page.locator('button:has-text("Expand")').click();
    
    // Should show collapsed button
    await expect(page.locator('button:has-text("Collapse")')).toBeVisible();
    
    // Should show beta warning
    await expect(page.locator('text=AI features are in beta')).toBeVisible();
  });

  test('should show acceptance criteria section in story form', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog/new`);
    
    await expect(page.locator('text=Acceptance Criteria')).toBeVisible();
    await expect(page.locator('text=Given')).toBeVisible();
    await expect(page.locator('text=When')).toBeVisible();
    await expect(page.locator('text=Then')).toBeVisible();
  });

  test('should allow adding acceptance criteria', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog/new`);
    
    // Click add acceptance criterion button
    const addButton = page.locator('button:has-text("Add Acceptance Criterion")');
    await expect(addButton).toBeVisible();
    
    await addButton.click();
    
    // Should have multiple criterion sections
    const criteriaCount = await page.locator('text=Criterion').count();
    expect(criteriaCount).toBeGreaterThan(1);
  });

  test('should show story stats', async ({ page }) => {
    const projectId = 'test-project-id';
    await page.goto(`/projects/${projectId}/backlog`);
    
    // Look for stats cards
    await expect(page.locator('text=Total Stories')).toBeVisible();
    await expect(page.locator('text=Ready for Sprint')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Completed')).toBeVisible();
  });
});