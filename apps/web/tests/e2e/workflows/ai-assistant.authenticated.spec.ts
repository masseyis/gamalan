import { test, expect } from '@playwright/test'
import { AssistantPage, ProjectsPage, BacklogPage, testData, testUtils } from '../page-objects'

// Use authenticated storage state
test.use({ storageState: 'tests/playwright/.clerk/user.json' })

test.describe('AI Assistant Workflows', () => {
  let assistantPage: AssistantPage
  let projectsPage: ProjectsPage
  let backlogPage: BacklogPage
  let projectId: string
  let projectName: string

  test.beforeAll(async ({ browser }) => {
    // Create a test project for AI assistant context
    const context = await browser.newContext({ storageState: 'tests/playwright/.clerk/user.json' })
    const page = await context.newPage()
    projectsPage = new ProjectsPage(page)

    projectName = testUtils.generateProjectName()
    await projectsPage.gotoProjects()
    projectId = await projectsPage.createProject(projectName, 'Test project for AI assistant')

    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    assistantPage = new AssistantPage(page)
    projectsPage = new ProjectsPage(page)
    backlogPage = new BacklogPage(page)
  })

  test.describe('Basic AI Assistant Functionality', () => {
    test('should load AI assistant interface', async () => {
      await assistantPage.gotoAssistant()
      await assistantPage.expectAssistantLoaded()
      await assistantPage.expectAIFeatureEnabled()
    })

    test('should send and receive messages', async () => {
      await assistantPage.gotoAssistant()

      const message = 'Hello, I need help with project management'
      await assistantPage.sendMessage(message)

      // Verify message was sent
      await assistantPage.expectMessageSent(message)

      // Verify AI responded
      await assistantPage.expectAIResponse()
    })

    test('should handle multiple conversation turns', async () => {
      await assistantPage.gotoAssistant()

      // First message
      await assistantPage.sendMessage('What is a user story?')
      await assistantPage.expectAIResponse()

      // Follow-up message
      await assistantPage.sendMessage('How do I write good acceptance criteria?')
      await assistantPage.expectAIResponse()

      // Verify conversation history
      await assistantPage.expectMessageHistory(4) // 2 user messages + 2 AI responses
    })

    test('should clear chat history', async () => {
      await assistantPage.gotoAssistant()

      // Send a message
      await assistantPage.sendMessage('Test message for clearing')
      await assistantPage.expectAIResponse()

      // Clear chat
      await assistantPage.clearChat()
      await assistantPage.expectEmptyChat()
    })

    test('should respond to keyboard shortcut', async () => {
      // Navigate to any page first
      await projectsPage.gotoProjects()

      // Use keyboard shortcut to open assistant
      await assistantPage.testKeyboardShortcut()

      // Should focus the chat input
      await expect(assistantPage.chatInput).toBeFocused()
    })
  })

  test.describe('Context-Aware AI Assistance', () => {
    test('should understand project context', async () => {
      await assistantPage.gotoAssistant()

      // Set project context
      await assistantPage.selectContext('project')

      const message = `Analyze the project "${projectName}"`
      await assistantPage.sendMessage(message)

      // AI should provide project-specific analysis
      await assistantPage.expectAIResponseContains(projectName)
    })

    test('should provide story writing assistance', async () => {
      await assistantPage.gotoAssistant()

      await assistantPage.selectContext('story')

      const message = 'Help me write a user story for user authentication'
      await assistantPage.sendMessage(message)

      // AI should provide story template or suggestions
      await assistantPage.expectAIResponseContains('As a')
      await assistantPage.expectAIResponseContains('I want')
      await assistantPage.expectAIResponseContains('So that')
    })

    test('should suggest acceptance criteria', async () => {
      await assistantPage.gotoAssistant()

      const storyDescription =
        'As a user, I want to log into the system so that I can access my projects'
      await assistantPage.generateAcceptanceCriteria(storyDescription)

      // AI should provide Given-When-Then format criteria
      await assistantPage.expectAIResponseContains('Given')
      await assistantPage.expectAIResponseContains('When')
      await assistantPage.expectAIResponseContains('Then')
    })

    test('should help with task breakdown', async () => {
      await assistantPage.gotoAssistant()

      const storyTitle = 'User Dashboard Implementation'
      await assistantPage.askForTaskBreakdown(storyTitle)

      // AI should provide task suggestions
      await assistantPage.expectAIResponseContains('task')
      await assistantPage.expectAIResponseContains('implement')
    })
  })

  test.describe('AI-Powered Content Creation', () => {
    test('should create story from conversation', async () => {
      await assistantPage.gotoAssistant()

      const storyTitle = `AI Generated Story ${testUtils.generateUniqueId()}`
      await assistantPage.createStoryFromChat(storyTitle)

      // Verify story was created (should redirect or show confirmation)
      await assistantPage.expectToastMessage('Story created successfully')
    })

    test('should generate and apply acceptance criteria', async () => {
      // First create a story to apply criteria to
      await backlogPage.gotoBacklog(projectId)
      const storyTitle = `AC Generation ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Story for AC generation testing')

      // Use AI to generate criteria
      await assistantPage.gotoAssistant()
      await assistantPage.generateAcceptanceCriteria(storyTitle)

      // Criteria should be applied to the story
      await assistantPage.expectToastMessage('Acceptance criteria applied')
    })

    test('should create tasks from AI suggestions', async () => {
      // Create a story first
      await backlogPage.gotoBacklog(projectId)
      const storyTitle = `Task Generation ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Story for task generation testing')

      // Get AI task suggestions
      await assistantPage.gotoAssistant()
      await assistantPage.askForTaskBreakdown(storyTitle)

      // Tasks should be created
      await assistantPage.expectToastMessage('Tasks created successfully')
    })
  })

  test.describe('AI Suggestions and Recommendations', () => {
    test('should show contextual suggestions', async () => {
      await assistantPage.gotoAssistant()
      await assistantPage.expectSuggestionsVisible()

      // Use a suggestion
      const suggestionButtons = assistantPage.suggestionsContainer.locator('button')
      const firstSuggestion = await suggestionButtons.first().textContent()

      if (firstSuggestion) {
        await assistantPage.useSuggestion(firstSuggestion)
        await assistantPage.expectMessageSent(firstSuggestion)
        await assistantPage.expectAIResponse()
      }
    })

    test('should provide project analysis and insights', async () => {
      await assistantPage.gotoAssistant()
      await assistantPage.requestProjectAnalysis(projectName)

      // AI should provide insights about the project
      await assistantPage.expectAIResponseContains('analysis')
      await assistantPage.expectAIResponseContains('recommend')
    })

    test('should suggest improvements to stories', async () => {
      // Create a basic story first
      await backlogPage.gotoBacklog(projectId)
      const storyTitle = `Improvement Test ${testUtils.generateUniqueId()}`
      await backlogPage.createStory(storyTitle, 'Basic story')

      await assistantPage.gotoAssistant()
      await assistantPage.sendMessage(`Review and improve this story: ${storyTitle}`)

      // AI should provide improvement suggestions
      await assistantPage.expectAIResponseContains('improve')
      await assistantPage.expectAIResponseContains('suggest')
    })
  })

  test.describe('AI Assistant Performance and Reliability', () => {
    test('should handle long conversations', async () => {
      await assistantPage.gotoAssistant()

      // Send multiple messages to test conversation memory
      const messages = [
        'Help me plan a new feature',
        'The feature is for user notifications',
        'It should support email and in-app notifications',
        'What user stories do I need?',
        'How should I prioritize them?',
      ]

      for (const message of messages) {
        await assistantPage.sendMessage(message)
        await assistantPage.expectAIResponse()
      }

      // AI should maintain context throughout conversation
      await assistantPage.sendMessage('What feature were we discussing?')
      await assistantPage.expectAIResponseContains('notification')
    })

    test('should handle complex queries', async () => {
      await assistantPage.gotoAssistant()

      const complexQuery = `
        I'm building a multi-tenant SaaS application with React and Node.js.
        I need user stories for authentication, role-based access control,
        billing integration, and data isolation between tenants.
        Can you help me break this down into an epic with stories and acceptance criteria?
      `

      await assistantPage.sendMessage(complexQuery)
      await assistantPage.expectAIResponse()

      // AI should handle the complexity and provide structured response
      await assistantPage.expectAIResponseContains('epic')
      await assistantPage.expectAIResponseContains('stories')
    })

    test('should gracefully handle AI service errors', async () => {
      await assistantPage.gotoAssistant()

      // Simulate AI service failure
      await assistantPage.page.route('**/api/ai/**', (route) => route.abort())

      await assistantPage.sendMessage('This should fail gracefully')

      // Should show error message instead of hanging
      await assistantPage.expectError('AI service temporarily unavailable')
    })

    test('should show thinking indicator during processing', async () => {
      await assistantPage.gotoAssistant()

      // Send a message that should trigger thinking indicator
      const message = 'Generate a comprehensive project plan with multiple user stories'
      await assistantPage.chatInput.fill(message)
      await assistantPage.sendButton.click()

      // Should show thinking indicator
      await assistantPage.expectThinkingIndicator()

      // Wait for response
      await assistantPage.waitForAIResponse()
      await assistantPage.expectNoThinkingIndicator()
    })
  })

  test.describe('Integration with Project Management Features', () => {
    test('should maintain context when navigating between features', async () => {
      // Start in assistant
      await assistantPage.gotoAssistant()
      await assistantPage.sendMessage('I want to create a new project')

      // Navigate to projects page
      await assistantPage.navigateTo('Projects')

      // Come back to assistant - context should be preserved
      await assistantPage.navigateTo('Assistant')

      // Previous conversation should be visible
      await assistantPage.expectMessageSent('I want to create a new project')
    })

    test('should help with sprint planning', async () => {
      await assistantPage.gotoAssistant()

      const sprintPlanningQuery = `
        I have 5 user stories ready for development.
        My team has 3 developers for a 2-week sprint.
        How should I plan this sprint?
      `

      await assistantPage.sendMessage(sprintPlanningQuery)

      // AI should provide sprint planning advice
      await assistantPage.expectAIResponseContains('sprint')
      await assistantPage.expectAIResponseContains('capacity')
      await assistantPage.expectAIResponseContains('velocity')
    })

    test('should provide guidance on agile best practices', async () => {
      await assistantPage.gotoAssistant()

      await assistantPage.sendMessage('What are the best practices for writing user stories?')

      // AI should provide agile methodology guidance
      await assistantPage.expectAIResponseContains('INVEST')
      await assistantPage.expectAIResponseContains('acceptance criteria')
      await assistantPage.expectAIResponseContains('definition of done')
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle empty messages', async () => {
      await assistantPage.gotoAssistant()

      // Try to send empty message
      await assistantPage.sendButton.click()

      // Should not send empty message or should show validation
      const messageCount = await assistantPage.getMessageCount()
      expect(messageCount).toBe(0)
    })

    test('should handle very long messages', async () => {
      await assistantPage.gotoAssistant()

      const longMessage = 'A'.repeat(5000) // Very long message
      await assistantPage.chatInput.fill(longMessage)
      await assistantPage.sendButton.click()

      // Should either accept or show validation error
      try {
        await assistantPage.expectAIResponse()
      } catch {
        await assistantPage.expectError('Message too long')
      }
    })

    test('should handle special characters and code', async () => {
      await assistantPage.gotoAssistant()

      const messageWithCode = `
        How do I implement this React component?
        \`\`\`jsx
        function MyComponent() {
          return <div>Hello World</div>;
        }
        \`\`\`
      `

      await assistantPage.sendMessage(messageWithCode)
      await assistantPage.expectAIResponse()

      // AI should handle code blocks properly
      await assistantPage.expectAIResponseContains('component')
    })

    test('should maintain session across page reloads', async () => {
      await assistantPage.gotoAssistant()

      await assistantPage.sendMessage('Test message before reload')
      await assistantPage.expectAIResponse()

      // Reload page
      await assistantPage.page.reload()
      await assistantPage.waitForLoad()

      // Conversation should be preserved
      await assistantPage.expectMessageSent('Test message before reload')
    })
  })

  // Cleanup after all tests
  test.afterAll(async ({ browser }) => {
    try {
      const context = await browser.newContext({
        storageState: 'tests/playwright/.clerk/user.json',
      })
      const page = await context.newPage()
      const cleanupProjectsPage = new ProjectsPage(page)

      await cleanupProjectsPage.gotoProjects()
      await cleanupProjectsPage.deleteProject(projectName)

      await context.close()
    } catch {
      // Ignore cleanup errors
    }
  })
})
