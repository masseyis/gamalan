'use client'

/**
 * Task Clarity Score Visualization Component
 *
 * Displays clarity score with gauge/progress bar and dimension breakdown
 * AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869
 *
 * Task: 834c29df-ae4b-49c1-ad9a-baae18d29812
 */

import * as React from 'react'
import { TaskClarityScore, DimensionScore } from '@/types/task-recommendations'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface TaskClarityScoreProps {
  clarityScore: TaskClarityScore
  showDimensions?: boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function getProgressColor(score: number): string {
  if (score >= 80) return 'bg-green-600'
  if (score >= 60) return 'bg-yellow-600'
  if (score >= 40) return 'bg-orange-600'
  return 'bg-red-600'
}

function getDimensionLabel(dimension: DimensionScore['dimension']): string {
  const labels: Record<DimensionScore['dimension'], string> = {
    technical: 'Technical Details',
    specificity: 'Specificity',
    completeness: 'Completeness',
    testability: 'Testability',
  }
  return labels[dimension]
}

function getDimensionDescription(dimension: DimensionScore['dimension']): string {
  const descriptions: Record<DimensionScore['dimension'], string> = {
    technical:
      'Includes file paths, functions, components, inputs/outputs, and technical approach',
    specificity: 'Uses concrete actions with measurable outcomes instead of vague language',
    completeness:
      'Has all necessary context including dependencies, environment setup, and definition of done',
    testability: 'Includes clear success criteria, expected test coverage, and validation approach',
  }
  return descriptions[dimension]
}

export function TaskClarityScoreVisualization({
  clarityScore,
  showDimensions = true,
  className,
}: TaskClarityScoreProps) {
  const { score, level, dimensions = [] } = clarityScore

  return (
    <div className={cn('space-y-4', className)} data-testid="clarity-score-visualization">
      {/* Score Gauge */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Clarity Score</h3>
          <span
            className={cn('text-2xl font-bold', getScoreColor(score))}
            data-testid="clarity-score"
          >
            {score}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <Progress value={score} className="h-2" data-testid="clarity-score-progress" />
          <div
            className={cn(
              'absolute inset-0 h-2 rounded-full transition-all',
              getProgressColor(score)
            )}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="capitalize">{level}</span>
          <span>100</span>
        </div>
      </div>

      {/* Dimension Breakdown */}
      {showDimensions && dimensions.length > 0 && (
        <div className="space-y-3" data-testid="dimension-breakdown">
          <h4 className="text-sm font-medium">Dimension Breakdown</h4>
          <div className="space-y-2">
            {dimensions.map((dimension) => (
              <TooltipProvider key={dimension.dimension}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="space-y-1"
                      data-testid={`dimension-${dimension.dimension}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {getDimensionLabel(dimension.dimension)}
                        </span>
                        <span
                          className={cn('font-medium', getScoreColor(dimension.score))}
                          data-testid={`dimension-${dimension.dimension}-score`}
                        >
                          {dimension.score}
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={dimension.score}
                          className="h-1.5"
                          data-testid={`dimension-${dimension.dimension}-progress`}
                        />
                        <div
                          className={cn(
                            'absolute inset-0 h-1.5 rounded-full transition-all',
                            getProgressColor(dimension.score)
                          )}
                          style={{ width: `${dimension.score}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="max-w-xs"
                    data-testid={`dimension-${dimension.dimension}-tooltip`}
                  >
                    <p className="font-medium mb-1">{getDimensionLabel(dimension.dimension)}</p>
                    <p className="text-xs text-muted-foreground">
                      {dimension.description || getDimensionDescription(dimension.dimension)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
