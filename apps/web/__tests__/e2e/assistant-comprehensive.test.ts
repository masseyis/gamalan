import { test, expect, type Page, type Locator } from '@playwright/test'

// Helper functions for assistant interactions
async function waitForAssistant(page: Page) {
  await page.waitForSelector('[data-testid="assistant-bar"]')
  await page.waitForSelector('[data-testid="suggestion-feed"]', { state: 'visible', timeout: 10000 })
}

async function typeAndSubmitUtterance(page: Page, utterance: string) {
  const textarea = page.locator('textarea')
  await textarea.fill(utterance)
  await page.keyboard.press('Enter')
}

async function clickButtonSafely(page: Page, selector: string) {
  const button = page.locator(selector)
  await expect(button).toBeVisible()
  await expect(button).toBeEnabled()
  await button.click()
}

async function testTabInteraction(page: Page, tabName: string) {
  const tab = page.locator(`button:has-text("${tabName}")`)
  await expect(tab).toBeVisible()
  await tab.click()
  
  // Wait for tab content to load
  await page.waitForTimeout(1000)
  
  // Verify tab is active
  await expect(tab).toHaveClass(/bg-background|border-border/)
}

test.describe('Comprehensive Assistant Interface Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable all mock modes for comprehensive testing
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_AI_ASSISTANT_ENABLED', 'true')
    })
    
    await page.goto('/assistant')
    await waitForAssistant(page)
  })

  test('should test all assistant bar interactions and states', async ({ page }) => {
    const textarea = page.locator('textarea')
    
    // Test placeholder text
    await expect(textarea).toHaveAttribute('placeholder', /Tell me what you'd like to do/)
    
    // Test focus state
    await textarea.focus()
    await expect(textarea).toBeFocused()
    
    // Test typing and auto-resize
    const shortText = 'Short text'
    await textarea.fill(shortText)
    await expect(textarea).toHaveValue(shortText)
    
    const longText = 'This is a much longer text that should cause the textarea to auto-resize and expand to accommodate more content. It should handle multiple lines gracefully and maintain good user experience.'
    await textarea.fill(longText)
    await expect(textarea).toHaveValue(longText)
    
    // Test clearing input
    await textarea.fill('')
    await expect(textarea).toHaveValue('')
    
    // Test keyboard shortcuts
    await page.keyboard.press('Meta+k')
    await expect(textarea).toBeFocused()
    
    // Test submission with Enter
    await textarea.fill('test submission')
    await page.keyboard.press('Enter')
    
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible()
  })

  test('should test all assistant tabs and their content', async ({ page }) => {
    const tabs = ['Suggestions', 'Quick Actions', 'Recent Activity']
    
    for (const tabName of tabs) {
      await testTabInteraction(page, tabName)
      
      // Test tab-specific content
      switch (tabName) {
        case 'Suggestions':
          // Test suggestion cards and interactions
          const suggestionCards = page.locator('[data-testid="suggestion-card"]')
          const suggestionCount = await suggestionCards.count()
          
          if (suggestionCount > 0) {
            // Test suggestion card buttons
            const firstSuggestion = suggestionCards.first()
            await expect(firstSuggestion).toBeVisible()
            
            // Test Accept button
            const acceptButton = firstSuggestion.locator('button:has-text("Accept")')
            if (await acceptButton.isVisible()) {
              await acceptButton.click()
              
              // Should show toast or feedback
              const toast = page.locator('.toast, [role="alert"]')
              await expect(toast).toBeVisible({ timeout: 5000 })
            }
            
            // Test Dismiss/Ignore button
            const dismissButton = firstSuggestion.locator('button:has-text("Dismiss"), button:has-text("Ignore")')
            if (await dismissButton.isVisible()) {
              await dismissButton.click()
            }
          }
          
          // Test refresh suggestions button
          const refreshButton = page.locator('button').filter({ has: page.locator('svg[data-lucide="refresh-cw"]') })
          if (await refreshButton.isVisible()) {
            await refreshButton.click()
            await page.waitForTimeout(2000) // Wait for refresh
          }
          break
          
        case 'Quick Actions':
          // Test quick action categories and buttons
          const quickActionSections = [
            'Common Actions',
            'Task Management',
            'Project Actions'
          ]
          
          for (const section of quickActionSections) {
            const sectionHeader = page.locator(`text=${section}`)
            if (await sectionHeader.isVisible()) {
              await expect(sectionHeader).toBeVisible()
            }
          }
          
          // Test quick action buttons
          const quickActionButtons = page.locator('button:has-text("Mark Task Complete"), button:has-text("Create Story"), button:has-text("Update Status")')
          const buttonCount = await quickActionButtons.count()
          
          if (buttonCount > 0) {
            const firstButton = quickActionButtons.first()
            await firstButton.click()
            
            // Should pre-fill the assistant bar
            const textarea = page.locator('textarea')
            const textareaValue = await textarea.inputValue()
            expect(textareaValue.length).toBeGreaterThan(0)
          }
          break
          
        case 'Recent Activity':
          // Test activity list and action cards
          const activityCards = page.locator('[data-testid="action-result-card"], .activity-card')
          const activityCount = await activityCards.count()
          
          if (activityCount > 0) {
            // Test activity card interactions
            const firstActivity = activityCards.first()
            await expect(firstActivity).toBeVisible()
            
            // Test expand/collapse or view details
            const detailsButton = firstActivity.locator('button:has-text("Details"), button:has-text("View")')
            if (await detailsButton.isVisible()) {
              await detailsButton.click()
            }
            
            // Test undo button if present
            const undoButton = firstActivity.locator('button:has-text("Undo")')
            if (await undoButton.isVisible()) {
              await undoButton.click()
            }
          } else {
            // Test empty state
            const emptyMessage = page.locator('text=No recent activity')
            await expect(emptyMessage).toBeVisible()
          }
          break
      }
    }
  })

  test('should test complete utterance processing flow with all dialogs', async ({ page }) => {
    // Test candidate picker dialog flow
    await typeAndSubmitUtterance(page, 'I finished the authentication task')
    
    // Wait for processing
    const processingIndicator = page.locator('text=Processing your request')
    await expect(processingIndicator).toBeVisible()
    
    // Wait for candidate picker dialog
    await page.waitForSelector('[data-testid="candidate-picker-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const candidateDialog = page.locator('[data-testid="candidate-picker-dialog"]')
    await expect(candidateDialog).toBeVisible()
    await expect(candidateDialog).toContainText('Which one did you mean?')
    
    // Test candidate selection
    const candidateCards = page.locator('[data-testid="candidate-card"]')
    const candidateCount = await candidateCards.count()
    expect(candidateCount).toBeGreaterThan(0)
    
    // Click on first candidate
    const firstCandidate = candidateCards.first()
    await firstCandidate.click()
    
    // Test selection buttons
    const selectButton = page.locator('button:has-text("Select This One")')
    await expect(selectButton).toBeVisible()
    await expect(selectButton).toBeEnabled()
    await selectButton.click()
    
    // Test cancel functionality
    await typeAndSubmitUtterance(page, 'Another test utterance')
    await page.waitForSelector('[data-testid="candidate-picker-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const cancelButton = page.locator('button:has-text("Cancel")')
    if (await cancelButton.isVisible()) {
      await cancelButton.click()
      await page.waitForSelector('[data-testid="candidate-picker-dialog"]', { 
        state: 'hidden', 
        timeout: 5000 
      })
    }
  })

  test('should test action preview dialog with all interactions', async ({ page }) => {
    // Submit utterance that should show action preview
    await typeAndSubmitUtterance(page, 'Split the user onboarding story')
    
    // Wait for action preview dialog
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    const previewDialog = page.locator('[data-testid="action-preview-dialog"]')
    await expect(previewDialog).toBeVisible()
    await expect(previewDialog).toContainText('Action Preview')
    
    // Test all sections of the preview dialog
    const expectedSections = [
      'What I\'ll Do',
      'Steps to Execute',
      'AI Reasoning',
      'Expected Outcome',
      'Risk Level'
    ]
    
    for (const section of expectedSections) {
      const sectionElement = previewDialog.locator(`text=${section}`)
      if (await sectionElement.isVisible()) {
        await expect(sectionElement).toBeVisible()
      }
    }
    
    // Test risk assessment display
    const riskBadge = previewDialog.locator('.bg-green-100, .bg-yellow-100, .bg-red-100')
    if (await riskBadge.first().isVisible()) {
      await expect(riskBadge.first()).toBeVisible()
    }
    
    // Test action buttons
    const proceedButton = page.locator('button:has-text("Proceed with Action")')
    const modifyButton = page.locator('button:has-text("Modify Request")')
    const cancelButton = page.locator('button:has-text("Cancel")')
    
    // Test all buttons are present and functional
    await expect(proceedButton).toBeVisible()
    await expect(proceedButton).toBeEnabled()
    
    if (await modifyButton.isVisible()) {
      await expect(modifyButton).toBeEnabled()
      // Click modify and verify it goes back to input
      await modifyButton.click()
      const textarea = page.locator('textarea')
      await expect(textarea).toBeFocused()
    }
    
    // Test proceeding with action
    await typeAndSubmitUtterance(page, 'Split the user onboarding story again')
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'visible', 
      timeout: 15000 
    })
    
    await proceedButton.click()
    
    // Should proceed to confirmation or execution
    await page.waitForSelector('[data-testid="action-preview-dialog"]', { 
      state: 'hidden', 
      timeout: 10000 
    })
  })

  test('should test confirm action dialog with all risk levels', async ({ page }) => {
    // Test utterance that leads to confirmation dialog
    const utterances = [
      { text: 'Mark task as complete', expectedRisk: 'low' },
      { text: 'Update multiple story statuses', expectedRisk: 'medium' },
      { text: 'Delete the project', expectedRisk: 'high' }
    ]
    
    for (const utterance of utterances) {
      await typeAndSubmitUtterance(page, utterance.text)
      
      // Wait for either action preview or confirm dialog
      const dialogSelector = '[data-testid="action-preview-dialog"], [data-testid="confirm-action-dialog"]'
      await page.waitForSelector(dialogSelector, { 
        state: 'visible', 
        timeout: 15000 
      })
      
      let confirmDialog = page.locator('[data-testid="confirm-action-dialog"]')
      
      // If it's action preview dialog, proceed to confirmation
      if (await page.locator('[data-testid="action-preview-dialog"]').isVisible()) {
        const proceedButton = page.locator('button:has-text("Proceed with Action")')
        await proceedButton.click()
        
        await page.waitForSelector('[data-testid="confirm-action-dialog"]', { 
          state: 'visible', 
          timeout: 10000 
        })
        
        confirmDialog = page.locator('[data-testid="confirm-action-dialog"]')
      }
      
      if (await confirmDialog.isVisible()) {
        // Test dialog content
        await expect(confirmDialog).toContainText('Confirm Action')
        
        // Test risk assessment
        const riskSection = confirmDialog.locator('text=Risk Level')
        if (await riskSection.isVisible()) {
          await expect(riskSection).toBeVisible()
        }
        
        // Test action buttons
        const confirmButton = page.locator('button:has-text("Confirm & Execute")')
        const cancelButton = page.locator('button:has-text("Cancel")')
        
        await expect(confirmButton).toBeVisible()
        await expect(confirmButton).toBeEnabled()
        await expect(cancelButton).toBeVisible()
        await expect(cancelButton).toBeEnabled()
        
        // Test cancel functionality
        await cancelButton.click()
        
        await page.waitForSelector('[data-testid="confirm-action-dialog"]', { 
          state: 'hidden', 
          timeout: 5000 
        })
      }
    }
  })

  test('should test error handling and recovery', async ({ page }) => {
    // Mock network error
    await page.route('**/interpret', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Service temporarily unavailable' })
      })
    })
    
    await typeAndSubmitUtterance(page, 'test error handling')
    
    // Should show error message
    const errorMessage = page.locator('text=Service temporarily unavailable, text=Error, .error-message')
    await expect(errorMessage.first()).toBeVisible({ timeout: 15000 })
    
    // Test error dismissal
    const dismissButtons = page.locator('button:has-text("×"), button:has-text("Dismiss"), button:has-text("Close")')
    if (await dismissButtons.first().isVisible()) {
      await dismissButtons.first().click()
    }
    
    // Remove error mock for next test
    await page.unroute('**/interpret')
  })

  test('should test conversation history and input history', async ({ page }) => {
    const utterances = [
      'First test utterance',
      'Second test utterance',
      'Third test utterance'
    ]
    
    // Submit multiple utterances
    for (const utterance of utterances) {
      await typeAndSubmitUtterance(page, utterance)
      await page.waitForTimeout(1000)
      
      // Cancel any dialogs that appear
      const cancelButton = page.locator('button:has-text("Cancel")')
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
      }
    }
    
    // Test input history with arrow keys
    const textarea = page.locator('textarea')
    await textarea.click()
    
    // Navigate through history
    await page.keyboard.press('ArrowUp')
    await expect(textarea).toHaveValue('Third test utterance')
    
    await page.keyboard.press('ArrowUp')
    await expect(textarea).toHaveValue('Second test utterance')
    
    await page.keyboard.press('ArrowDown')
    await expect(textarea).toHaveValue('Third test utterance')
  })

  test('should test welcome screen and first-time user experience', async ({ page }) => {
    // Clear any existing state
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    
    await page.reload()
    await waitForAssistant(page)
    
    // Should show welcome card
    const welcomeCard = page.locator('text=Welcome to Your AI Assistant')
    await expect(welcomeCard).toBeVisible()
    
    // Test welcome interaction elements
    const welcomeButtons = page.locator('button').filter({ hasText: /Get Started|Try Example|Learn More/ })
    const buttonCount = await welcomeButtons.count()
    
    if (buttonCount > 0) {
      const firstButton = welcomeButtons.first()
      await firstButton.click()
    }
    
    // Test example prompts if present
    const examplePrompts = page.locator('[data-testid="example-prompt"], .example-prompt')
    const exampleCount = await examplePrompts.count()
    
    if (exampleCount > 0) {
      const firstExample = examplePrompts.first()
      await firstExample.click()
      
      // Should populate textarea
      const textarea = page.locator('textarea')
      const value = await textarea.inputValue()
      expect(value.length).toBeGreaterThan(0)
    }
  })

  test('should test all keyboard shortcuts and accessibility', async ({ page }) => {
    const textarea = page.locator('textarea')
    
    // Test global shortcuts
    const shortcuts = [
      { key: 'Meta+k', expectedAction: 'focus-textarea' },
      { key: 'Escape', expectedAction: 'clear-focus' },
      { key: 'Meta+Enter', expectedAction: 'submit' }
    ]
    
    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut.key)
      
      switch (shortcut.expectedAction) {
        case 'focus-textarea':
          await expect(textarea).toBeFocused()
          break
        case 'clear-focus':
          // Should clear focus or close dialogs
          await page.waitForTimeout(500)
          break
        case 'submit':
          await textarea.fill('test shortcut submission')
          await page.keyboard.press(shortcut.key)
          // Should submit the form
          break
      }
    }
    
    // Test tab navigation
    await page.keyboard.press('Escape') // Clear any focus
    
    // Tab through interactive elements
    const interactiveElements = await page.locator('button:visible, a:visible, input:visible, textarea:visible').all()
    
    for (let i = 0; i < Math.min(interactiveElements.length, 10); i++) {
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    }
  })

  test('should test voice input and advanced features', async ({ page }) => {
    const textarea = page.locator('textarea')
    
    // Test voice button if present
    const voiceButton = page.locator('button').filter({ has: page.locator('svg[data-lucide="mic"]') })
    
    if (await voiceButton.isVisible()) {
      await expect(voiceButton).toBeEnabled()
      
      // Note: Actual voice testing would require browser permissions and mock audio
      // Here we just test the button interaction
      await voiceButton.click()
      
      // Should show recording state
      const recordingIndicator = page.locator('text=Recording, text=Listening')
      if (await recordingIndicator.isVisible()) {
        await expect(recordingIndicator).toBeVisible()
        
        // Click again to stop recording
        await voiceButton.click()
      }
    }
    
    // Test paste and drag-drop areas
    await textarea.focus()
    
    // Test pasting content
    await page.evaluate(() => {
      document.execCommand('insertText', false, 'Pasted content test')
    })
    
    const textareaValue = await textarea.inputValue()
    expect(textareaValue).toContain('Pasted content test')
  })
})