'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { TaskReadinessAnalysis } from '@/lib/types/task-readiness'
import { RecommendationsPanel } from './RecommendationsPanel'
import { backlogApi } from '@/lib/api/backlog'

export interface TaskAnalysisTriggerProps {
  taskId: string
  storyId: string
  projectId: string
  onAnalysisComplete?: (analysis: TaskReadinessAnalysis) => void
  className?: string
}

/**
 * Get color class for clarity score badge
 * - red < 40
 * - yellow 40-70
 * - green > 70
 */
const getClarityScoreColor = (score: number): string => {
  if (score < 40) {
    return 'bg-red-100 text-red-800 border-red-300'
  } else if (score <= 70) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  } else {
    return 'bg-green-100 text-green-800 border-green-300'
  }
}

/**
 * Get icon for clarity score
 */
const getClarityScoreIcon = (score: number) => {
  if (score < 40) {
    return <AlertCircle className="h-4 w-4" />
  } else if (score <= 70) {
    return <AlertCircle className="h-4 w-4" />
  } else {
    return <CheckCircle className="h-4 w-4" />
  }
}

/**
 * TaskAnalysisTrigger component
 *
 * Satisfies AC e0261453-8f72-4b08-8290-d8fb7903c869:
 * - Displays an "Analyze Task" button
 * - Shows loading state during analysis
 * - Displays clarity score with color coding (red<40, yellow 40-70, green>70)
 * - Shows specific recommendations for improvement
 */
export function TaskAnalysisTrigger({
  taskId,
  storyId,
  projectId,
  onAnalysisComplete,
  className,
}: TaskAnalysisTriggerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<TaskReadinessAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const result = await backlogApi.analyzeTaskReadiness(projectId, storyId, taskId)
      setAnalysis(result)
      onAnalysisComplete?.(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze task')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Analysis Trigger Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Task Readiness Analysis</h3>
              <p className="text-xs text-muted-foreground">
                Analyze this task for clarity and AI-agent compatibility
              </p>
            </div>

            <div className="flex items-center gap-3">
              {analysis && (
                <div
                  className="flex items-center gap-2"
                  data-testid="clarity-score-badge"
                >
                  <span className="text-xs text-muted-foreground font-medium">
                    Clarity Score
                  </span>
                  <Badge
                    className={cn(
                      'text-sm font-bold flex items-center gap-1.5',
                      getClarityScoreColor(analysis.clarityScore.score)
                    )}
                  >
                    {getClarityScoreIcon(analysis.clarityScore.score)}
                    {analysis.clarityScore.score}/100
                  </Badge>
                </div>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                size="sm"
                data-testid="analyze-task-button"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Task
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div
              className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2"
              data-testid="analysis-error"
            >
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Analysis Failed</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations Panel - shown after analysis */}
      {analysis && !isAnalyzing && (
        <div data-testid="recommendations-panel">
          <RecommendationsPanel analysis={analysis} />
        </div>
      )}
    </div>
  )
}
