'use client'

import React from 'react'
import { BarChart3, CheckCircle, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  type StoryAnalysisSummaryProps,
  CLARITY_SCORE_THRESHOLDS,
  AI_READY_THRESHOLD,
} from '@/lib/types/task-readiness'
import { useQuery } from '@tanstack/react-query'
import { readinessApi } from '@/lib/api/readiness'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Get color class for clarity score based on thresholds
 */
function getClarityScoreColor(score: number): string {
  if (score >= CLARITY_SCORE_THRESHOLDS.GOOD) {
    return 'text-green-600'
  }
  if (score >= CLARITY_SCORE_THRESHOLDS.FAIR) {
    return 'text-yellow-600'
  }
  return 'text-red-600'
}

/**
 * Get background color class for clarity score badge
 */
function getClarityScoreBgColor(score: number): string {
  if (score >= CLARITY_SCORE_THRESHOLDS.GOOD) {
    return 'bg-green-100'
  }
  if (score >= CLARITY_SCORE_THRESHOLDS.FAIR) {
    return 'bg-yellow-100'
  }
  return 'bg-red-100'
}

/**
 * Story Analysis Summary Component
 */
export function StoryAnalysisSummary({
  storyId,
  onAnalyzeAll,
  onSuggestTasks,
  className,
}: StoryAnalysisSummaryProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { data: summary, refetch } = useQuery({
    queryKey: ['story-analysis-summary', storyId],
    queryFn: () => readinessApi.getStoryAnalysisSummary(storyId),
    retry: false,
  })

  // Handle analyze all action
  const handleAnalyzeAll = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (onAnalyzeAll) {
        await onAnalyzeAll()
      } else {
        await readinessApi.analyzeStoryTasks(storyId)
      }
      // Refetch summary after analysis
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze tasks')
    } finally {
      setIsLoading(false)
    }
  }, [onAnalyzeAll, storyId, refetch, queryClient])

  // Handle suggest tasks action
  const handleSuggestTasks = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (onSuggestTasks) {
        await onSuggestTasks()
      } else {
        await readinessApi.suggestTasksForStory(storyId)
      }
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['task-suggestions', storyId] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest tasks')
    } finally {
      setIsLoading(false)
    }
  }, [onSuggestTasks, storyId, refetch, queryClient])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analyzing story...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-6 bg-red-50 border border-red-200 rounded-lg', className)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Analysis</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!summary || summary.totalTasks === 0) {
    return (
      <div className={cn('p-8 text-center bg-muted/50 border rounded-lg', className)}>
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-1">No Tasks Yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add tasks to this story to analyze their readiness for AI agents.
        </p>
        {onSuggestTasks && (
          <Button onClick={handleSuggestTasks}>
            <Sparkles className="w-4 h-4 mr-2" />
            Suggest Tasks
          </Button>
        )}
      </div>
    )
  }

  const {
    totalTasks,
    analyzedTasks,
    avgClarityScore,
    tasksAiReady,
    tasksNeedingImprovement,
    commonIssues,
  } = summary

  // Calculate analysis progress percentage
  const analysisProgress = totalTasks > 0 ? (analyzedTasks / totalTasks) * 100 : 0

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Task Readiness Analysis
              </CardTitle>
              <CardDescription className="mt-1">
                Task clarity and AI readiness metrics
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Analysis Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Analysis Progress</span>
              <span className="font-medium">
                {analyzedTasks} / {totalTasks} tasks
              </span>
            </div>
            <Progress value={analysisProgress} className="h-2" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Average Clarity Score */}
            {avgClarityScore !== null && (
              <div className={cn('flex items-center gap-3 p-4 rounded-lg border', getClarityScoreBgColor(avgClarityScore))}>
                <BarChart3 className="w-5 h-5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-muted-foreground">Avg. Clarity</div>
                  <div className={cn('text-2xl font-bold', getClarityScoreColor(avgClarityScore))}>
                    {avgClarityScore}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {avgClarityScore >= CLARITY_SCORE_THRESHOLDS.GOOD
                      ? 'Excellent'
                      : avgClarityScore >= CLARITY_SCORE_THRESHOLDS.FAIR
                      ? 'Fair'
                      : 'Needs work'}
                  </div>
                </div>
              </div>
            )}

            {/* AI-Ready Tasks */}
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              <CheckCircle className="w-5 h-5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-muted-foreground">AI-Ready</div>
                <div className="text-2xl font-bold">{tasksAiReady}</div>
                <div className="text-xs text-muted-foreground">Score ≥ {AI_READY_THRESHOLD}</div>
              </div>
            </div>

            {/* Tasks Needing Improvement */}
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              <AlertCircle className="w-5 h-5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-muted-foreground">Need Work</div>
                <div className="text-2xl font-bold">{tasksNeedingImprovement}</div>
                <div className="text-xs text-muted-foreground">Require attention</div>
              </div>
            </div>
          </div>

          {/* Common Issues */}
          {commonIssues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Common Issues</h3>
              <ul className="space-y-1 text-sm">
                {commonIssues.map((issue, index) => (
                  <li key={index} className="flex items-start gap-2 text-muted-foreground">
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            {onAnalyzeAll && (
              <Button
                onClick={handleAnalyzeAll}
                disabled={isLoading || analyzedTasks === totalTasks}
                variant="outline"
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                Analyze All Tasks
              </Button>
            )}

            {onSuggestTasks && (
              <Button onClick={handleSuggestTasks} disabled={isLoading} variant="outline">
                <Sparkles className="w-4 h-4 mr-2" />
                Suggest Tasks
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
