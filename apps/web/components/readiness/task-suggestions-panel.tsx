'use client'

import React from 'react'
import {
  Sparkles,
  CheckCircle,
  XCircle,
  FileCode,
  Clock,
  Target,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TaskSuggestion, TaskSuggestionsPanelProps } from '@/lib/types/task-readiness'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readinessApi } from '@/lib/api/readiness'

/**
 * Get confidence score color based on value
 * - High: >= 0.8 (green)
 * - Medium: 0.6-0.79 (yellow)
 * - Low: < 0.6 (red)
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return 'text-green-600'
  }
  if (confidence >= 0.6) {
    return 'text-yellow-600'
  }
  return 'text-red-600'
}

/**
 * Get confidence badge variant
 */
function getConfidenceBadgeVariant(
  confidence: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (confidence >= 0.8) return 'default'
  if (confidence >= 0.6) return 'secondary'
  return 'destructive'
}

/**
 * Get confidence level label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High Confidence'
  if (confidence >= 0.6) return 'Medium Confidence'
  return 'Low Confidence'
}

/**
 * Task Suggestion Card Component
 */
interface TaskSuggestionCardProps {
  suggestion: TaskSuggestion
  onApprove: (suggestionId: string) => Promise<void>
  onReject: (suggestionId: string) => Promise<void>
  isLoading?: boolean
  currentUserId: string
}

function TaskSuggestionCard({
  suggestion,
  onApprove,
  onReject,
  isLoading = false,
  currentUserId,
}: TaskSuggestionCardProps) {
  const [actionLoading, setActionLoading] = React.useState<'approve' | 'reject' | null>(null)

  const handleApprove = async () => {
    setActionLoading('approve')
    try {
      await onApprove(suggestion.id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    setActionLoading('reject')
    try {
      await onReject(suggestion.id)
    } finally {
      setActionLoading(null)
    }
  }

  const isProcessing = isLoading || actionLoading !== null

  return (
    <div
      className="p-4 bg-background border rounded-lg hover:shadow-lg transition-shadow"
      data-testid="task-suggestion-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground mb-1" data-testid="suggestion-title">
            {suggestion.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getConfidenceBadgeVariant(suggestion.confidence)} data-testid="suggestion-confidence">
              <span className={getConfidenceColor(suggestion.confidence)}>
                {getConfidenceLabel(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
              </span>
            </Badge>
            {suggestion.estimatedHours && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="suggestion-estimated-hours">
                <Clock className="w-3 h-3" />
                {suggestion.estimatedHours}h
              </span>
            )}
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3" data-testid="suggestion-description">
        {suggestion.description}
      </p>

      {/* Relevant Files */}
      {suggestion.relevantFiles.length > 0 && (
        <div className="mb-3" data-testid="suggestion-relevant-files">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <FileCode className="w-3 h-3" />
            Relevant Files
          </div>
          <div className="flex flex-wrap gap-1">
            {suggestion.relevantFiles.map((file, index) => (
              <code
                key={index}
                className="text-xs bg-muted px-2 py-0.5 rounded border"
                data-testid="relevant-file-item"
              >
                {file}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Acceptance Criteria References */}
      {suggestion.acceptanceCriteriaRefs.length > 0 && (
        <div className="mb-3" data-testid="suggestion-ac-refs">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <Target className="w-3 h-3" />
            Acceptance Criteria
          </div>
          <div className="flex flex-wrap gap-1">
            {suggestion.acceptanceCriteriaRefs.map((acRef, index) => (
              <span
                key={index}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono"
                data-testid="ac-ref-item"
              >
                {acRef.substring(0, 8)}...
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <Button
          onClick={handleApprove}
          disabled={isProcessing}
          size="sm"
          data-testid="approve-suggestion-button"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Approve
        </Button>
        <Button
          onClick={handleReject}
          disabled={isProcessing}
          variant="secondary"
          size="sm"
          data-testid="reject-suggestion-button"
        >
          <XCircle className="w-4 h-4 mr-1" />
          Reject
        </Button>
      </div>
    </div>
  )
}

/**
 * Task Suggestions Panel Component
 */
export function TaskSuggestionsPanel({
  storyId,
  onSuggestionApproved,
  className,
}: TaskSuggestionsPanelProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch pending suggestions
  const { data: suggestions = [], refetch } = useQuery({
    queryKey: ['task-suggestions', storyId],
    queryFn: () => readinessApi.getPendingSuggestions(storyId),
    retry: false,
  })

  // Filter for pending suggestions only
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')

  // Handle approve action
  const handleApprove = React.useCallback(
    async (suggestionId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // For now, use a placeholder user ID - in production this would come from auth context
        await readinessApi.approveSuggestion(suggestionId, 'current-user-id')
        await refetch()
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        queryClient.invalidateQueries({ queryKey: ['story-analysis-summary', storyId] })

        if (onSuggestionApproved) {
          onSuggestionApproved(suggestionId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve suggestion')
      } finally {
        setIsLoading(false)
      }
    },
    [storyId, refetch, queryClient, onSuggestionApproved]
  )

  // Handle reject action
  const handleReject = React.useCallback(
    async (suggestionId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // Note: Backend doesn't have explicit reject endpoint yet,
        // for now we'll just remove from UI via refetch
        // TODO: Add reject endpoint to backend
        await refetch()
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject suggestion')
      } finally {
        setIsLoading(false)
      }
    },
    [refetch, queryClient]
  )

  // Loading state
  if (isLoading && pendingSuggestions.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading suggestions...</p>
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
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Suggestions</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (pendingSuggestions.length === 0) {
    return (
      <div className={cn('p-8 text-center bg-muted/50 border rounded-lg', className)}>
        <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold mb-1">No Pending Suggestions</h3>
        <p className="text-sm text-muted-foreground">
          All suggestions have been reviewed, or no suggestions are available yet.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Task Suggestions
              </CardTitle>
              <CardDescription className="mt-1">
                {pendingSuggestions.length} suggestion{pendingSuggestions.length !== 1 ? 's' : ''} pending review
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Info Banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">
              These tasks were generated by AI based on the story context and acceptance criteria. Review each
              suggestion carefully before approving.
            </p>
          </div>

          {/* Suggestions List */}
          {pendingSuggestions.map((suggestion) => (
            <TaskSuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApprove={handleApprove}
              onReject={handleReject}
              isLoading={isLoading}
              currentUserId="current-user-id"
            />
          ))}

          {/* Batch Actions */}
          {pendingSuggestions.length > 1 && (
            <div className="flex gap-2 pt-3 border-t">
              <Button
                onClick={async () => {
                  for (const suggestion of pendingSuggestions) {
                    await handleApprove(suggestion.id)
                  }
                }}
                disabled={isLoading}
                variant="secondary"
                size="sm"
                data-testid="approve-all-suggestions-button"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve All
              </Button>
              <Button
                onClick={async () => {
                  for (const suggestion of pendingSuggestions) {
                    await handleReject(suggestion.id)
                  }
                }}
                disabled={isLoading}
                variant="secondary"
                size="sm"
                data-testid="reject-all-suggestions-button"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
