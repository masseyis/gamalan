import type { StoryAnalysisSummary, TaskSuggestion } from '../types/task-readiness'

const READINESS_API_URL = process.env.NEXT_PUBLIC_READINESS_API_URL || 'http://localhost:8000/api/v1/readiness'

/**
 * Get story-level task readiness analysis summary
 */
export async function getStoryAnalysisSummary(
  storyId: string
): Promise<StoryAnalysisSummary> {
  const response = await fetch(`${READINESS_API_URL}/stories/${storyId}/analysis-summary`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch story analysis: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Trigger analysis for all tasks in a story
 */
export async function analyzeStoryTasks(storyId: string): Promise<void> {
  const response = await fetch(`${READINESS_API_URL}/stories/${storyId}/analyze-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to analyze story tasks: ${response.statusText}`)
  }
}

/**
 * Get AI-generated task suggestions for a story
 */
export async function suggestTasksForStory(storyId: string): Promise<void> {
  const response = await fetch(`${READINESS_API_URL}/stories/${storyId}/suggest-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to generate task suggestions: ${response.statusText}`)
  }
}

/**
 * Get pending task suggestions for a story
 */
export async function getPendingSuggestions(storyId: string): Promise<TaskSuggestion[]> {
  const response = await fetch(`${READINESS_API_URL}/stories/${storyId}/suggestions`, {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Approve a task suggestion
 */
export async function approveSuggestion(
  suggestionId: string,
  reviewedBy: string
): Promise<void> {
  const response = await fetch(`${READINESS_API_URL}/suggestions/${suggestionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reviewedBy }),
  })

  if (!response.ok) {
    throw new Error(`Failed to approve suggestion: ${response.statusText}`)
  }
}

export const readinessApi = {
  getStoryAnalysisSummary,
  analyzeStoryTasks,
  suggestTasksForStory,
  getPendingSuggestions,
  approveSuggestion,
}
