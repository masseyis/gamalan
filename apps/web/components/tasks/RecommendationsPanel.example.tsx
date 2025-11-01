/**
 * Example usage of RecommendationsPanel component
 *
 * This file demonstrates how to use the RecommendationsPanel component
 * to display task readiness analysis and recommendations.
 */

import React from 'react'
import { RecommendationsPanel } from './RecommendationsPanel'
import { TaskReadinessAnalysis } from '@/lib/types/task-readiness'

// Example 1: Well-defined task with excellent clarity score
export const ExcellentTaskExample = () => {
  const analysis: TaskReadinessAnalysis = {
    taskId: 'task-excellent-123',
    clarityScore: {
      score: 95,
      level: 'excellent',
    },
    vagueTerms: [],
    missingElements: [],
    technicalDetailRecommendations: [],
    acRecommendations: [],
    aiCompatibilityIssues: [],
    examples: [],
    recommendations: [],
    analyzedAt: new Date().toISOString(),
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Example: Well-Defined Task</h2>
      <RecommendationsPanel analysis={analysis} />
    </div>
  )
}

// Example 2: Task with multiple issues requiring improvement
export const NeedsImprovementTaskExample = () => {
  const analysis: TaskReadinessAnalysis = {
    taskId: 'task-needs-improvement-456',
    clarityScore: {
      score: 45,
      level: 'poor',
    },
    vagueTerms: [
      {
        term: 'implement',
        position: 0,
        suggestion: 'Specify what to implement: "Add authentication method to UserService"',
      },
      {
        term: 'fix',
        position: 20,
        suggestion: 'Describe the bug: "Fix null pointer exception in UserService.login()"',
      },
      {
        term: 'update',
        position: 45,
        suggestion: 'Be specific: "Update User.email field validation to accept plus signs"',
      },
    ],
    missingElements: [
      {
        category: 'technical-details',
        description: 'Missing file paths to modify',
        importance: 'critical',
        recommendation:
          'Add specific file paths like: src/services/UserService.ts, src/models/User.ts',
      },
      {
        category: 'technical-details',
        description: 'No function or method names specified',
        importance: 'high',
        recommendation: 'List specific functions to modify: UserService.authenticate()',
      },
      {
        category: 'acceptance-criteria',
        description: 'No acceptance criteria references',
        importance: 'critical',
        recommendation: 'Link to AC IDs like: ac-001, ac-002',
      },
      {
        category: 'dependencies',
        description: 'External dependencies not listed',
        importance: 'medium',
        recommendation: 'List required services, databases, or APIs',
      },
      {
        category: 'testing',
        description: 'Expected test coverage not defined',
        importance: 'high',
        recommendation: 'Specify unit tests, integration tests, and coverage expectations',
      },
    ],
    technicalDetailRecommendations: [
      {
        type: 'file-path',
        description: 'Add file paths to modify',
        example: 'src/services/auth/UserService.ts',
      },
      {
        type: 'function',
        description: 'Specify functions to create or modify',
        example: 'UserService.authenticate(email: string, password: string): Promise<User>',
      },
      {
        type: 'input-output',
        description: 'Define expected inputs and outputs',
        example: 'Input: { email, password }, Output: { user, token }',
      },
    ],
    acRecommendations: [
      {
        acId: 'ac-001',
        description: 'User can log in with valid credentials',
        relevance: 'high',
      },
      {
        acId: 'ac-002',
        description: 'System shows error for invalid credentials',
        relevance: 'high',
      },
    ],
    aiCompatibilityIssues: [
      'Missing clear success criteria - what defines "done"?',
      'No explicit dependencies listed - what services/APIs are needed?',
      'Expected test coverage not defined - what tests should pass?',
      'Environment setup not specified - what configuration is required?',
    ],
    examples: [
      {
        title: 'Add JWT token validation to AuthMiddleware',
        description:
          'Implement JWT validation in src/middleware/AuthMiddleware.ts using jsonwebtoken library. Validate token signature, expiration, and claims. Return 401 for invalid tokens.',
        source: 'project',
        projectId: 'proj-123',
        taskId: 'task-789',
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        category: 'technical-details',
        title: 'Add specific file paths',
        description: 'List all files that will be modified or created',
        priority: 'critical',
        actionable: true,
        autoApplyable: false,
      },
      {
        id: 'rec-2',
        category: 'technical-details',
        title: 'Specify function signatures',
        description: 'Define function names, parameters, and return types',
        priority: 'high',
        actionable: true,
        autoApplyable: false,
      },
      {
        id: 'rec-3',
        category: 'acceptance-criteria',
        title: 'Link acceptance criteria',
        description: 'Reference specific AC IDs this task addresses',
        priority: 'critical',
        actionable: true,
        autoApplyable: true,
      },
      {
        id: 'rec-4',
        category: 'ai-compatibility',
        title: 'Define success criteria',
        description: 'Specify what "done" means for this task',
        priority: 'high',
        actionable: true,
        autoApplyable: false,
      },
      {
        id: 'rec-5',
        category: 'ai-compatibility',
        title: 'List dependencies',
        description: 'Document required services, libraries, and APIs',
        priority: 'medium',
        actionable: true,
        autoApplyable: false,
      },
    ],
    analyzedAt: new Date().toISOString(),
  }

  const handleApplyRecommendation = (recommendationId: string) => {
    console.log('Applying recommendation:', recommendationId)
    // In a real app, this would trigger the recommendation application logic
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Example: Task Needing Improvement</h2>
      <RecommendationsPanel
        analysis={analysis}
        onApplyRecommendation={handleApplyRecommendation}
      />
    </div>
  )
}

// Example 3: Task with fair clarity - some improvements needed
export const FairTaskExample = () => {
  const analysis: TaskReadinessAnalysis = {
    taskId: 'task-fair-789',
    clarityScore: {
      score: 65,
      level: 'fair',
    },
    vagueTerms: [
      {
        term: 'add',
        position: 0,
        suggestion: 'Be specific: "Add email validation to User.create() method"',
      },
    ],
    missingElements: [
      {
        category: 'acceptance-criteria',
        description: 'No acceptance criteria references',
        importance: 'high',
        recommendation: 'Link to specific AC IDs',
      },
      {
        category: 'testing',
        description: 'Test requirements not specified',
        importance: 'medium',
        recommendation: 'Specify required unit and integration tests',
      },
    ],
    technicalDetailRecommendations: [],
    acRecommendations: [
      {
        acId: 'ac-003',
        description: 'Email validation follows RFC 5322 standard',
        relevance: 'high',
      },
    ],
    aiCompatibilityIssues: ['Expected test coverage not defined'],
    examples: [],
    recommendations: [
      {
        id: 'rec-1',
        category: 'vague-terms',
        title: 'Replace vague terms',
        description: 'Make language more specific and actionable',
        priority: 'medium',
        actionable: true,
        autoApplyable: false,
      },
      {
        id: 'rec-2',
        category: 'acceptance-criteria',
        title: 'Link to AC',
        description: 'Reference acceptance criteria this task addresses',
        priority: 'high',
        actionable: true,
        autoApplyable: true,
      },
    ],
    analyzedAt: new Date().toISOString(),
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Example: Task with Fair Clarity</h2>
      <RecommendationsPanel
        analysis={analysis}
        onApplyRecommendation={(id) => console.log('Apply:', id)}
      />
    </div>
  )
}
