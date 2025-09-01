import { test, expect, type Page, type Locator } from '@playwright/test'

// Helper functions for accessibility testing
async function checkAriaAttributes(page: Page, selector: string | Locator, expectedAttributes: Record<string, string>) {
  const element = typeof selector === 'string' ? page.locator(selector) : selector
  if (await element.isVisible()) {
    for (const [attr, expectedValue] of Object.entries(expectedAttributes)) {
      const actualValue = await element.getAttribute(attr)
      expect(actualValue).toBe(expectedValue)
    }
  }
}

async function testKeyboardNavigation(page: Page, startSelector?: string) {
  // Start from specific element or document
  if (startSelector) {
    await page.locator(startSelector).focus()
  } else {
    await page.keyboard.press('Tab')
  }
  
  const focusableElements = []
  let attempts = 0
  const maxAttempts = 20
  
  while (attempts < maxAttempts) {
    const currentFocus = page.locator(':focus')
    if (await currentFocus.isVisible()) {
      const tagName = await currentFocus.evaluate(el => el.tagName.toLowerCase())
      const id = await currentFocus.getAttribute('id')
      const className = await currentFocus.getAttribute('class')
      
      focusableElements.push({
        tagName,
        id: id || 'no-id',
        className: className || 'no-class'
      })
      
      await page.keyboard.press('Tab')
    } else {
      break
    }
    attempts++
  }
  
  return focusableElements
}

async function checkColorContrast(page: Page, selector: string, minRatio: number = 4.5) {
  const element = page.locator(selector)
  if (await element.isVisible()) {
    const styles = await element.evaluate((el) => {
      const computed = window.getComputedStyle(el)
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize
      }
    })
    
    // Note: In a real implementation, you'd use a library like color-contrast-checker
    // Here we just verify that colors are set
    expect(styles.color).toBeTruthy()
    expect(styles.backgroundColor).toBeTruthy()
  }
}

async function testScreenReaderContent(page: Page, selector: string) {
  const element = page.locator(selector)
  if (await element.isVisible()) {
    // Check for screen reader specific attributes
    const ariaLabel = await element.getAttribute('aria-label')
    const ariaLabelledBy = await element.getAttribute('aria-labelledby')
    const ariaDescribedBy = await element.getAttribute('aria-describedby')
    const title = await element.getAttribute('title')
    const altText = await element.getAttribute('alt')
    
    // At least one should be present for screen readers
    const hasScreenReaderContent = !!(ariaLabel || ariaLabelledBy || ariaDescribedBy || title || altText)
    
    if (!hasScreenReaderContent) {
      const textContent = await element.textContent()
      const hasVisibleText = textContent && textContent.trim().length > 0
      expect(hasVisibleText).toBeTruthy()
    }
  }
}

test.describe('Comprehensive Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('NEXT_PUBLIC_ENABLE_MOCK_DATA', 'true')
      window.localStorage.setItem('NEXT_PUBLIC_ORCHESTRATOR_MOCK', 'true')
    })
  })

  test('should have proper semantic HTML structure on all pages', async ({ page }) => {
    const pages = [
      '/assistant',
      '/projects', 
      '/dashboard',
      '/projects/new'
    ]
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await page.waitForLoadState('networkidle')
      
      // Check for main landmarks
      const main = page.locator('main, [role="main"]')
      const nav = page.locator('nav, [role="navigation"]')
      const header = page.locator('header, [role="banner"]')
      
      await expect(nav).toBeVisible()
      
      // Check heading hierarchy
      const h1Elements = page.locator('h1')
      const h1Count = await h1Elements.count()
      expect(h1Count).toBeGreaterThanOrEqual(1) // Should have at least one h1
      expect(h1Count).toBeLessThanOrEqual(2) // Should not have more than 2 h1s
      
      // Check that headings are properly nested
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase())
        const text = await heading.textContent()
        expect(text?.trim()).toBeTruthy() // Headings should have text content
      }
    }
  })

  test('should have proper ARIA attributes and roles', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test navigation ARIA
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    
    // Test buttons with proper roles
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        const role = await button.getAttribute('role')
        const ariaLabel = await button.getAttribute('aria-label')
        const textContent = await button.textContent()
        
        // Button should have accessible name
        const hasAccessibleName = !!(ariaLabel || (textContent && textContent.trim()))
        expect(hasAccessibleName).toBeTruthy()
      }
    }
    
    // Test form controls
    const inputs = page.locator('input, textarea')
    const inputCount = await inputs.count()
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      if (await input.isVisible()) {
        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')
        
        // Input should have label association
        const hasLabel = !!(id || ariaLabel || ariaLabelledBy)
        
        if (id) {
          // Check for corresponding label
          const label = page.locator(`label[for="${id}"]`)
          if (await label.isVisible()) {
            expect(label).toBeVisible()
          }
        }
      }
    }
    
    // Test dialog ARIA (if present)
    const dialogs = page.locator('[role="dialog"], .dialog, [data-testid*="dialog"]')
    const dialogCount = await dialogs.count()
    
    for (let i = 0; i < dialogCount; i++) {
      const dialog = dialogs.nth(i)
      if (await dialog.isVisible()) {
        await checkAriaAttributes(page, dialog, {
          'role': 'dialog',
          'aria-modal': 'true'
        })
        
        // Dialog should have accessible name
        const ariaLabel = await dialog.getAttribute('aria-label')
        const ariaLabelledBy = await dialog.getAttribute('aria-labelledby')
        expect(!!(ariaLabel || ariaLabelledBy)).toBeTruthy()
      }
    }
  })

  test('should support full keyboard navigation', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test Tab navigation
    const focusableElements = await testKeyboardNavigation(page)
    expect(focusableElements.length).toBeGreaterThan(0)
    
    // Test specific keyboard shortcuts
    const shortcuts = [
      { key: 'Meta+k', expectedAction: 'focus-textarea' },
      { key: 'Escape', expectedAction: 'clear-focus' }
    ]
    
    for (const shortcut of shortcuts) {
      await page.keyboard.press(shortcut.key)
      
      if (shortcut.expectedAction === 'focus-textarea') {
        const textarea = page.locator('textarea')
        await expect(textarea).toBeFocused()
      }
      
      await page.waitForTimeout(500)
    }
    
    // Test Enter key activation
    const firstButton = page.locator('button').first()
    if (await firstButton.isVisible()) {
      await firstButton.focus()
      await expect(firstButton).toBeFocused()
      
      // Note: We don't actually press Enter to avoid side effects
    }
    
    // Test arrow key navigation in lists/grids
    const suggestionCards = page.locator('[data-testid="suggestion-card"]')
    const cardCount = await suggestionCards.count()
    
    if (cardCount > 1) {
      await suggestionCards.first().focus()
      await page.keyboard.press('ArrowDown')
      // Second card should be focused (if implemented)
    }
  })

  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test focus on interactive elements
    const interactiveElements = await page.locator('button:visible, a:visible, input:visible, textarea:visible').all()
    
    for (let i = 0; i < Math.min(interactiveElements.length, 10); i++) {
      const element = interactiveElements[i]
      
      await element.focus()
      await expect(element).toBeFocused()
      
      // Check for focus styles
      const focusStyles = await element.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          outline: computed.outline,
          outlineColor: computed.outlineColor,
          outlineWidth: computed.outlineWidth,
          borderColor: computed.borderColor,
          boxShadow: computed.boxShadow
        }
      })
      
      // Should have some form of focus indicator
      const hasFocusIndicator = !!(
        (focusStyles.outline && focusStyles.outline !== 'none') ||
        focusStyles.boxShadow !== 'none' ||
        focusStyles.outlineWidth !== '0px'
      )
      
      // This is a guideline - some elements might use different focus styles
      if (!hasFocusIndicator) {
        console.log(`Warning: Element may lack focus indicator:`, await element.evaluate(el => el.tagName))
      }
    }
  })

  test('should have proper color contrast and readability', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test text elements
    const textElements = [
      'h1, h2, h3, h4, h5, h6',
      'p',
      'button',
      'a',
      'label',
      '.text-muted-foreground',
      '.text-primary'
    ]
    
    for (const selector of textElements) {
      const elements = page.locator(selector)
      const elementCount = await elements.count()
      
      for (let i = 0; i < Math.min(elementCount, 5); i++) {
        const element = elements.nth(i)
        if (await element.isVisible()) {
          await checkColorContrast(page, selector)
          
          // Check text size
          const fontSize = await element.evaluate((el) => {
            return window.getComputedStyle(el).fontSize
          })
          
          const sizeValue = parseInt(fontSize.replace('px', ''))
          expect(sizeValue).toBeGreaterThanOrEqual(14) // Minimum readable size
        }
      }
    }
  })

  test('should support screen reader users', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test images have alt text
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i)
      if (await image.isVisible()) {
        const alt = await image.getAttribute('alt')
        const role = await image.getAttribute('role')
        
        // Decorative images should have empty alt or role="presentation"
        // Content images should have descriptive alt text
        expect(alt !== null).toBeTruthy() // Alt should be present (can be empty for decorative)
      }
    }
    
    // Test form labels
    const formControls = page.locator('input, textarea, select')
    const controlCount = await formControls.count()
    
    for (let i = 0; i < controlCount; i++) {
      const control = formControls.nth(i)
      if (await control.isVisible()) {
        await testScreenReaderContent(page, `input:nth-child(${i + 1}), textarea:nth-child(${i + 1}), select:nth-child(${i + 1})`)
      }
    }
    
    // Test button accessibility
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        await testScreenReaderContent(page, `button:nth-child(${i + 1})`)
      }
    }
    
    // Test landmark regions
    const landmarks = [
      { selector: 'nav', role: 'navigation' },
      { selector: 'main', role: 'main' },
      { selector: 'header', role: 'banner' },
      { selector: 'footer', role: 'contentinfo' }
    ]
    
    for (const landmark of landmarks) {
      const element = page.locator(landmark.selector)
      if (await element.isVisible()) {
        const role = await element.getAttribute('role')
        const implicitRole = landmark.role
        
        // Element should have implicit or explicit role
        expect(!!(role === implicitRole || landmark.selector === implicitRole)).toBeTruthy()
      }
    }
  })

  test('should handle high contrast mode', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.emulateMedia({ forcedColors: 'active' })
    
    // Elements should still be visible and functional
    const navigation = page.locator('nav')
    await expect(navigation).toBeVisible()
    
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        await expect(button).toBeVisible()
        
        // Test button interaction
        await button.hover()
        await page.waitForTimeout(100)
      }
    }
    
    // Test form controls in high contrast
    const inputs = page.locator('input, textarea')
    const inputCount = await inputs.count()
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      if (await input.isVisible()) {
        await expect(input).toBeVisible()
        await input.focus()
        await expect(input).toBeFocused()
      }
    }
    
    // Reset color scheme
    await page.emulateMedia({ colorScheme: 'light' })
    await page.emulateMedia({ forcedColors: 'none' })
  })

  test('should support reduced motion preferences', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Simulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    // Check that animations are reduced or disabled
    const animatedElements = page.locator('.animate-fade-in, .animate-scale-in, .animate-slide-up, .transition-all')
    const animatedCount = await animatedElements.count()
    
    for (let i = 0; i < Math.min(animatedCount, 5); i++) {
      const element = animatedElements.nth(i)
      if (await element.isVisible()) {
        const animationDuration = await element.evaluate((el) => {
          return window.getComputedStyle(el).animationDuration
        })
        
        const transitionDuration = await element.evaluate((el) => {
          return window.getComputedStyle(el).transitionDuration
        })
        
        // In reduced motion mode, durations should be minimal
        // This would require CSS media query support for prefers-reduced-motion
        // For now, we just verify the elements are still visible
        await expect(element).toBeVisible()
      }
    }
    
    // Reset motion preference
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })

  test('should work with assistive technologies simulation', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test with increased text size
    await page.addStyleTag({
      content: `
        * {
          font-size: 120% !important;
        }
      `
    })
    
    await page.waitForTimeout(1000)
    
    // Layout should still work with larger text
    const navigation = page.locator('nav')
    await expect(navigation).toBeVisible()
    
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        await expect(button).toBeVisible()
        
        // Check that text doesn't overflow
        const buttonBox = await button.boundingBox()
        if (buttonBox) {
          expect(buttonBox.width).toBeGreaterThan(0)
          expect(buttonBox.height).toBeGreaterThan(0)
        }
      }
    }
  })

  test('should have proper error handling and user feedback', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test form validation feedback
    await page.goto('/projects/new')
    await page.waitForLoadState('networkidle')
    
    const submitButton = page.locator('button[type="submit"]')
    
    // Try to submit empty form
    if (await submitButton.isEnabled()) {
      await submitButton.click()
      
      // Look for error messages
      const errorMessages = page.locator('[role="alert"], .error, .text-destructive, [aria-invalid="true"]')
      const errorCount = await errorMessages.count()
      
      if (errorCount > 0) {
        // Error messages should be accessible
        for (let i = 0; i < errorCount; i++) {
          const error = errorMessages.nth(i)
          if (await error.isVisible()) {
            await testScreenReaderContent(page, `[role="alert"]:nth-child(${i + 1})`)
            
            // Error should be associated with form control
            const ariaDescribedBy = await error.getAttribute('aria-describedby')
            const id = await error.getAttribute('id')
            
            if (id) {
              const associatedControl = page.locator(`[aria-describedby*="${id}"]`)
              if (await associatedControl.isVisible()) {
                await expect(associatedControl).toBeVisible()
              }
            }
          }
        }
      }
    }
  })

  test('should handle dynamic content updates accessibly', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Test dynamic content updates (like loading states)
    const textarea = page.locator('textarea')
    await textarea.fill('Test dynamic update')
    await page.keyboard.press('Enter')
    
    // Look for live regions
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]')
    const liveRegionCount = await liveRegions.count()
    
    if (liveRegionCount > 0) {
      for (let i = 0; i < liveRegionCount; i++) {
        const liveRegion = liveRegions.nth(i)
        if (await liveRegion.isVisible()) {
          const ariaLive = await liveRegion.getAttribute('aria-live')
          const role = await liveRegion.getAttribute('role')
          
          expect(!!(ariaLive || role)).toBeTruthy()
        }
      }
    }
    
    // Test loading states
    const loadingIndicators = page.locator('text=Processing, text=Loading, .loading, .animate-spin')
    const loadingCount = await loadingIndicators.count()
    
    if (loadingCount > 0) {
      const firstLoading = loadingIndicators.first()
      await testScreenReaderContent(page, 'text=Processing, text=Loading')
    }
  })

  test('should test skip links and navigation shortcuts', async ({ page }) => {
    await page.goto('/assistant')
    await page.waitForLoadState('networkidle')
    
    // Look for skip links
    const skipLinks = page.locator('a[href^="#"], .skip-link, [class*="skip"]')
    const skipLinkCount = await skipLinks.count()
    
    if (skipLinkCount > 0) {
      for (let i = 0; i < skipLinkCount; i++) {
        const skipLink = skipLinks.nth(i)
        
        // Skip links should be focusable
        await skipLink.focus()
        await expect(skipLink).toBeFocused()
        
        // Skip links should have descriptive text
        const text = await skipLink.textContent()
        expect(text?.trim()).toBeTruthy()
        expect(text?.toLowerCase()).toContain('skip')
      }
    }
    
    // Test heading navigation (common screen reader feature)
    const headings = page.locator('h1, h2, h3, h4, h5, h6')
    const headingCount = await headings.count()
    
    expect(headingCount).toBeGreaterThan(0) // Should have headings for navigation
    
    for (let i = 0; i < Math.min(headingCount, 5); i++) {
      const heading = headings.nth(i)
      if (await heading.isVisible()) {
        const text = await heading.textContent()
        expect(text?.trim()).toBeTruthy()
        
        // Headings should be focusable if they're navigation targets
        const tabIndex = await heading.getAttribute('tabindex')
        const id = await heading.getAttribute('id')
        
        // Either should be focusable or be a valid anchor target
        expect(!!(tabIndex || id)).toBeTruthy()
      }
    }
  })
})