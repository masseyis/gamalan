import { 
  InterpretRequest, 
  InterpretResponse, 
  ActionRequest, 
  ActionResponse, 
  SuggestionsResponse 
} from '@/lib/types/assistant'

const DEFAULT_ORCHESTRATOR_BASE = 'http://localhost:8000/api/v1/context'

const normalizeBaseUrl = (input?: string): string => {
  if (!input) {
    return DEFAULT_ORCHESTRATOR_BASE
  }

  const trimmed = input.replace(/\/+$/, '')

  if (trimmed.includes('/context')) {
    return trimmed
  }

  if (trimmed.includes('/api/v1')) {
    return `${trimmed}/context`
  }

  return `${trimmed}/api/v1/context`
}

// Create orchestrator client
class OrchestratorClient {
  private baseURL: string
  private timeout: number

  constructor() {
    this.baseURL = normalizeBaseUrl(process.env.NEXT_PUBLIC_ORCHESTRATOR_API_URL)
    this.timeout = 15000 // 15 seconds for LLM processing
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please slow down.')
        }
        if (response.status >= 500) {
          throw new Error('AI service temporarily unavailable. Please try again.')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Request failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout. The AI is taking longer than expected.')
      }
      throw error
    }
  }

  /**
   * Interpret natural language utterance into structured intent
   */
  async interpretUtterance(request: InterpretRequest): Promise<InterpretResponse> {
    return this.request<InterpretResponse>('/interpret', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Execute a confirmed action command
   */
  async executeAction(request: ActionRequest): Promise<ActionResponse> {
    return this.request<ActionResponse>('/act', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  /**
   * Get AI-generated suggestions for the project
   */
  async getSuggestions(projectId: string, cursor?: string): Promise<SuggestionsResponse> {
    const params = new URLSearchParams({ projectId })
    if (cursor) {
      params.append('cursor', cursor)
    }
    
    return this.request<SuggestionsResponse>(`/suggestions?${params}`)
  }

  /**
   * Get health status of the orchestrator service
   */
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health')
  }

  /**
   * Check if the service is ready to accept requests
   */
  async getReadiness(): Promise<{ ready: boolean; services: Record<string, boolean> }> {
    return this.request<{ ready: boolean; services: Record<string, boolean> }>('/ready')
  }
}

// Mock implementation for development/testing
const mockOrchestrator = {
  async interpretUtterance(request: InterpretRequest): Promise<InterpretResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))

    // Mock different intent scenarios based on utterance content
    const { utterance } = request
    const lowerUtterance = utterance.toLowerCase()

    if (lowerUtterance.includes('finished') || lowerUtterance.includes('done') || lowerUtterance.includes('completed')) {
      return {
        intent: 'mark_task_complete',
        confidence: 0.92,
        autoSelect: false,
        ambiguous: true,
        entities: [
          {
            id: 'task-123',
            type: 'task',
            title: 'Implement user authentication',
            description: 'Add login/logout functionality with JWT tokens',
            confidence: 0.85,
            evidence: [
              { type: 'assignment', label: 'Assigned to you', value: 'Current assignee' },
              { type: 'pr', label: 'Recent PR', value: '#42', url: '/pr/42' },
              { type: 'time', label: 'Last modified', value: '2 hours ago' }
            ]
          },
          {
            id: 'task-456',
            type: 'task',
            title: 'Database migration script',
            description: 'Create migration for user roles table',
            confidence: 0.78,
            evidence: [
              { type: 'commit', label: 'Recent commit', value: 'abc123' },
              { type: 'mention', label: 'Mentioned in standup', value: 'Yesterday' }
            ]
          }
        ],
        suggestedAction: {
          type: 'mark_complete',
          entityId: 'task-123',
          entityType: 'task',
          parameters: { status: 'completed' },
          riskLevel: 'low',
          description: 'Mark task as completed and update story progress',
          confirmationRequired: true,
          draft: {
            summary: 'I will mark the "Implement user authentication" task as completed and update its parent story status.',
            steps: [
              {
                id: 'step-1',
                description: 'Validate that the task exists and is assigned to you',
                type: 'validation',
                details: 'Check task ID "task-123" in the backlog service',
                canSkip: false
              },
              {
                id: 'step-2', 
                description: 'Update task status to "completed"',
                type: 'api_call',
                details: 'Call PATCH /tasks/task-123 with status: "completed"',
                canSkip: false
              },
              {
                id: 'step-3',
                description: 'Check if parent story can advance',
                type: 'validation',
                details: 'Analyze if all story tasks are complete to move story to "In Review"',
                canSkip: false
              },
              {
                id: 'step-4',
                description: 'Send completion notification',
                type: 'send_notification',
                details: 'Notify team members about task completion',
                canSkip: true
              }
            ],
            reasoning: 'Based on your message "I finished the authentication task", I identified this refers to the user authentication implementation task assigned to you. Marking it complete will help track progress and potentially advance the parent story.',
            expectedOutcome: 'Task will be marked as complete, story progress will update, and team will be notified of the completion.',
            potentialIssues: [
              'If there are unfinished subtasks, the story may not advance automatically',
              'Team members may expect a demo or code review before marking complete'
            ],
            estimatedTime: '< 5 seconds'
          }
        }
      }
    }

    if (lowerUtterance.includes('split') || lowerUtterance.includes('break down')) {
      return {
        intent: 'split_story',
        confidence: 0.88,
        autoSelect: true,
        ambiguous: false,
        entities: [
          {
            id: 'story-789',
            type: 'story',
            title: 'User onboarding flow',
            description: 'Complete user registration and setup process',
            confidence: 0.95,
            evidence: [
              { type: 'assignment', label: 'Your story', value: 'Primary assignee' },
              { type: 'time', label: 'Recently viewed', value: '5 minutes ago' }
            ]
          }
        ],
        suggestedAction: {
          type: 'generate_story_breakdown',
          entityId: 'story-789',
          entityType: 'story',
          parameters: { maxStoryPoints: 5, includeAcceptanceCriteria: true },
          riskLevel: 'medium',
          description: 'Generate AI-powered story breakdown suggestions',
          confirmationRequired: true,
          draft: {
            summary: 'I will analyze the "User onboarding flow" story and break it into smaller, manageable stories with acceptance criteria.',
            steps: [
              {
                id: 'step-1',
                description: 'Analyze the current story scope and requirements',
                type: 'validation',
                details: 'Review story description, existing tasks, and acceptance criteria',
                canSkip: false
              },
              {
                id: 'step-2',
                description: 'Generate story breakdown suggestions using AI',
                type: 'api_call',
                details: 'Call prompt-builder service to create vertical story slices',
                canSkip: false
              },
              {
                id: 'step-3',
                description: 'Create acceptance criteria for each new story',
                type: 'api_call',
                details: 'Generate Given/When/Then criteria for each story slice',
                canSkip: false
              },
              {
                id: 'step-4',
                description: 'Present breakdown options for your review',
                type: 'validation',
                details: 'Show suggested stories with estimates and priorities for approval',
                canSkip: false
              }
            ],
            reasoning: 'The current story appears large and complex. Breaking it down will make it easier to estimate, develop, and test in smaller increments while maintaining business value.',
            expectedOutcome: 'You will receive 3-5 smaller story suggestions, each with clear acceptance criteria and estimated complexity.',
            potentialIssues: [
              'AI suggestions may not capture all business nuances',
              'Some suggested stories might still need further breakdown',
              'Dependencies between new stories will need to be considered'
            ],
            estimatedTime: '10-15 seconds'
          }
        }
      }
    }

    // Default general help response
    return {
      intent: 'general_help',
      confidence: 0.45,
      autoSelect: false,
      ambiguous: true,
      entities: []
    }
  },

  async executeAction(request: ActionRequest): Promise<ActionResponse> {
    // Simulate action execution
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const { action } = request
    const success = Math.random() > 0.1 // 90% success rate

    if (success) {
      return {
        success: true,
        message: `Successfully executed ${action.type} for ${action.entityType} ${action.entityId}`,
        data: {
          entityId: action.entityId,
          newStatus: action.parameters.status || 'updated'
        }
      }
    } else {
      return {
        success: false,
        message: 'Failed to execute action',
        errors: ['Service temporarily unavailable', 'Please try again in a moment']
      }
    }
  },

  async getSuggestions(projectId: string): Promise<SuggestionsResponse> {
    await new Promise(resolve => setTimeout(resolve, 800))
    
    return {
      suggestions: [
        {
          id: 'sugg-1',
          type: 'story-readiness',
          title: 'Story needs acceptance criteria',
          description: 'Story "User profile page" lacks detailed acceptance criteria. Would you like me to generate some?',
          priority: 'high',
          confidence: 0.92,
          actionable: true,
          entityId: 'story-456',
          entityType: 'story',
          suggestedAction: 'generate_acceptance_criteria',
          createdAt: new Date().toISOString()
        },
        {
          id: 'sugg-2',
          type: 'sprint-planning',
          title: 'Sprint capacity recommendation',
          description: 'Based on team velocity, consider reducing sprint scope by 2-3 story points to improve predictability.',
          priority: 'medium',
          confidence: 0.78,
          actionable: true,
          suggestedAction: 'adjust_sprint_capacity',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'sugg-3',
          type: 'demo-prep',
          title: 'Demo pack ready for review',
          description: 'Your demo pack for Sprint 12 is ready with 4 completed stories. Review and approve for stakeholder presentation.',
          priority: 'medium',
          confidence: 0.85,
          actionable: true,
          suggestedAction: 'review_demo_pack',
          createdAt: new Date(Date.now() - 1800000).toISOString()
        }
      ],
      hasMore: false
    }
  },

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return { status: 'ok', timestamp: new Date().toISOString() }
  },

  async getReadiness(): Promise<{ ready: boolean; services: Record<string, boolean> }> {
    return { 
      ready: true, 
      services: { llm: true, vector_db: true, services: true } 
    }
  }
}

// Always use real orchestrator client in production
export const orchestratorApi = new OrchestratorClient()
