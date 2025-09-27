import { Page, Locator, expect } from '@playwright/test'
import { BasePage } from './base-page'

export class BoardPage extends BasePage {
  readonly todoColumn: Locator
  readonly inProgressColumn: Locator
  readonly reviewColumn: Locator
  readonly doneColumn: Locator
  readonly taskCards: Locator
  readonly createSprintButton: Locator
  readonly sprintDropdown: Locator

  constructor(page: Page) {
    super(page)
    this.todoColumn = page.locator('[data-testid="column-todo"]')
    this.inProgressColumn = page.locator('[data-testid="column-in-progress"]')
    this.reviewColumn = page.locator('[data-testid="column-review"]')
    this.doneColumn = page.locator('[data-testid="column-done"]')
    this.taskCards = page.locator('[data-testid="task-card"]')
    this.createSprintButton = page.locator('button:has-text("Create Sprint")')
    this.sprintDropdown = page.locator('[data-testid="sprint-selector"]')
  }

  async gotoBoard(projectId: string) {
    await this.goto(`/projects/${projectId}/board`)
    await this.waitForLoad()
  }

  async createSprint(name: string, duration: number = 14) {
    await this.createSprintButton.click()

    const nameInput = this.page.locator('input[name="name"], input[placeholder*="sprint name"]')
    await nameInput.fill(name)

    const durationInput = this.page.locator('input[name="duration"], input[type="number"]')
    if (await durationInput.isVisible({ timeout: 2000 })) {
      await durationInput.fill(duration.toString())
    }

    const submitButton = this.page.locator('button:has-text("Create"), button[type="submit"]')
    await submitButton.click()

    await this.expectToastMessage('Sprint created successfully')
  }

  async startSprint(sprintName: string) {
    await this.selectSprint(sprintName)

    const startButton = this.page.locator('button:has-text("Start Sprint")')
    await startButton.click()

    const confirmButton = this.page.locator('button:has-text("Start"):visible')
    await confirmButton.click()

    await this.expectToastMessage('Sprint started')
  }

  async selectSprint(sprintName: string) {
    await this.sprintDropdown.click()
    await this.page.locator(`button:has-text("${sprintName}")`).click()
  }

  async dragTaskToColumn(taskTitle: string, targetColumn: 'todo' | 'in-progress' | 'review' | 'done') {
    const taskCard = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    const targetColumnElement = this.page.locator(`[data-testid="column-${targetColumn}"]`)

    // Perform drag and drop
    await taskCard.dragTo(targetColumnElement)

    // Wait for the UI to update
    await this.page.waitForTimeout(1000)

    await this.expectToastMessage('Task status updated')
  }

  async assignTaskToUser(taskTitle: string, userEmail: string) {
    const taskCard = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    await taskCard.click()

    const assigneeDropdown = this.page.locator('[data-testid="assignee-dropdown"]')
    await assigneeDropdown.click()

    const userOption = this.page.locator(`button:has-text("${userEmail}")`).first()
    await userOption.click()

    await this.expectToastMessage('Task assigned')

    // Close modal/dropdown
    await this.page.keyboard.press('Escape')
  }

  async updateTaskStatus(taskTitle: string, status: 'todo' | 'in-progress' | 'review' | 'done') {
    const taskCard = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    const statusDropdown = taskCard.locator('[data-testid="task-status-dropdown"]')

    await statusDropdown.click()
    await this.page.locator(`button:has-text("${status}")`).click()

    await this.expectToastMessage('Task status updated')
  }

  async addTaskToSprint(taskTitle: string) {
    const taskCard = this.page.locator(`[data-testid="backlog-task"]:has-text("${taskTitle}")`)
    const addToSprintButton = taskCard.locator('button:has-text("Add to Sprint")')

    await addToSprintButton.click()
    await this.expectToastMessage('Task added to sprint')
  }

  async removeTaskFromSprint(taskTitle: string) {
    const taskCard = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    const removeButton = taskCard.locator('button:has-text("Remove")')

    await removeButton.click()

    const confirmButton = this.page.locator('button:has-text("Remove"):visible')
    await confirmButton.click()

    await this.expectToastMessage('Task removed from sprint')
  }

  async completeSprint() {
    const completeButton = this.page.locator('button:has-text("Complete Sprint")')
    await completeButton.click()

    const confirmButton = this.page.locator('button:has-text("Complete"):visible')
    await confirmButton.click()

    await this.expectToastMessage('Sprint completed')
  }

  async expectTaskInColumn(taskTitle: string, column: 'todo' | 'in-progress' | 'review' | 'done') {
    const columnElement = this.page.locator(`[data-testid="column-${column}"]`)
    const taskInColumn = columnElement.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    await expect(taskInColumn).toBeVisible({ timeout: 10000 })
  }

  async expectTaskAssignedTo(taskTitle: string, userEmail: string) {
    const taskCard = this.page.locator(`[data-testid="task-card"]:has-text("${taskTitle}")`)
    const assigneeInfo = taskCard.locator(`[data-testid="assignee"]:has-text("${userEmail}")`)
    await expect(assigneeInfo).toBeVisible()
  }

  async expectSprintActive(sprintName: string) {
    const activeSprintIndicator = this.page.locator(`[data-testid="active-sprint"]:has-text("${sprintName}")`)
    await expect(activeSprintIndicator).toBeVisible()
  }

  async expectEmptyBoard() {
    const emptyState = this.page.locator('[data-testid="empty-board"]')
    await expect(emptyState).toBeVisible()
  }

  async expectColumnTaskCount(column: 'todo' | 'in-progress' | 'review' | 'done', count: number) {
    const columnElement = this.page.locator(`[data-testid="column-${column}"]`)
    const tasks = columnElement.locator('[data-testid="task-card"]')
    await expect(tasks).toHaveCount(count)
  }

  async getBurndownData() {
    const burndownChart = this.page.locator('[data-testid="burndown-chart"]')
    await expect(burndownChart).toBeVisible()

    // Return chart data for validation
    const chartData = await this.page.locator('[data-testid="chart-data"]').textContent()
    return JSON.parse(chartData || '{}')
  }

  async viewSprintMetrics() {
    const metricsButton = this.page.locator('button:has-text("Sprint Metrics")')
    await metricsButton.click()

    const metricsModal = this.page.locator('[data-testid="sprint-metrics-modal"]')
    await expect(metricsModal).toBeVisible()
  }

  async expectBoardLoaded() {
    await expect(this.todoColumn).toBeVisible()
    await expect(this.inProgressColumn).toBeVisible()
    await expect(this.reviewColumn).toBeVisible()
    await expect(this.doneColumn).toBeVisible()
  }
}