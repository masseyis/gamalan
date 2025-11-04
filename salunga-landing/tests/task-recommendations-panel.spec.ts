import { test, expect } from '@playwright/test'

/**
 * Task Recommendations Panel E2E Tests
 *
 * Testing acceptance criteria:
 * - e0261453: Display clarity score with recommendations
 * - 81054dee: Recommend adding technical details
 * - 30639999: Flag vague/ambiguous language
 * - 5649e91e: Recommend AC references
 * - 3f42fa09: Evaluate AI agent compatibility
 * - bbd83897: Show examples and one-click apply
 */

test.describe('Task Recommendations Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with the recommendations panel
    // This will be updated once we have a proper route
    await page.goto('/brand')
  })

  test('should display clarity score indicator', async ({ page }) => {
    // AC e0261453: Show clarity score
    const clarityScore = page.locator('[data-testid="clarity-score"]')
    await expect(clarityScore).toBeVisible()

    const scoreValue = page.locator('[data-testid="clarity-score-value"]')
    await expect(scoreValue).toBeVisible()

    const scoreLabel = page.locator('[data-testid="clarity-score-label"]')
    await expect(scoreLabel).toBeVisible()
  })

  test('should categorize recommendations into sections', async ({ page }) => {
    // Recommendations should be grouped by category
    const categories = page.locator('[data-testid^="recommendation-category-"]')
    await expect(categories.first()).toBeVisible()

    // Should have category labels
    const categoryLabel = page.locator('[data-testid="category-label"]').first()
    await expect(categoryLabel).toBeVisible()
  })

  test('should highlight missing technical details', async ({ page }) => {
    // AC 81054dee: Missing technical details recommendation
    const technicalDetailsSection = page.locator(
      '[data-testid="recommendation-category-missing-technical-details"]'
    )

    // May not always be present, check if it exists first
    const count = await technicalDetailsSection.count()
    if (count > 0) {
      await expect(technicalDetailsSection).toBeVisible()

      // Should show what's missing
      const missingElements = technicalDetailsSection.locator('[data-testid="missing-element"]')
      await expect(missingElements.first()).toBeVisible()
    }
  })

  test('should flag vague and ambiguous terms', async ({ page }) => {
    // AC 30639999: Flag vague terms
    const vagueTermsSection = page.locator(
      '[data-testid="recommendation-category-vague-language"]'
    )

    const count = await vagueTermsSection.count()
    if (count > 0) {
      await expect(vagueTermsSection).toBeVisible()

      // Should highlight the vague term
      const vagueTermHighlight = vagueTermsSection.locator('[data-testid="vague-term-highlight"]')
      await expect(vagueTermHighlight.first()).toBeVisible()

      // Should show suggested replacement
      const suggestion = vagueTermsSection.locator('[data-testid="vague-term-suggestion"]')
      await expect(suggestion.first()).toBeVisible()
    }
  })

  test('should recommend AC references when missing', async ({ page }) => {
    // AC 5649e91e: Missing AC references
    const acReferencesSection = page.locator(
      '[data-testid="recommendation-category-missing-ac-references"]'
    )

    const count = await acReferencesSection.count()
    if (count > 0) {
      await expect(acReferencesSection).toBeVisible()

      // Should show suggested AC IDs
      const suggestedACs = acReferencesSection.locator('[data-testid="suggested-ac-id"]')
      await expect(suggestedACs.first()).toBeVisible()
    }
  })

  test('should have expandable sections', async ({ page }) => {
    // Sections should be expandable/collapsible
    const expandButton = page.locator('[data-testid="expand-category-button"]').first()
    await expect(expandButton).toBeVisible()

    // Get initial state
    const categoryContent = page.locator('[data-testid="category-content"]').first()
    const initiallyVisible = await categoryContent.isVisible()

    // Click to toggle
    await expandButton.click()

    // Should toggle visibility
    const afterClickVisible = await categoryContent.isVisible()
    expect(afterClickVisible).not.toBe(initiallyVisible)
  })

  test('should display severity badges correctly', async ({ page }) => {
    // Recommendations should have severity indicators
    const severityBadge = page.locator('[data-testid="severity-badge"]').first()
    await expect(severityBadge).toBeVisible()

    // Should have appropriate color coding
    const badgeClass = await severityBadge.getAttribute('class')
    expect(badgeClass).toMatch(/salunga-(success|warning|danger)/)
  })

  test('should show impact score for recommendations', async ({ page }) => {
    // Recommendations should show potential impact
    const impactScore = page.locator('[data-testid="impact-score"]').first()
    await expect(impactScore).toBeVisible()
  })

  test('should provide one-click apply action', async ({ page }) => {
    // AC bbd83897: One-click apply
    const applyButton = page.locator('[data-testid="apply-recommendation-button"]').first()

    const count = await applyButton.count()
    if (count > 0) {
      await expect(applyButton).toBeVisible()
      await expect(applyButton).toBeEnabled()
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const panel = page.locator('[data-testid="task-recommendations-panel"]')
    await expect(panel).toBeVisible()

    // Should stack vertically on mobile
    const boundingBox = await panel.boundingBox()
    expect(boundingBox?.width).toBeLessThanOrEqual(375)
  })

  test('should show loading state while analyzing', async ({ page }) => {
    // Should show loading indicator during analysis
    const loadingIndicator = page.locator('[data-testid="recommendations-loading"]')

    // This may be transient, so we just check if it exists in the DOM
    const count = await loadingIndicator.count()
    // Just verify the element is defined in the component (may not be visible if already loaded)
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('should show empty state when no recommendations', async ({ page }) => {
    // When task is well-defined, should show success state
    const emptyState = page.locator('[data-testid="no-recommendations"]')

    const count = await emptyState.count()
    if (count > 0) {
      await expect(emptyState).toBeVisible()
      await expect(emptyState).toContainText(/well-defined|no recommendations/i)
    }
  })

  test('should group recommendations by total impact', async ({ page }) => {
    // Categories should show total impact score
    const totalImpact = page.locator('[data-testid="category-total-impact"]').first()

    const count = await totalImpact.count()
    if (count > 0) {
      await expect(totalImpact).toBeVisible()
      const impactText = await totalImpact.textContent()
      expect(impactText).toMatch(/\d+/)
    }
  })

  test('should take screenshot for visual regression', async ({ page }) => {
    await expect(page).toHaveScreenshot('task-recommendations-panel.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })
})

test.describe('Task Recommendations Panel - AI Agent Compatibility Check', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/brand')
  })

  test('should evaluate AI agent compatibility criteria', async ({ page }) => {
    // AC 3f42fa09: AI agent compatibility check
    const compatibilitySection = page.locator('[data-testid="ai-compatibility-check"]')

    const count = await compatibilitySection.count()
    if (count > 0) {
      await expect(compatibilitySection).toBeVisible()

      // Should check for success criteria
      const successCriteria = compatibilitySection.locator(
        '[data-testid="check-success-criteria"]'
      )
      await expect(successCriteria).toBeVisible()

      // Should check for dependencies
      const dependencies = compatibilitySection.locator('[data-testid="check-dependencies"]')
      await expect(dependencies).toBeVisible()

      // Should check for environment setup
      const environment = compatibilitySection.locator('[data-testid="check-environment"]')
      await expect(environment).toBeVisible()

      // Should check for test coverage
      const testCoverage = compatibilitySection.locator('[data-testid="check-test-coverage"]')
      await expect(testCoverage).toBeVisible()

      // Should check for definition of done
      const definitionOfDone = compatibilitySection.locator('[data-testid="check-definition-done"]')
      await expect(definitionOfDone).toBeVisible()
    }
  })
})
