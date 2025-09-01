import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  })
}))

// Mock the API
vi.mock('@/lib/api/ai', () => ({
  aiApi: {
    checkStoryReadiness: vi.fn(),
    generateAcceptanceCriteria: vi.fn(),
    suggestStoryBreakdown: vi.fn(),
    clarifyTaskRequirements: vi.fn(),
  }
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('AIAssistant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with collapsed state by default', () => {
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <AIAssistant projectId="test-project" context="general" />
      </Wrapper>
    )

    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Expand')).toBeInTheDocument()
  })

  it('expands when expand button is clicked', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <AIAssistant projectId="test-project" storyId="test-story" context="story" />
      </Wrapper>
    )

    await user.click(screen.getByText('Expand'))
    expect(screen.getByText('Collapse')).toBeInTheDocument()
  })

  it('shows story-specific actions when context is story', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <AIAssistant projectId="test-project" storyId="test-story" context="story" />
      </Wrapper>
    )

    await user.click(screen.getByText('Expand'))
    
    expect(screen.getByText('Check Readiness')).toBeInTheDocument()
    expect(screen.getByText('Generate Acceptance Criteria')).toBeInTheDocument()
    expect(screen.getByText('Suggest Breakdown')).toBeInTheDocument()
  })

  it('shows task-specific actions when context is task', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <AIAssistant 
          projectId="test-project" 
          storyId="test-story"
          taskId="test-task"
          context="task" 
        />
      </Wrapper>
    )

    await user.click(screen.getByText('Expand'))
    
    expect(screen.getByText('Clarify Requirements')).toBeInTheDocument()
  })

  it('shows beta warning message', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    
    render(
      <Wrapper>
        <AIAssistant projectId="test-project" storyId="test-story" context="story" />
      </Wrapper>
    )

    await user.click(screen.getByText('Expand'))
    
    expect(screen.getByText(/AI features are in beta/i)).toBeInTheDocument()
  })

  it('does not render when no actions are available', () => {
    const Wrapper = createWrapper()
    
    const { container } = render(
      <Wrapper>
        <AIAssistant projectId="test-project" context="task" />
      </Wrapper>
    )

    expect(container.firstChild).toBeNull()
  })
})