import { readinessClient } from './client'
import type { StoryAnalysisSummary, TaskSuggestion } from '../types/task-readiness'

/**
 * Get story-level task readiness analysis summary
 */
export async function getStoryAnalysisSummary(
  storyId: string
): Promise<StoryAnalysisSummary> {
  return readinessClient.get<StoryAnalysisSummary>(`/stories/${storyId}/analysis-summary`)
}

/**
 * Trigger analysis for all tasks in a story
 */
export async function analyzeStoryTasks(storyId: string): Promise<void> {
  await readinessClient.post<void>(`/stories/${storyId}/analyze-tasks`)
}

/**
 * Get AI-generated task suggestions for a story
 */
export async function suggestTasksForStory(storyId: string): Promise<void> {
  await readinessClient.post<void>(`/stories/${storyId}/suggest-tasks`)
}

/**
 * Get pending task suggestions for a story
 */
export async function getPendingSuggestions(storyId: string): Promise<TaskSuggestion[]> {
  return readinessClient.get<TaskSuggestion[]>(`/stories/${storyId}/suggestions`)
}

/**
 * Approve a task suggestion
 */
export async function approveSuggestion(
  suggestionId: string,
  reviewedBy: string
): Promise<void> {
  await readinessClient.post<void>(`/suggestions/${suggestionId}/approve`, { reviewedBy })
}

export const readinessApi = {
  getStoryAnalysisSummary,
  analyzeStoryTasks,
  suggestTasksForStory,
  getPendingSuggestions,
  approveSuggestion,
}
