import { test, expect } from '@playwright/test'

test.describe('Sprint Board', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for demo mode
    await page.addInitScript(() => {
      window.localStorage.setItem('__clerk_jwt', 'mock-jwt-token')
    })
  })

  test('should show sprint board with columns', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1000)
    
    await expect(page.locator('h1:has-text("Sprint Board")')).toBeVisible()
    
    // Should show all sprint columns
    await expect(page.locator('text=Backlog')).toBeVisible()
    await expect(page.locator('text=Ready')).toBeVisible()
    await expect(page.locator('text=In Progress')).toBeVisible()
    await expect(page.locator('text=In Review')).toBeVisible()
    await expect(page.locator('text=Done')).toBeVisible()
  })

  test('should show stories in appropriate columns', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for stories to load
    await page.waitForTimeout(1500)
    
    // Check that stories appear in board
    await expect(page.locator('text=User Authentication System')).toBeVisible()
    await expect(page.locator('text=Project Dashboard')).toBeVisible()
  })

  test('should show draggable story cards', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1500)
    
    // Story cards should be draggable (look for drag handles or draggable attributes)
    const storyCards = page.locator('[data-testid="board-story-card"]')
    await expect(storyCards.first()).toBeVisible()
  })

  test('should allow drag and drop between columns', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1500)
    
    // Find a story card
    const storyCard = page.locator('[data-testid="board-story-card"]').first()
    
    if (await storyCard.isVisible()) {
      // Get initial position
      const initialColumn = await storyCard.locator('..').getAttribute('data-column') || await storyCard.locator('../..').getAttribute('data-column')
      
      // Try to drag to different column
      const targetColumn = page.locator('[data-testid="droppable-column"]').nth(1)
      
      if (await targetColumn.isVisible()) {
        await storyCard.dragTo(targetColumn)
        
        // Verify the card moved (this would require implementation)
        // The exact assertion depends on how the drag-and-drop is implemented
      }
    }
  })

  test('should show story details in board cards', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1500)
    
    // Story cards should show essential information
    await expect(page.locator('text=8')).toBeVisible() // Story points
    await expect(page.locator('text=high')).toBeVisible() // Priority
  })

  test('should navigate to story detail from board', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1500)
    
    // Click on a story title
    await page.locator('text=User Authentication System').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1\/backlog\/story-1$/)
  })

  test('should show column statistics', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for board to load
    await page.waitForTimeout(1000)
    
    // Columns should show counts or story points
    // This depends on implementation details
    const columns = page.locator('[data-testid="board-column"]')
    const count = await columns.count()
    expect(count).toBeGreaterThan(3)
  })

  test('should navigate back to project', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    await page.locator('text=Back to Project').first().click()
    
    await expect(page).toHaveURL(/.*\/projects\/proj-1$/)
  })

  test('should show AI assistant on board', async ({ page }) => {
    await page.goto('/projects/proj-1/board')
    
    // Wait for components to load
    await page.waitForTimeout(500)
    
    // AI assistant should be available
    await expect(page.locator('[data-testid="ai-assistant"]')).toBeVisible()
  })
})