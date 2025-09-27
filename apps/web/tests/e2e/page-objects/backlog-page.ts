import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base-page'

export class BacklogPage extends BasePage {
  readonly addStoryButton: Locator
  readonly storiesList: Locator
  readonly storyCards: Locator
  readonly filterDropdown: Locator
  readonly sortDropdown: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    super(page)
    this.addStoryButton = page.locator('button:has-text("Add Story"), button:has-text("New Story"), a:has-text("New Story")')
    this.storiesList = page.locator('[data-testid="stories-list"]')
    this.storyCards = page.locator('[data-testid="story-card"]')
    this.filterDropdown = page.locator('button:has-text("Filter")')
    this.sortDropdown = page.locator('button:has-text("Sort")')
    this.searchInput = page.locator('input[placeholder*="Search"]')
  }

  async gotoBacklog(projectId: string) {
    await this.goto(`/projects/${projectId}/backlog`)
    await this.waitForLoad()
  }

  async createStory(title: string, description: string, acceptanceCriteria: string[] = []) {
    await this.addStoryButton.click()

    // Fill story form
    const titleInput = this.page.locator('input[name="title"], input[placeholder*="title"]')
    await titleInput.fill(title)

    const descInput = this.page.locator('textarea[name="description"], textarea[placeholder*="description"]')
    await descInput.fill(description)

    // Add acceptance criteria if provided
    for (const criterion of acceptanceCriteria) {
      await this.addAcceptanceCriterion(criterion)
    }

    // Submit form
    const submitButton = this.page.locator('button:has-text("Create"), button:has-text("Save"), button[type="submit"]')
    await submitButton.click()

    await this.expectToastMessage('Story created successfully')
    return this.getStoryIdFromUrl()
  }

  async addAcceptanceCriterion(criterion: string) {
    const addCriterionButton = this.page.locator('button:has-text("Add Criterion")')
    if (await addCriterionButton.isVisible({ timeout: 2000 })) {
      await addCriterionButton.click()
    }

    const criterionInput = this.page.locator('textarea[placeholder*="criterion"], input[placeholder*="criterion"]').last()
    await criterionInput.fill(criterion)
  }

  async openStory(storyTitle: string) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    await storyCard.click()
    await this.page.waitForURL(/.*\/backlog\/.*/, { timeout: 10000 })
  }

  async updateStoryStatus(storyTitle: string, status: 'backlog' | 'ready' | 'in-progress' | 'review' | 'done') {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    const statusDropdown = storyCard.locator('[data-testid="status-dropdown"]')

    await statusDropdown.click()
    await this.page.locator(`button:has-text("${status}")`).click()

    await this.expectToastMessage('Story status updated')
  }

  async updateStoryPriority(storyTitle: string, priority: 'low' | 'medium' | 'high' | 'critical') {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    const priorityDropdown = storyCard.locator('[data-testid="priority-dropdown"]')

    await priorityDropdown.click()
    await this.page.locator(`button:has-text("${priority}")`).click()

    await this.expectToastMessage('Story priority updated')
  }

  async estimateStory(storyTitle: string, points: number) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    const estimateButton = storyCard.locator('[data-testid="estimate-button"]')

    await estimateButton.click()
    await this.page.locator(`button:has-text("${points}")`).click()

    await this.expectToastMessage('Story estimated')
  }

  async deleteStory(storyTitle: string) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    const deleteButton = storyCard.locator('button[title="Delete"], button:has-text("Delete")')

    await deleteButton.click()

    // Confirm deletion
    const confirmButton = this.page.locator('button:has-text("Delete"):visible')
    await confirmButton.click()

    await this.expectToastMessage('Story deleted successfully')
  }

  async filterByStatus(status: string) {
    await this.filterDropdown.click()
    await this.page.locator(`button:has-text("${status}")`).click()
    await this.page.waitForTimeout(500) // Wait for filter to apply
  }

  async sortBy(criteria: 'priority' | 'status' | 'created' | 'updated') {
    await this.sortDropdown.click()
    await this.page.locator(`button:has-text("${criteria}")`).click()
    await this.page.waitForTimeout(500) // Wait for sort to apply
  }

  async searchStories(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500) // Debounce
  }

  async expectStoryExists(storyTitle: string) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    await expect(storyCard).toBeVisible({ timeout: 10000 })
  }

  async expectStoryNotExists(storyTitle: string) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    await expect(storyCard).toHaveCount(0)
  }

  async expectStoryStatus(storyTitle: string, status: string) {
    const storyCard = this.page.locator(`[data-testid="story-card"]:has-text("${storyTitle}")`)
    const statusIndicator = storyCard.locator(`[data-testid="story-status"]:has-text("${status}")`)
    await expect(statusIndicator).toBeVisible()
  }

  async expectEmptyBacklog() {
    const emptyState = this.page.locator('[data-testid="empty-backlog"]')
    await expect(emptyState).toBeVisible()
  }

  async getStoryIdFromUrl(): Promise<string> {
    const url = this.page.url()
    const match = url.match(/\/backlog\/([^\/]+)/)
    return match ? match[1] : ''
  }

  async expectStoriesLoaded() {
    // Wait for either stories list or empty state
    await Promise.race([
      this.storiesList.waitFor({ state: 'visible' }),
      this.page.locator('[data-testid="empty-backlog"]').waitFor({ state: 'visible' })
    ])
  }
}

export class StoryDetailPage extends BasePage {
  readonly storyTitle: Locator
  readonly storyDescription: Locator
  readonly acceptanceCriteria: Locator
  readonly tasksList: Locator
  readonly addTaskButton: Locator
  readonly editButton: Locator
  readonly statusDropdown: Locator

  constructor(page: Page) {
    super(page)
    this.storyTitle = page.locator('[data-testid="story-title"]')
    this.storyDescription = page.locator('[data-testid="story-description"]')
    this.acceptanceCriteria = page.locator('[data-testid="acceptance-criteria"]')
    this.tasksList = page.locator('[data-testid="tasks-list"]')
    this.addTaskButton = page.locator('button:has-text("Add Task")')
    this.editButton = page.locator('button:has-text("Edit")')
    this.statusDropdown = page.locator('[data-testid="story-status-dropdown"]')
  }

  async gotoStory(projectId: string, storyId: string) {
    await this.goto(`/projects/${projectId}/backlog/${storyId}`)
    await this.waitForLoad()
  }

  async addTask(title: string, description: string = '') {
    await this.addTaskButton.click()

    const titleInput = this.page.locator('input[name="title"], input[placeholder*="task title"]')
    await titleInput.fill(title)

    if (description) {
      const descInput = this.page.locator('textarea[name="description"], textarea[placeholder*="description"]')
      await descInput.fill(description)
    }

    const submitButton = this.page.locator('button:has-text("Create"), button:has-text("Add")')
    await submitButton.click()

    await this.expectToastMessage('Task added successfully')
  }

  async updateTask(taskTitle: string, newTitle: string, newDescription: string = '') {
    const taskItem = this.page.locator(`[data-testid="task-item"]:has-text("${taskTitle}")`)
    const editButton = taskItem.locator('button:has-text("Edit")')

    await editButton.click()

    const titleInput = this.page.locator('input[name="title"]')
    await titleInput.fill(newTitle)

    if (newDescription) {
      const descInput = this.page.locator('textarea[name="description"]')
      await descInput.fill(newDescription)
    }

    const saveButton = this.page.locator('button:has-text("Save")')
    await saveButton.click()

    await this.expectToastMessage('Task updated successfully')
  }

  async completeTask(taskTitle: string) {
    const taskItem = this.page.locator(`[data-testid="task-item"]:has-text("${taskTitle}")`)
    const checkbox = taskItem.locator('input[type="checkbox"]')

    await checkbox.check()
    await this.expectToastMessage('Task completed')
  }

  async expectStoryLoaded(storyTitle: string) {
    await expect(this.storyTitle).toContainText(storyTitle)
  }

  async expectTaskExists(taskTitle: string) {
    const taskItem = this.page.locator(`[data-testid="task-item"]:has-text("${taskTitle}")`)
    await expect(taskItem).toBeVisible()
  }

  async expectAcceptanceCriteriaCount(count: number) {
    const criteria = this.acceptanceCriteria.locator('[data-testid="criterion-item"]')
    await expect(criteria).toHaveCount(count)
  }
}