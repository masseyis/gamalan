import { test, expect, type Page } from '@playwright/test'

// Helper function to wait for assistant components
async function waitForAssistant(page: Page) {
  await page.waitForSelector('[data-testid="assistant-bar"]')
  await page.waitForSelector('[data-testid="suggestion-feed"]', { state: 'visible', timeout: 10000 })
}

// Helper function to type utterance and submit
async function typeAndSubmitUtterance(page: Page, utterance: string) {
  const textarea = page.locator('textarea')
  await textarea.fill(utterance)
  await page.keyboard.press('Enter')
}

test.describe('AI-First Assistant Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Enable mock mode for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
    })
    
    // Navigate to assistant page
    await page.goto('/assistant')
    await waitForAssistant(page)
  })

  test('should display assistant interface correctly', async ({ page }) => {
    // Check page title and main components
    await expect(page).toHaveTitle(/Salunga/)
    
    // Verify assistant bar is present and has correct placeholder
    const assistantBar = page.locator('[data-testid="assistant-bar"]')
    await expect(assistantBar).toBeVisible()
    
    const textarea = page.locator('textarea')
    await expect(textarea).toHaveAttribute('placeholder', /Tell me what you'd like to do/)
    
    // Verify navigation shows Assistant as active
    const assistantNavItem = page.locator('nav').locator('text=Assistant')
    await expect(assistantNavItem).toBeVisible()
    
    // Verify welcome message is shown initially
    const welcomeCard = page.locator('text=Welcome to Your AI Assistant')
    await expect(welcomeCard).toBeVisible()
  })

  test('should handle natural language input and show interpretation', async ({ page }) => {
    const utterance = 'I finished the authentication task'
    
    // Type utterance and submit
    await typeAndSubmitUtterance(page, utterance)
    
    // Wait for processing state
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible()
    
    // Wait for candidate picker dialog to appear
    await page.waitForSelector('[data-testid="candidate-picker-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const candidateDialog = page.locator('[data-testid="candidate-picker-dialog"]')
    await expect(candidateDialog).toBeVisible()
    await expect(candidateDialog).toContainText('Which one did you mean?')
  })

  test('should handle candidate selection flow', async ({ page }) => {
    await typeAndSubmitUtterance(page, 'I finished my current task')
    
    // Wait for candidate picker
    await page.waitForSelector('[data-testid="candidate-picker-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    // Select first candidate
    const firstCandidate = page.locator('[data-testid="candidate-card"]').first()
    await firstCandidate.click()
    
    // Submit selection
    const selectButton = page.locator('button:has-text("Select This One")')
    await selectButton.click()
    
    // Wait for action preview dialog (new draft step)
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'visible', 
      timeout: 10000 
    })
    
    const previewDialog = page.locator('[data-testid="action-preview-dialog"]')
    await expect(previewDialog).toBeVisible()
    await expect(previewDialog).toContainText('Action Preview')
    await expect(previewDialog).toContainText('What I\'ll Do')
  })

  test('should handle action preview and confirmation', async ({ page }) => {
    await typeAndSubmitUtterance(page, 'Split the user onboarding story')
    
    // This utterance should auto-select (no candidate picker) and show preview
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const previewDialog = page.locator('[data-testid="action-preview-dialog"]')
    await expect(previewDialog).toBeVisible()
    
    // Check that preview shows the plan
    await expect(previewDialog).toContainText('What I\'ll Do')
    await expect(previewDialog).toContainText('Steps to Execute')
    await expect(previewDialog).toContainText('Risk Level')
    
    // Proceed with the action
    const proceedButton = page.locator('button:has-text("Proceed with Action")')
    await proceedButton.click()
    
    // Wait for preview dialog to close and action to complete
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'hidden', 
      timeout: 10000 
    })
    
    // Should show success feedback
    const successToast = page.locator('.toast', { hasText: 'successfully' })
    await expect(successToast).toBeVisible({ timeout: 5000 })
  })

  test('should display and interact with suggestions', async ({ page }) => {
    // Wait for suggestions to load
    await page.waitForTimeout(2000) // Allow auto-fetch to complete
    
    const suggestionFeed = page.locator('[data-testid="suggestion-feed"]')
    await expect(suggestionFeed).toBeVisible()
    
    // Switch to suggestions tab if not already active
    const suggestionsTab = page.locator('button:has-text("Suggestions")')
    await suggestionsTab.click()
    
    // Should have suggestion cards
    const suggestionCards = page.locator('[data-testid="suggestion-card"]')
    await expect(suggestionCards.first()).toBeVisible()
    
    // Test accepting a suggestion
    const acceptButton = suggestionCards.first().locator('button:has-text("Accept")')
    if (await acceptButton.isVisible()) {
      await acceptButton.click()
      
      // Should show success toast
      const toast = page.locator('.toast')
      await expect(toast).toBeVisible({ timeout: 5000 })
    }
  })

  test('should handle quick actions', async ({ page }) => {
    // Switch to Quick Actions tab
    const quickActionsTab = page.locator('button:has-text("Quick Actions")')
    await quickActionsTab.click()
    
    // Should show quick action categories
    const quickActionsSection = page.locator('text=Common Actions')
    await expect(quickActionsSection).toBeVisible()
    
    // Click on a quick action
    const markTaskDone = page.locator('text=Mark Task Complete').first()
    await markTaskDone.click()
    
    // Should pre-fill the assistant bar
    const textarea = page.locator('textarea')
    await expect(textarea).toHaveValue(/finished my current task/)
    
    // Submit the pre-filled utterance
    await page.keyboard.press('Enter')
    
    // Should proceed to candidate selection or confirmation
    await page.waitForSelector('[data-testid="candidate-picker-dialog"], [data-testid="confirm-action-dialog"]', { 
      timeout: 15000 
    })
  })

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test Cmd+K focusing assistant bar
    await page.keyboard.press('Meta+k')
    
    const textarea = page.locator('textarea')
    await expect(textarea).toBeFocused()
    
    // Test Enter to submit
    await textarea.fill('test utterance')
    await page.keyboard.press('Enter')
    
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible()
  })

  test('should handle error states gracefully', async ({ page }) => {
    // Mock a network error
    await page.route('**/interpret', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service temporarily unavailable' })
      })
    })
    
    await typeAndSubmitUtterance(page, 'test error handling')
    
    // Should show error message
    const errorMessage = page.locator('text=Service temporarily unavailable')
    await expect(errorMessage).toBeVisible({ timeout: 15000 })
    
    // Error should be dismissible
    const dismissButton = page.locator('button:has-text("×")')
    await dismissButton.click()
    
    await expect(errorMessage).not.toBeVisible()
  })

  test('should maintain conversation history', async ({ page }) => {
    // Submit multiple utterances
    await typeAndSubmitUtterance(page, 'first utterance')
    await page.waitForTimeout(1000)
    
    // Cancel any dialogs
    const cancelButton = page.locator('button:has-text("Cancel")')
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
    }
    
    // Focus textarea and use arrow key to navigate history
    const textarea = page.locator('textarea')
    await textarea.click()
    await page.keyboard.press('ArrowUp')
    
    // Should show previous utterance
    await expect(textarea).toHaveValue('first utterance')
  })

  test('should show recent activity', async ({ page }) => {
    // Switch to Recent Activity tab
    const historyTab = page.locator('button:has-text("Recent Activity")')
    await historyTab.click()
    
    // Initially should be empty
    const noActivityMessage = page.locator('text=No recent activity')
    await expect(noActivityMessage).toBeVisible()
    
    // Complete an action to populate history
    await typeAndSubmitUtterance(page, 'Split the user onboarding story')
    
    await page.waitForSelector('[data-testid="confirm-action-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const confirmButton = page.locator('button:has-text("Confirm & Execute")')
    await confirmButton.click()
    
    await page.waitForTimeout(2000)
    
    // Check recent activity tab
    await historyTab.click()
    
    // Should now show the completed action
    const recentAction = page.locator('[data-testid="action-result-card"]')
    await expect(recentAction.first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Assistant Navigation Integration', () => {
  test('should navigate to assistant from other pages', async ({ page }) => {
    // Start on projects page
    await page.goto('/projects')
    
    // Click assistant in navigation
    const assistantNavItem = page.locator('nav').locator('text=Assistant')
    await assistantNavItem.click()
    
    // Should navigate to assistant page
    await expect(page).toHaveURL('/assistant')
    await waitForAssistant(page)
  })

  test('should focus assistant bar from global shortcut', async ({ page }) => {
    await page.goto('/projects')
    
    // Use Cmd+K shortcut
    await page.keyboard.press('Meta+k')
    
    // Should navigate to assistant and focus input
    await expect(page).toHaveURL('/assistant')
    
    const textarea = page.locator('textarea')
    await expect(textarea).toBeFocused({ timeout: 5000 })
  })
})