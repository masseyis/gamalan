import { promptBuilderClient, readinessClient } from './client'
import { 
  PlanPack, 
  TaskPack, 
  ReadinessCheck, 
  CreatePlanPackRequest,
  CreateTaskPackRequest,
  StoryAnalysis,
  TaskAnalysis
} from '@/lib/types/ai'

const useMockData = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true'

const mockAI = {
  checkStoryReadiness: async (projectId: string, storyId: string) => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    return {
      id: `readiness-${Date.now()}`,
      storyId,
      status: 'ready' as const,
      score: 85,
      timestamp: new Date().toISOString(),
      issues: [],
      suggestions: []
    }
  },

  generateAcceptanceCriteria: async (projectId: string, storyId: string) => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    return {
      suggestions: [
        {
          text: 'Given a user has items in their cart, when they proceed to checkout, then they should see a summary of their order with all items, quantities, and prices clearly displayed',
          confidence: 92,
          priority: 'high',
          effort: 'medium'
        },
        {
          text: 'Given a user enters valid payment information, when they submit the order, then they should receive a confirmation email within 30 seconds containing order details and tracking information',
          confidence: 88,
          priority: 'high',
          effort: 'low'
        },
        {
          text: 'Given a user enters invalid payment information, when they submit the order, then they should see a clear error message indicating what needs to be corrected without exposing sensitive data',
          confidence: 95,
          priority: 'critical',
          effort: 'medium'
        },
        {
          text: 'Given a user abandons their cart, when they return within 24 hours, then their cart contents should be preserved and they should be prompted to complete their purchase',
          confidence: 78,
          priority: 'medium',
          effort: 'high'
        }
      ]
    }
  },

  suggestStoryBreakdown: async (projectId: string, storyId: string) => {
    await new Promise(resolve => setTimeout(resolve, 1800))
    return {
      suggestions: [
        {
          title: 'Create User Registration Form UI',
          description: 'Design and implement the frontend registration form with proper validation feedback',
          confidence: 94,
          storyPoints: 3,
          priority: 'high'
        },
        {
          title: 'Implement Backend User Registration API',
          description: 'Create secure API endpoints for user registration with proper validation and error handling',
          confidence: 91,
          storyPoints: 5,
          priority: 'high'
        },
        {
          title: 'Add Email Verification System',
          description: 'Implement email verification workflow with token generation and validation',
          confidence: 87,
          storyPoints: 5,
          priority: 'medium'
        },
        {
          title: 'Design User Profile Management Page',
          description: 'Create user interface for viewing and editing profile information',
          confidence: 89,
          storyPoints: 3,
          priority: 'medium'
        },
        {
          title: 'Add Password Reset Functionality',
          description: 'Implement secure password reset flow with email notifications',
          confidence: 85,
          storyPoints: 4,
          priority: 'medium'
        }
      ]
    }
  },

  clarifyTaskRequirements: async (projectId: string, storyId: string, taskId: string) => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    return {
      clarifications: [
        {
          title: 'Email Validation Specification',
          description: 'What specific validation rules should be applied to the email field? Should we support international domains, plus addressing (user+tag@domain.com), and what maximum length should be enforced?',
          confidence: 95,
          category: 'validation',
          impact: 'high'
        },
        {
          title: 'Social Authentication Integration',
          description: 'Should the system support social media login integration (Google, Facebook, Apple)? This would affect the registration flow and data collection requirements.',
          confidence: 88,
          category: 'integration',
          impact: 'medium'
        },
        {
          title: 'Duplicate Email Handling',
          description: 'What happens if a user tries to register with an existing email? Should we show a specific error, offer login instead, or allow password reset from registration page?',
          confidence: 92,
          category: 'business-logic',
          impact: 'high'
        },
        {
          title: 'Registration Rate Limiting',
          description: 'Should we implement rate limiting for registration attempts to prevent spam or abuse? What should be the limits per IP address and time window?',
          confidence: 82,
          category: 'security',
          impact: 'medium'
        }
      ]
    }
  },

  suggestSprintPlanning: async (projectId: string) => {
    await new Promise(resolve => setTimeout(resolve, 2200))
    return {
      suggestions: [
        {
          title: 'High-Impact User Stories',
          description: 'Focus on completing the user authentication system and shopping cart functionality. These stories have high business value and are blocking other features.\n\nRecommended Stories:\n• User Registration System (8 pts) - Critical for user onboarding\n• Shopping Cart Persistence (5 pts) - High user value\n• Payment Integration (13 pts) - Revenue critical\n\nTotal: 26 story points (within team velocity)',
          confidence: 89,
          velocity: 28,
          capacity: 'optimal'
        },
        {
          title: 'Technical Debt & Performance',
          description: 'Balance feature work with technical improvements to maintain development velocity.\n\nRecommended Tasks:\n• API Response Optimization (3 pts)\n• Database Query Performance (5 pts)\n• Component Refactoring (2 pts)\n\nThis sprint would focus 70% on features, 30% on technical improvements.',
          confidence: 82,
          velocity: 25,
          capacity: 'conservative'
        }
      ]
    }
  },

  predictVelocity: async (projectId: string) => {
    await new Promise(resolve => setTimeout(resolve, 1600))
    return {
      predictedVelocity: 32,
      confidence: 87,
      accuracy: 'high',
      recommendations: {
        focus: 'medium complexity stories',
        riskMitigation: 'adding 20% buffer for unknowns and external dependencies'
      }
    }
  },

  analyzeRisks: async (projectId: string, storyId?: string) => {
    await new Promise(resolve => setTimeout(resolve, 1900))
    return {
      risks: [
        {
          title: 'Third-party API Dependency',
          category: 'technical',
          severity: 'high',
          probability: 'medium',
          description: 'The payment processing integration depends on a third-party API that has been experiencing intermittent outages (2-3 times per month).',
          impact: 'Could delay sprint completion by 2-3 days if outages occur during integration testing',
          mitigation: 'Implement comprehensive error handling, add retry logic, and create a fallback payment method. Schedule integration work early in sprint.',
          confidence: 91
        },
        {
          title: 'Database Schema Changes',
          category: 'technical',
          severity: 'medium',
          probability: 'high',
          description: 'User authentication features require significant database schema changes that could affect existing functionality.',
          impact: 'Potential data migration issues and downtime during deployment',
          mitigation: 'Create comprehensive migration scripts, test with production data copies, and plan for rollback procedures. Schedule deployment during low-traffic periods.',
          confidence: 88
        },
        {
          title: 'Team Capacity Reduction',
          category: 'resource',
          severity: 'medium',
          probability: 'low',
          description: 'Key team member has planned vacation during the last week of sprint, reducing available development capacity by 25%.',
          impact: 'May need to reduce sprint scope or extend timeline',
          mitigation: 'Front-load critical work, ensure knowledge transfer, and have backup team member familiar with key components.',
          confidence: 95
        },
        {
          title: 'Unclear Requirements',
          category: 'business',
          severity: 'medium',
          probability: 'medium',
          description: 'Several user stories lack detailed acceptance criteria and stakeholder alignment on expected behavior.',
          impact: 'Could lead to rework, scope creep, or missed user expectations',
          mitigation: 'Schedule requirements refinement session with stakeholders before sprint start. Create prototypes for complex interactions.',
          confidence: 84
        }
      ]
    }
  }
}

export const aiApi = {
  // Prompt Builder API - Plan Packs
  async createPlanPack(projectId: string, storyId: string, data: CreatePlanPackRequest): Promise<PlanPack> {
    return promptBuilderClient.post<PlanPack>(`/projects/${projectId}/stories/${storyId}/plan-packs`, data)
  },

  async getPlanPack(projectId: string, storyId: string, planPackId: string): Promise<PlanPack> {
    return promptBuilderClient.get<PlanPack>(`/projects/${projectId}/stories/${storyId}/plan-packs/${planPackId}`)
  },

  async updatePlanPack(projectId: string, storyId: string, planPackId: string, data: Partial<PlanPack>): Promise<PlanPack> {
    return promptBuilderClient.patch<PlanPack>(`/projects/${projectId}/stories/${storyId}/plan-packs/${planPackId}`, data)
  },

  async deletePlanPack(projectId: string, storyId: string, planPackId: string): Promise<void> {
    return promptBuilderClient.delete<void>(`/projects/${projectId}/stories/${storyId}/plan-packs/${planPackId}`)
  },

  // Prompt Builder API - Task Packs
  async createTaskPack(projectId: string, storyId: string, taskId: string, data: CreateTaskPackRequest): Promise<TaskPack> {
    return promptBuilderClient.post<TaskPack>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/task-packs`, data)
  },

  async getTaskPack(projectId: string, storyId: string, taskId: string, taskPackId: string): Promise<TaskPack> {
    return promptBuilderClient.get<TaskPack>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/task-packs/${taskPackId}`)
  },

  async updateTaskPack(projectId: string, storyId: string, taskId: string, taskPackId: string, data: Partial<TaskPack>): Promise<TaskPack> {
    return promptBuilderClient.patch<TaskPack>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/task-packs/${taskPackId}`, data)
  },

  async deleteTaskPack(projectId: string, storyId: string, taskId: string, taskPackId: string): Promise<void> {
    return promptBuilderClient.delete<void>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/task-packs/${taskPackId}`)
  },

  // Readiness Assessment API
  async checkStoryReadiness(projectId: string, storyId: string): Promise<ReadinessCheck> {
    if (useMockData) {
      return mockAI.checkStoryReadiness(projectId, storyId)
    }
    return readinessClient.post<ReadinessCheck>(`/projects/${projectId}/stories/${storyId}/readiness-check`)
  },

  async getReadinessCheck(projectId: string, storyId: string, checkId: string): Promise<ReadinessCheck> {
    return readinessClient.get<ReadinessCheck>(`/projects/${projectId}/stories/${storyId}/readiness-checks/${checkId}`)
  },

  // AI-Powered Story Analysis
  async analyzeStory(projectId: string, storyId: string): Promise<StoryAnalysis> {
    return promptBuilderClient.post<StoryAnalysis>(`/projects/${projectId}/stories/${storyId}/analyze`)
  },

  async generateAcceptanceCriteria(projectId: string, storyId: string, context?: {
    existingCriteria?: string[]
    userPersonas?: string[]
    businessRules?: string[]
  }): Promise<{ suggestions: Array<{ given: string, when: string, then: string }> }> {
    if (useMockData) {
      return mockAI.generateAcceptanceCriteria(projectId, storyId) as any
    }
    return promptBuilderClient.post<{ suggestions: Array<{ given: string, when: string, then: string }> }>(
      `/projects/${projectId}/stories/${storyId}/generate-acceptance-criteria`, 
      context
    )
  },

  async suggestStoryBreakdown(projectId: string, storyId: string): Promise<{ 
    suggestions: Array<{
      title: string
      description: string
      estimatedPoints: number
      priority: 'low' | 'medium' | 'high' | 'critical'
    }>
  }> {
    if (useMockData) {
      return mockAI.suggestStoryBreakdown(projectId, storyId) as any
    }
    return promptBuilderClient.post<{ 
      suggestions: Array<{
        title: string
        description: string
        estimatedPoints: number
        priority: 'low' | 'medium' | 'high' | 'critical'
      }>
    }>(`/projects/${projectId}/stories/${storyId}/suggest-breakdown`)
  },

  // AI-Powered Task Analysis
  async analyzeTask(projectId: string, storyId: string, taskId: string): Promise<TaskAnalysis> {
    return promptBuilderClient.post<TaskAnalysis>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/analyze`)
  },

  async generateTaskPrompt(projectId: string, storyId: string, taskId: string, options?: {
    includeContext?: boolean
    includeConstraints?: boolean
    includeExamples?: boolean
  }): Promise<{ prompt: string }> {
    return promptBuilderClient.post<{ prompt: string }>(
      `/projects/${projectId}/stories/${storyId}/tasks/${taskId}/generate-prompt`,
      options
    )
  },

  async clarifyTaskRequirements(projectId: string, storyId: string, taskId: string, questions?: string[]): Promise<{
    clarifications: Array<{
      question: string
      answer: string
      confidence: number
    }>
  }> {
    if (useMockData) {
      return mockAI.clarifyTaskRequirements(projectId, storyId, taskId) as any
    }
    return promptBuilderClient.post<{
      clarifications: Array<{
        question: string
        answer: string
        confidence: number
      }>
    }>(`/projects/${projectId}/stories/${storyId}/tasks/${taskId}/clarify`, { questions })
  },

  // New AI features for enhanced functionality
  async suggestSprintPlanning(projectId: string): Promise<{
    suggestions: Array<{
      title: string
      description: string
      confidence: number
      velocity: number
      capacity: string
    }>
  }> {
    if (useMockData) {
      return mockAI.suggestSprintPlanning(projectId) as any
    }
    return promptBuilderClient.post<{
      suggestions: Array<{
        title: string
        description: string
        confidence: number
        velocity: number
        capacity: string
      }>
    }>(`/projects/${projectId}/sprint-planning-suggestions`)
  },

  async predictVelocity(projectId: string): Promise<{
    predictedVelocity: number
    confidence: number
    accuracy: string
    recommendations: {
      focus: string
      riskMitigation: string
    }
  }> {
    if (useMockData) {
      return mockAI.predictVelocity(projectId)
    }
    return promptBuilderClient.post<{
      predictedVelocity: number
      confidence: number
      accuracy: string
      recommendations: {
        focus: string
        riskMitigation: string
      }
    }>(`/projects/${projectId}/velocity-prediction`)
  },

  async analyzeRisks(projectId: string, storyId?: string): Promise<{
    risks: Array<{
      title: string
      category: string
      severity: string
      probability: string
      description: string
      impact: string
      mitigation: string
      confidence: number
    }>
  }> {
    if (useMockData) {
      return mockAI.analyzeRisks(projectId, storyId) as any
    }
    const endpoint = storyId 
      ? `/projects/${projectId}/stories/${storyId}/risk-analysis`
      : `/projects/${projectId}/risk-analysis`
    return promptBuilderClient.post<{
      risks: Array<{
        title: string
        category: string
        severity: string
        probability: string
        description: string
        impact: string
        mitigation: string
        confidence: number
      }>
    }>(endpoint)
  }
}