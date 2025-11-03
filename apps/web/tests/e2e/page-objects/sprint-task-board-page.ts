import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base-page'

export class SprintTaskBoardPage extends BasePage {
  readonly pageHeading: Locator
  readonly backToSprintsLink: Locator
  readonly sprintTaskBoard: Locator
  readonly connectionIndicator: Locator

  // Sprint Header elements
  readonly sprintHeader: Locator
  readonly sprintName: Locator
  readonly sprintDates: Locator
  readonly daysRemaining: Locator
  readonly totalStories: Locator
  readonly totalTasks: Locator
  readonly completedTasks: Locator
  readonly myTasks: Locator
  readonly progressPercentage: Locator
  readonly progressBar: Locator

  // Filter and Group elements
  readonly statusFilter: Locator
  readonly groupBySelect: Locator
  readonly taskCountDisplay: Locator

  // Task elements
  readonly taskCards: Locator
  readonly availableTaskBadge: Locator
  readonly myTaskBadge: Locator
  readonly storyGroups: Locator
  readonly statusGroups: Locator

  // Real-time update toast
  readonly toast: Locator

  constructor(page: Page) {
    super(page)
    this.pageHeading = page.locator('h1:has-text("Sprint Task Board")')
    this.backToSprintsLink = page.locator('a:has-text("Back to Sprints")')
    this.sprintTaskBoard = page.locator('[data-testid="sprint-task-board"]')
    this.connectionIndicator = page.locator('[data-testid="connection-indicator"]')

    // Sprint Header
    this.sprintHeader = page.locator('[data-testid="sprint-header"]')
    this.sprintName = this.sprintHeader.locator('[data-testid="sprint-name"]')
    this.sprintDates = this.sprintHeader.locator('[data-testid="sprint-dates"]')
    this.daysRemaining = this.sprintHeader.locator('[data-testid="days-remaining"]')
    this.totalStories = this.sprintHeader.locator('[data-testid="total-stories"]')
    this.totalTasks = this.sprintHeader.locator('[data-testid="total-tasks"]')
    this.completedTasks = this.sprintHeader.locator('[data-testid="completed-tasks"]')
    this.myTasks = this.sprintHeader.locator('[data-testid="my-tasks"]')
    this.progressPercentage = this.sprintHeader.locator('[data-testid="progress-percentage"]')
    this.progressBar = this.sprintHeader.locator('[data-testid="progress-bar"]')

    // Filters
    this.statusFilter = page.locator('[data-testid="status-filter"]')
    this.groupBySelect = page.locator('[data-testid="group-by-select"]')
    this.taskCountDisplay = page.locator('[data-testid="task-count"]')

    // Tasks
    this.taskCards = page.locator('[data-testid="task-card"]')
    this.availableTaskBadge = page.locator('[data-testid="available-badge"]')
    this.myTaskBadge = page.locator('[data-testid="my-task-badge"]')
    this.storyGroups = page.locator('[data-testid="story-group"]')
    this.statusGroups = page.locator('[data-testid="status-group"]')

    // Toasts
    this.toast = page.locator('[role="alert"]')
  }

  async gotoSprintTaskBoard(projectId: string, sprintId: string) {
    await this.goto(`/projects/${projectId}/sprints/${sprintId}/tasks`)
    await this.waitForLoad()
  }

  async expectSprintTaskBoardLoaded() {
    await expect(this.pageHeading).toBeVisible({ timeout: 10000 })
    await expect(this.sprintTaskBoard).toBeVisible({ timeout: 10000 })
  }

  async expectConnectionIndicatorConnected() {
    const indicator = this.connectionIndicator
    await expect(indicator).toHaveClass(/bg-green-500/, { timeout: 5000 })
    const statusText = this.page.locator('text=Connected to real-time updates')
    await expect(statusText).toBeVisible()
  }

  async expectSprintHeaderDisplayed(sprintName: string) {
    await expect(this.sprintName).toContainText(sprintName)
    await expect(this.sprintDates).toBeVisible()
    await expect(this.daysRemaining).toBeVisible()
  }

  async expectSprintMetrics(expectedMetrics: {
    stories?: number
    totalTasks?: number
    completedTasks?: number
    myTasks?: number
  }) {
    if (expectedMetrics.stories !== undefined) {
      const storiesText = await this.totalStories.textContent()
      expect(storiesText).toContain(expectedMetrics.stories.toString())
    }

    if (expectedMetrics.totalTasks !== undefined) {
      const tasksText = await this.totalTasks.textContent()
      expect(tasksText).toContain(expectedMetrics.totalTasks.toString())
    }

    if (expectedMetrics.completedTasks !== undefined) {
      const completedText = await this.completedTasks.textContent()
      expect(completedText).toContain(expectedMetrics.completedTasks.toString())
    }

    if (expectedMetrics.myTasks !== undefined) {
      const myTasksText = await this.myTasks.textContent()
      expect(myTasksText).toContain(expectedMetrics.myTasks.toString())
    }
  }

  async expectProgressPercentage(percentage: number) {
    const progressText = await this.progressPercentage.textContent()
    expect(progressText).toContain(`${percentage}%`)
  }

  async expectTaskDisplayed(taskTitle: string) {
    const task = this.taskCards.filter({ hasText: taskTitle })
    await expect(task).toBeVisible({ timeout: 5000 })
  }

  async expectTaskWithDetails(
    taskTitle: string,
    details: {
      taskId?: string
      status?: string
      parentStory?: string
      acRefs?: string[]
      owner?: string
    }
  ) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    await expect(taskCard).toBeVisible({ timeout: 5000 })

    if (details.taskId) {
      await expect(taskCard).toContainText(details.taskId)
    }

    if (details.status) {
      const statusBadge = taskCard.locator(`text=${details.status}`)
      await expect(statusBadge).toBeVisible()
    }

    if (details.parentStory) {
      await expect(taskCard).toContainText(details.parentStory)
    }

    if (details.acRefs && details.acRefs.length > 0) {
      const acRefsText = details.acRefs.join(', ')
      await expect(taskCard).toContainText(acRefsText)
    }

    if (details.owner) {
      await expect(taskCard).toContainText(details.owner)
    }
  }

  async expectAvailableTaskBadge(taskTitle: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const badge = taskCard.locator('[data-testid="available-badge"]')
    await expect(badge).toBeVisible()
  }

  async expectMyTaskBadge(taskTitle: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const badge = taskCard.locator('[data-testid="my-task-badge"]')
    await expect(badge).toBeVisible()
  }

  async expectOwnerDisplayed(taskTitle: string, ownerName: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const ownerText = taskCard.locator(`text=/Owner:.*${ownerName}/i`)
    await expect(ownerText).toBeVisible()
  }

  async filterByStatus(status: 'Available' | 'Owned' | 'In Progress' | 'Completed') {
    await this.statusFilter.click()
    const option = this.page.locator(`[role="option"]:has-text("${status}")`)
    await option.click()
    await this.page.waitForTimeout(500) // Wait for filter to apply
  }

  async clearStatusFilter() {
    await this.statusFilter.click()
    const clearOption = this.page.locator('[role="option"]:has-text("All")')
    await clearOption.click()
    await this.page.waitForTimeout(500)
  }

  async groupBy(groupBy: 'story' | 'status') {
    await this.groupBySelect.click()
    const optionText = groupBy === 'story' ? 'By Story' : 'By Status'
    const option = this.page.locator(`[role="option"]:has-text("${optionText}")`)
    await option.click()
    await this.page.waitForTimeout(500) // Wait for grouping to apply
  }

  async expectTaskCount(count: number) {
    const countText = await this.taskCountDisplay.textContent()
    expect(countText).toContain(`${count}`)
  }

  async expectFilteredTaskCount(filteredCount: number, totalCount: number) {
    const countText = await this.taskCountDisplay.textContent()
    expect(countText).toContain(`${filteredCount} of ${totalCount}`)
  }

  async expectStoryGroupDisplayed(storyTitle: string, taskCount: number) {
    const storyGroup = this.storyGroups.filter({ hasText: storyTitle })
    await expect(storyGroup).toBeVisible()

    // Check task count badge
    const badge = storyGroup.locator('[data-testid="group-badge"]')
    const badgeText = await badge.textContent()
    expect(badgeText).toContain(taskCount.toString())
  }

  async expectStatusGroupDisplayed(status: string, taskCount: number) {
    const statusGroup = this.statusGroups.filter({ hasText: status })
    await expect(statusGroup).toBeVisible()

    // Check task count badge
    const badge = statusGroup.locator('[data-testid="group-badge"]')
    const badgeText = await badge.textContent()
    expect(badgeText).toContain(taskCount.toString())
  }

  async expectTaskNotDisplayed(taskTitle: string) {
    const task = this.taskCards.filter({ hasText: taskTitle })
    await expect(task).not.toBeVisible()
  }

  async takeTaskOwnership(taskTitle: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const claimButton = taskCard.locator('button:has-text("I\'m on it")')
    await claimButton.click()
    await this.page.waitForTimeout(1000) // Wait for ownership to be taken
  }

  async releaseTaskOwnership(taskTitle: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const releaseButton = taskCard.locator('button:has-text("Release")')
    await releaseButton.click()
    await this.page.waitForTimeout(1000)
  }

  async updateTaskStatus(taskTitle: string, status: string) {
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const statusSelect = taskCard.locator('[data-testid="task-status-select"]')
    await statusSelect.click()

    const option = this.page.locator(`[role="option"]:has-text("${status}")`)
    await option.click()
    await this.page.waitForTimeout(1000)
  }

  async expectRealtimeNotification(message: string) {
    const notification = this.toast.filter({ hasText: message })
    await expect(notification).toBeVisible({ timeout: 5000 })
  }

  async expectTaskUpdatedWithoutRefresh(taskTitle: string, newStatus: string) {
    // Verify task status updated without page reload
    const taskCard = this.taskCards.filter({ hasText: taskTitle })
    const statusBadge = taskCard.locator(`text=${newStatus}`)
    await expect(statusBadge).toBeVisible({ timeout: 5000 })
  }

  async expectNoTasks() {
    const emptyState = this.page.locator('text=/No tasks found/i')
    await expect(emptyState).toBeVisible()
  }

  async expectLoadingState() {
    const loadingText = this.page.locator('text=/Loading sprint tasks/i')
    await expect(loadingText).toBeVisible()
  }

  async expectErrorState(errorMessage?: string) {
    const errorHeading = this.page.locator('h3:has-text("Error Loading Sprint")')
    await expect(errorHeading).toBeVisible()

    if (errorMessage) {
      const errorText = this.page.locator(`text=${errorMessage}`)
      await expect(errorText).toBeVisible()
    }
  }

  async clickTryAgain() {
    const tryAgainButton = this.page.locator('button:has-text("Try Again")')
    await tryAgainButton.click()
    await this.waitForLoad()
  }

  async goBackToSprints() {
    await this.backToSprintsLink.click()
    await this.waitForLoad()
  }
}
