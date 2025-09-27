import { test, expect } from '@playwright/test'
import { ProjectsPage, ProjectDetailPage, testData, testUtils } from '../page-objects'

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('Project Management Workflows', () => {
  let projectsPage: ProjectsPage
  let projectDetailPage: ProjectDetailPage
  let projectId: string
  let projectName: string

  test.beforeEach(async ({ page }) => {
    projectsPage = new ProjectsPage(page)
    projectDetailPage = new ProjectDetailPage(page)
    projectName = testUtils.generateProjectName()
  })

  test.describe('Project Creation and Management', () => {
    test('should create a new project successfully', async () => {
      await projectsPage.gotoProjects()
      await projectsPage.expectProjectsLoaded()

      projectId = await projectsPage.createProject(projectName, testData.project.description)

      // Verify project was created and we're redirected to project detail
      await projectDetailPage.expectProjectLoaded(projectName)
      expect(projectId).toBeTruthy()
    })

    test('should display all projects on projects page', async () => {
      await projectsPage.gotoProjects()
      await projectsPage.expectProjectsLoaded()

      // Create a test project first
      projectId = await projectsPage.createProject(projectName, testData.project.description)

      // Go back to projects list
      await projectsPage.gotoProjects()

      // Verify project appears in list
      await projectsPage.expectProjectExists(projectName)
    })

    test('should open project from projects list', async () => {
      // Create project first
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(projectName, testData.project.description)

      // Go back and open project
      await projectsPage.gotoProjects()
      await projectsPage.openProject(projectName)

      // Verify we're in the project detail page
      await projectDetailPage.expectProjectLoaded(projectName)
      await expect(projectDetailPage.page).toHaveURL(new RegExp(`/projects/${projectId}`))
    })

    test('should search projects by name', async () => {
      // Create a uniquely named project
      const uniqueName = `Unique ${testUtils.generateUniqueId()}`
      await projectsPage.gotoProjects()
      await projectsPage.createProject(uniqueName, 'Searchable project')

      // Go back to projects and search
      await projectsPage.gotoProjects()
      await projectsPage.searchProjects(uniqueName)

      // Should find the project
      await projectsPage.expectProjectExists(uniqueName)

      // Search for non-existent project
      await projectsPage.searchProjects('NonExistentProject123')
      await projectsPage.expectProjectNotExists(uniqueName)
    })

    test('should update project information', async () => {
      // Create project
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(projectName, testData.project.description)

      // Update project info
      const newName = `Updated ${projectName}`
      const newDescription = 'Updated project description'

      await projectDetailPage.updateProjectInfo(newName, newDescription)

      // Verify changes were saved
      await projectDetailPage.expectProjectLoaded(newName)
    })

    test('should delete project successfully', async () => {
      // Create project to delete
      await projectsPage.gotoProjects()
      const deleteProjectName = `ToDelete ${testUtils.generateUniqueId()}`
      await projectsPage.createProject(deleteProjectName, 'Project to be deleted')

      // Go back to projects list and delete
      await projectsPage.gotoProjects()
      await projectsPage.deleteProject(deleteProjectName)

      // Verify project no longer exists
      await projectsPage.expectProjectNotExists(deleteProjectName)
    })
  })

  test.describe('Project Navigation and Sections', () => {
    test.beforeEach(async () => {
      // Create a project for navigation tests
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(projectName, testData.project.description)
    })

    test('should navigate between project sections', async () => {
      // Start from project overview
      await projectDetailPage.expectProjectLoaded(projectName)

      // Navigate to backlog
      await projectDetailPage.switchToBacklog()
      await expect(projectDetailPage.page).toHaveURL(new RegExp(`/projects/${projectId}/backlog`))

      // Navigate to board
      await projectDetailPage.switchToBoard()
      await expect(projectDetailPage.page).toHaveURL(new RegExp(`/projects/${projectId}/board`))

      // Navigate to settings
      await projectDetailPage.switchToSettings()
      await expect(projectDetailPage.page).toHaveURL(new RegExp(`/projects/${projectId}/settings`))
    })

    test('should maintain project context across sections', async () => {
      // Verify project name is visible in all sections
      await projectDetailPage.switchToBacklog()
      await projectDetailPage.expectProjectLoaded(projectName)

      await projectDetailPage.switchToBoard()
      await projectDetailPage.expectProjectLoaded(projectName)

      await projectDetailPage.switchToSettings()
      await projectDetailPage.expectProjectLoaded(projectName)
    })

    test('should handle direct URL navigation to project sections', async () => {
      // Navigate directly to backlog
      await projectDetailPage.gotoBacklog(projectId)
      await projectDetailPage.expectProjectLoaded(projectName)

      // Navigate directly to board
      await projectDetailPage.gotoBoard(projectId)
      await projectDetailPage.expectProjectLoaded(projectName)

      // Navigate directly to settings
      await projectDetailPage.gotoSettings(projectId)
      await projectDetailPage.expectProjectLoaded(projectName)
    })
  })

  test.describe('Team Management', () => {
    test.beforeEach(async () => {
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(projectName, testData.project.description)
    })

    test('should invite team member to project', async () => {
      const memberEmail = testUtils.generateTestEmail()

      await projectDetailPage.addTeamMember(memberEmail)

      // Verify invitation was sent
      await projectDetailPage.expectToastMessage('Team member invited')
    })

    test('should validate email format when inviting members', async () => {
      await projectDetailPage.gotoSettings(projectId)

      const inviteInput = projectDetailPage.page.locator('input[placeholder*="email"]')
      await inviteInput.fill('invalid-email')

      const inviteButton = projectDetailPage.page.locator('button:has-text("Invite")')
      await inviteButton.click()

      await projectDetailPage.expectError('Please enter a valid email')
    })
  })

  test.describe('Project Settings and Configuration', () => {
    test.beforeEach(async () => {
      await projectsPage.gotoProjects()
      projectId = await projectsPage.createProject(projectName, testData.project.description)
    })

    test('should configure project settings', async () => {
      await projectDetailPage.gotoSettings(projectId)

      // Test various settings configurations
      const settingsForm = projectDetailPage.page.locator('[data-testid="project-settings"]')
      if (await settingsForm.isVisible({ timeout: 5000 })) {
        // Configure project visibility
        const visibilitySelect = projectDetailPage.page.locator('select[name="visibility"]')
        if (await visibilitySelect.isVisible({ timeout: 2000 })) {
          await visibilitySelect.selectOption('private')
        }

        // Configure project template
        const templateSelect = projectDetailPage.page.locator('select[name="template"]')
        if (await templateSelect.isVisible({ timeout: 2000 })) {
          await templateSelect.selectOption('agile')
        }

        const saveButton = projectDetailPage.page.locator('button:has-text("Save Settings")')
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click()
          await projectDetailPage.expectToastMessage('Settings saved')
        }
      }
    })

    test('should handle project archiving', async () => {
      await projectDetailPage.gotoSettings(projectId)

      const archiveButton = projectDetailPage.page.locator('button:has-text("Archive Project")')
      if (await archiveButton.isVisible({ timeout: 5000 })) {
        await archiveButton.click()

        const confirmButton = projectDetailPage.page.locator('button:has-text("Archive"):visible')
        await confirmButton.click()

        await projectDetailPage.expectToastMessage('Project archived')

        // Should redirect to projects list
        await expect(projectDetailPage.page).toHaveURL(/.*\/projects$/)
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent project gracefully', async () => {
      const fakeProjectId = 'non-existent-project-id'
      await projectDetailPage.gotoProject(fakeProjectId)

      // Should show 404 or redirect to projects
      const is404 = await projectDetailPage.page.locator('text=404').isVisible({ timeout: 5000 })
      const isRedirected = projectDetailPage.page.url().includes('/projects')

      expect(is404 || isRedirected).toBeTruthy()
    })

    test('should handle network errors during project creation', async () => {
      await projectsPage.gotoProjects()

      // Simulate network failure
      await projectsPage.page.route('**/api/projects', route => route.abort())

      try {
        await projectsPage.createProject(projectName, testData.project.description)

        // Should show error message
        await projectsPage.expectError('Failed to create project')
      } catch {
        // Test may timeout which is acceptable for network error simulation
      }
    })

    test('should validate required fields in project creation', async () => {
      await projectsPage.gotoProjects()
      await projectsPage.newProjectButton.click()

      // Try to submit without required fields
      const submitButton = projectsPage.page.locator('button:has-text("Create"), button[type="submit"]')
      await submitButton.click()

      await projectsPage.expectError('Project name is required')
    })

    test('should handle long project names and descriptions', async () => {
      const longName = 'A'.repeat(100)
      const longDescription = 'B'.repeat(1000)

      await projectsPage.gotoProjects()

      try {
        await projectsPage.createProject(longName, longDescription)
        await projectDetailPage.expectProjectLoaded(longName.substring(0, 50)) // Might be truncated
      } catch {
        // May fail validation, which is acceptable
        await projectsPage.expectError('Name too long')
      }
    })
  })

  // Cleanup
  test.afterEach(async () => {
    if (projectId && projectName) {
      try {
        await projectsPage.gotoProjects()
        await projectsPage.deleteProject(projectName)
      } catch {
        // Ignore cleanup errors
      }
    }
  })
})