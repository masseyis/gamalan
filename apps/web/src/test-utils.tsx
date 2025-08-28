import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'

// Override render method
export { customRender as render }

// Test data factories
export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const mockStory = {
  id: 'test-story-id',
  title: 'Test User Story',
  description: 'As a user, I want to test the application',
  status: 'backlog' as const,
  priority: 'medium' as const,
  storyPoints: 5,
  projectId: 'test-project-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const mockTask = {
  id: 'test-task-id',
  title: 'Test Task',
  description: 'Test task description',
  status: 'todo' as const,
  storyId: 'test-story-id',
  acceptanceCriteriaRefs: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const mockAcceptanceCriterion = {
  id: 'test-ac-id',
  given: 'Given I am a user',
  when: 'When I perform an action',
  then: 'Then I should see the expected result',
  storyId: 'test-story-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}