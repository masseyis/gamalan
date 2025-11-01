'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Info, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import {
  TaskReadinessAnalysis,
  Recommendation,
  RecommendationCategory,
  VagueTerm,
  MissingElement,
} from '@/lib/types/task-readiness'

interface RecommendationsPanelProps {
  analysis: TaskReadinessAnalysis
  onApplyRecommendation?: (recommendationId: string) => void
  className?: string
}

interface CategorySection {
  category: RecommendationCategory
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const CATEGORY_SECTIONS: CategorySection[] = [
  {
    category: 'technical-details',
    title: 'Technical Details',
    description: 'Specific files, functions, and technical approaches needed',
    icon: Info,
    color: 'text-blue-600',
  },
  {
    category: 'vague-terms',
    title: 'Vague Terms',
    description: 'Ambiguous language that should be clarified',
    icon: AlertCircle,
    color: 'text-amber-600',
  },
  {
    category: 'acceptance-criteria',
    title: 'Acceptance Criteria',
    description: 'Links to specific acceptance criteria this task addresses',
    icon: CheckCircle,
    color: 'text-green-600',
  },
  {
    category: 'ai-compatibility',
    title: 'AI Agent Compatibility',
    description: 'Requirements for AI agent to execute this task',
    icon: Lightbulb,
    color: 'text-purple-600',
  },
  {
    category: 'examples',
    title: 'Well-Defined Examples',
    description: 'Similar well-defined tasks from this project or domain',
    icon: Lightbulb,
    color: 'text-indigo-600',
  },
]

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getClarityScoreColor = (level: string): string => {
  switch (level) {
    case 'excellent':
      return 'text-green-600'
    case 'good':
      return 'text-blue-600'
    case 'fair':
      return 'text-yellow-600'
    case 'poor':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

const CollapsibleSection: React.FC<{
  section: CategorySection
  recommendations: Recommendation[]
  vagueTerms?: VagueTerm[]
  missingElements?: MissingElement[]
  aiCompatibilityIssues?: string[]
  onApplyRecommendation?: (recommendationId: string) => void
}> = ({
  section,
  recommendations,
  vagueTerms = [],
  missingElements = [],
  aiCompatibilityIssues = [],
  onApplyRecommendation,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = section.icon
  const hasContent =
    recommendations.length > 0 ||
    vagueTerms.length > 0 ||
    missingElements.length > 0 ||
    aiCompatibilityIssues.length > 0

  if (!hasContent) {
    return null
  }

  const itemCount =
    recommendations.length +
    vagueTerms.length +
    missingElements.length +
    aiCompatibilityIssues.length

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <Icon className={cn('h-5 w-5', section.color)} />
          <div className="text-left">
            <h3 className="font-semibold text-sm">{section.title}</h3>
            <p className="text-xs text-gray-500">{section.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto">
          {itemCount}
        </Badge>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t space-y-3">
          {/* Regular recommendations */}
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-md p-3 border border-gray-200 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{rec.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                </div>
                <Badge className={cn('text-xs', getPriorityColor(rec.priority))}>
                  {rec.priority}
                </Badge>
              </div>
              {rec.actionable && onApplyRecommendation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplyRecommendation(rec.id)}
                  className="text-xs"
                >
                  {rec.autoApplyable ? 'Apply Automatically' : 'View Details'}
                </Button>
              )}
            </div>
          ))}

          {/* Vague terms (for vague-terms category) */}
          {section.category === 'vague-terms' &&
            vagueTerms.map((term, index) => (
              <div
                key={`vague-${index}`}
                className="bg-amber-50 rounded-md p-3 border border-amber-200 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <code className="font-mono text-sm font-semibold text-amber-900">
                    {term.term}
                  </code>
                </div>
                <p className="text-sm text-amber-800 ml-6">
                  <span className="font-medium">Suggestion:</span> {term.suggestion}
                </p>
              </div>
            ))}

          {/* Missing elements (for technical-details or acceptance-criteria categories) */}
          {(section.category === 'technical-details' ||
            section.category === 'acceptance-criteria') &&
            missingElements
              .filter((el) => {
                if (section.category === 'technical-details') {
                  return el.category === 'technical-details'
                }
                if (section.category === 'acceptance-criteria') {
                  return el.category === 'acceptance-criteria'
                }
                return false
              })
              .map((element, index) => (
                <div
                  key={`missing-${index}`}
                  className={cn(
                    'rounded-md p-3 border space-y-1',
                    element.importance === 'critical' || element.importance === 'high'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      className={cn(
                        'h-4 w-4',
                        element.importance === 'critical' || element.importance === 'high'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                      )}
                    />
                    <span className="font-medium text-sm">{element.description}</span>
                    <Badge
                      className={cn('text-xs ml-auto', getPriorityColor(element.importance))}
                    >
                      {element.importance}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 ml-6">{element.recommendation}</p>
                </div>
              ))}

          {/* AI compatibility issues */}
          {section.category === 'ai-compatibility' &&
            aiCompatibilityIssues.map((issue, index) => (
              <div
                key={`ai-issue-${index}`}
                className="bg-purple-50 rounded-md p-3 border border-purple-200 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-purple-900">{issue}</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  analysis,
  onApplyRecommendation,
  className,
}) => {
  const getCategoryRecommendations = (category: RecommendationCategory): Recommendation[] => {
    return analysis.recommendations.filter((rec) => rec.category === category)
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Task Readiness Analysis</CardTitle>
            <CardDescription>
              Recommendations to improve task clarity and AI compatibility
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-600">Clarity Score</div>
            <div
              className={cn(
                'text-3xl font-bold',
                getClarityScoreColor(analysis.clarityScore.level)
              )}
            >
              {analysis.clarityScore.score}
              <span className="text-sm font-normal text-gray-500">/100</span>
            </div>
            <div className="text-xs text-gray-500 capitalize">{analysis.clarityScore.level}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {CATEGORY_SECTIONS.map((section) => {
          const recommendations = getCategoryRecommendations(section.category)
          const vagueTerms = section.category === 'vague-terms' ? analysis.vagueTerms : []
          const missingElements =
            section.category === 'technical-details' || section.category === 'acceptance-criteria'
              ? analysis.missingElements
              : []
          const aiCompatibilityIssues =
            section.category === 'ai-compatibility' ? analysis.aiCompatibilityIssues : []

          return (
            <CollapsibleSection
              key={section.category}
              section={section}
              recommendations={recommendations}
              vagueTerms={vagueTerms}
              missingElements={missingElements}
              aiCompatibilityIssues={aiCompatibilityIssues}
              onApplyRecommendation={onApplyRecommendation}
            />
          )
        })}

        {analysis.recommendations.length === 0 &&
          analysis.vagueTerms.length === 0 &&
          analysis.missingElements.length === 0 &&
          analysis.aiCompatibilityIssues.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">No recommendations</p>
              <p className="text-sm">This task is well-defined and ready!</p>
            </div>
          )}
      </CardContent>
    </Card>
  )
}
