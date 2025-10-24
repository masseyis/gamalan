// Page Object Model exports
export { BasePage } from './base-page'
export { AuthPage } from './auth-page'
export { ProjectsPage, ProjectDetailPage } from './projects-page'
export { BacklogPage, StoryDetailPage } from './backlog-page'
export { BoardPage } from './board-page'
export { AssistantPage } from './assistant-page'

// Test helpers
export * from '../test-helpers/auth-helpers'

// Test data factories
export const testData = {
  user: {
    email: process.env.E2E_CLERK_USER_USERNAME || 'dummy+clerk_test@mock.com',
    password: process.env.E2E_CLERK_USER_PASSWORD || 'punvyx-ceczIf-3remza',
    firstName: 'Test',
    lastName: 'User',
  },

  project: {
    name: 'E2E Test Project',
    description: 'A project created during E2E testing',
  },

  story: {
    title: 'Test User Story',
    description:
      'As a user, I want to test the application so that I can verify it works correctly',
    acceptanceCriteria: [
      'Given I am a logged-in user, When I navigate to the application, Then I should see the dashboard',
      'Given I am on the dashboard, When I click create project, Then I should see the project creation form',
    ],
  },

  task: {
    title: 'Test Task',
    description: 'Implementation task for testing',
  },

  sprint: {
    name: 'Test Sprint',
    duration: 14,
  },
}

// Test utilities
export const testUtils = {
  generateUniqueId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  generateTestEmail: () => `test+${Date.now()}@example.com`,

  generateProjectName: () => `E2E Project ${new Date().toISOString().split('T')[0]}`,

  generateStoryTitle: () => `Test Story ${testUtils.generateUniqueId()}`,

  generateTaskTitle: () => `Test Task ${testUtils.generateUniqueId()}`,

  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  getCurrentTimestamp: () => new Date().toISOString(),

  formatDate: (date: Date) => date.toISOString().split('T')[0],
}
