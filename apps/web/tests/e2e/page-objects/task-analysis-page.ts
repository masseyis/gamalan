import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base-page'
import {
  TaskReadinessAnalysis,
  Recommendation,
  RecommendationCategory,
} from '../../../lib/types/task-readiness'

/**
 * Page object for task analysis and recommendations functionality
 * Handles interactions with the task readiness analysis panel
 */
export class TaskAnalysisPage extends BasePage {
  // Main panel locators
  readonly analysisPanel: Locator
  readonly clarityScoreDisplay: Locator
  readonly clarityScoreLevel: Locator
  readonly analyzeButton: Locator
  readonly enrichButton: Locator

  // Category section locators
  readonly technicalDetailsSection: Locator
  readonly vagueTermsSection: Locator
  readonly acceptanceCriteriaSection: Locator
  readonly aiCompatibilitySection: Locator
  readonly examplesSection: Locator

  // Action buttons
  readonly applyRecommendationButtons: Locator

  constructor(page: Page) {
    super(page)
    this.analysisPanel = page.locator('text=Task Readiness Analysis').locator('..')
    this.clarityScoreDisplay = page.locator('text=Clarity Score').locator('..')
    this.clarityScoreLevel = this.clarityScoreDisplay.locator('text=/excellent|good|fair|poor/i')
    this.analyzeButton = page.locator('button:has-text("Analyze Task")')
    this.enrichButton = page.locator('button:has-text("Enrich Task")')

    // Category sections by title text
    this.technicalDetailsSection = page.locator('text=Technical Details').locator('..')
    this.vagueTermsSection = page.locator('text=Vague Terms').locator('..')
    this.acceptanceCriteriaSection = page.locator('text=Acceptance Criteria').locator('..')
    this.aiCompatibilitySection = page.locator('text=AI Agent Compatibility').locator('..')
    this.examplesSection = page.locator('text=Well-Defined Examples').locator('..')

    this.applyRecommendationButtons = page.locator(
      'button:has-text("Apply"), button:has-text("View Details")'
    )
  }

  /**
   * Navigate to a task detail page where analysis can be triggered
   */
  async gotoTask(projectId: string, storyId: string, taskId?: string) {
    if (taskId) {
      await this.goto(`/projects/${projectId}/backlog/${storyId}/tasks/${taskId}`)
    } else {
      await this.goto(`/projects/${projectId}/backlog/${storyId}`)
    }
    await this.waitForLoad()
  }

  /**
   * Trigger task analysis
   */
  async analyzeTask() {
    await this.analyzeButton.click()
    await this.expectToastMessage(/Analysis complete|Analyzing task/)
    // Wait for analysis panel to appear
    await this.analysisPanel.waitFor({ state: 'visible', timeout: 10000 })
  }

  /**
   * Get the clarity score displayed
   */
  async getClarityScore(): Promise<number> {
    const scoreText = await this.clarityScoreDisplay
      .locator('text=/\\d+/i')
      .first()
      .textContent()
    return parseInt(scoreText || '0', 10)
  }

  /**
   * Get the clarity level (poor/fair/good/excellent)
   */
  async getClarityLevel(): Promise<string> {
    const levelText = await this.clarityScoreLevel.textContent()
    return (levelText || '').toLowerCase().trim()
  }

  /**
   * Expand a category section to view recommendations
   */
  async expandCategory(category: RecommendationCategory) {
    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    if (!section) {
      throw new Error(`Unknown category: ${category}`)
    }

    // Check if section is collapsed (ChevronRight icon visible)
    const chevronRight = section.locator('svg').first()
    const isCollapsed = await chevronRight.isVisible({ timeout: 2000 }).catch(() => false)

    if (isCollapsed) {
      // Click to expand
      await section.click()
      // Wait for expansion animation
      await this.page.waitForTimeout(300)
    }
  }

  /**
   * Get count of items in a category section badge
   */
  async getCategoryItemCount(category: RecommendationCategory): Promise<number> {
    await this.expandCategory(category)

    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    const badge = section.locator('[class*="badge"]').first()
    const countText = await badge.textContent()
    return parseInt(countText || '0', 10)
  }

  /**
   * Get all recommendations for a specific category
   */
  async getCategoryRecommendations(category: RecommendationCategory): Promise<string[]> {
    await this.expandCategory(category)

    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    const recommendations = section.locator('[class*="rounded-md"][class*="p-3"]')
    const count = await recommendations.count()

    const results: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await recommendations.nth(i).textContent()
      if (text) {
        results.push(text.trim())
      }
    }

    return results
  }

  /**
   * Check if a specific recommendation exists
   */
  async expectRecommendationExists(category: RecommendationCategory, text: string | RegExp) {
    await this.expandCategory(category)

    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    const recommendation =
      typeof text === 'string'
        ? section.locator(`text=${text}`).first()
        : section.locator('*').filter({ hasText: text }).first()
    await expect(recommendation).toBeVisible({ timeout: 5000 })
  }

  /**
   * Apply a recommendation by clicking its action button
   */
  async applyRecommendation(recommendationText: string) {
    const recommendation = this.page.locator(`text=${recommendationText}`).locator('..')
    const applyButton = recommendation.locator('button:has-text("Apply"), button:has-text("View")')
    await applyButton.click()
    await this.expectToastMessage(/Applied|Updated/)
  }

  /**
   * Trigger AI-assisted task enrichment
   */
  async enrichTask() {
    await this.enrichButton.click()
    await this.expectToastMessage(/Enriching task|Enhancement suggested/)
    // Wait for enrichment suggestions to appear
    await this.page.waitForTimeout(2000)
  }

  /**
   * Verify vague terms are flagged
   */
  async expectVagueTermFlagged(term: string) {
    await this.expandCategory('vague-terms')
    const vagueTermItem = this.vagueTermsSection.locator(`code:has-text("${term}")`)
    await expect(vagueTermItem).toBeVisible()
  }

  /**
   * Verify a specific missing element is shown
   */
  async expectMissingElement(category: RecommendationCategory, description: string | RegExp) {
    await this.expandCategory(category)

    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    const element =
      typeof description === 'string'
        ? section.locator(`text=${description}`)
        : section.locator('*').filter({ hasText: description })
    await expect(element).toBeVisible()
  }

  /**
   * Verify AI compatibility issues are displayed
   */
  async expectAICompatibilityIssue(issueText: string | RegExp) {
    await this.expandCategory('ai-compatibility')
    const issue =
      typeof issueText === 'string'
        ? this.aiCompatibilitySection.locator(`text=${issueText}`)
        : this.aiCompatibilitySection.locator('*').filter({ hasText: issueText })
    await expect(issue).toBeVisible()
  }

  /**
   * Verify examples are shown
   */
  async expectExampleShown(exampleTitle: string) {
    await this.expandCategory('examples')
    const example = this.examplesSection.locator(`text=${exampleTitle}`)
    await expect(example).toBeVisible()
  }

  /**
   * Verify priority badge exists for a recommendation
   */
  async expectPriorityBadge(
    category: RecommendationCategory,
    priority: 'critical' | 'high' | 'medium' | 'low'
  ) {
    await this.expandCategory(category)

    const categoryMap: Record<RecommendationCategory, Locator> = {
      'technical-details': this.technicalDetailsSection,
      'vague-terms': this.vagueTermsSection,
      'acceptance-criteria': this.acceptanceCriteriaSection,
      'ai-compatibility': this.aiCompatibilitySection,
      examples: this.examplesSection,
    }

    const section = categoryMap[category]
    const badge = section.locator(`text=/${priority}/i`)
    await expect(badge).toBeVisible()
  }

  /**
   * Verify clarity score is within expected range
   */
  async expectClarityScore(min: number, max: number) {
    const score = await this.getClarityScore()
    expect(score).toBeGreaterThanOrEqual(min)
    expect(score).toBeLessThanOrEqual(max)
  }

  /**
   * Verify clarity level matches expected value
   */
  async expectClarityLevel(level: 'poor' | 'fair' | 'good' | 'excellent') {
    const actualLevel = await this.getClarityLevel()
    expect(actualLevel).toBe(level)
  }

  /**
   * Verify analysis panel is visible
   */
  async expectAnalysisPanelVisible() {
    await expect(this.analysisPanel).toBeVisible({ timeout: 10000 })
  }

  /**
   * Verify no recommendations message for well-defined tasks
   */
  async expectNoRecommendations() {
    const noRecsMessage = this.page.locator('text=No recommendations')
    await expect(noRecsMessage).toBeVisible()
    const wellDefinedMessage = this.page.locator('text=well-defined and ready')
    await expect(wellDefinedMessage).toBeVisible()
  }

  /**
   * Count total recommendations across all categories
   */
  async getTotalRecommendationCount(): Promise<number> {
    let total = 0
    const categories: RecommendationCategory[] = [
      'technical-details',
      'vague-terms',
      'acceptance-criteria',
      'ai-compatibility',
      'examples',
    ]

    for (const category of categories) {
      try {
        const count = await this.getCategoryItemCount(category)
        total += count
      } catch {
        // Category might not exist, skip
      }
    }

    return total
  }
}
