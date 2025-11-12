'use client'

/**
 * Task Recommendations Panel Component
 *
 * Displays categorized recommendations for task readiness improvement.
 * Implements acceptance criteria:
 * - e0261453: Display clarity score
 * - 81054dee: Highlight missing technical details
 * - 30639999: Flag vague/ambiguous language
 * - 5649e91e: Recommend AC references
 * - 3f42fa09: AI agent compatibility check
 * - bbd83897: One-click apply recommendations
 */

import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SalungaCard, SalungaCardHeader, SalungaCardBody } from './card-layout'
import { SalungaBadge } from './badge-variants'
import { TaskClarityScoreVisualization } from './task-clarity-score'
import {
  type TaskRecommendationsPanelProps,
  type TaskAnalysisData,
  type CategorizedRecommendations,
  type Recommendation,
  type RecommendationSeverity,
  type RecommendationCategory,
} from '@/types/task-recommendations'

/**
 * Get severity badge variant based on severity level
 */
function getSeverityVariant(severity: RecommendationSeverity): 'success' | 'warning' | 'error' {
  switch (severity) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'error'
  }
}

/**
 * Get clarity score level and color based on score
 */
function getClarityLevel(score: number): {
  level: string
  color: string
  bgColor: string
} {
  if (score >= 85) {
    return { level: 'Excellent', color: 'text-salunga-success', bgColor: 'bg-salunga-success/10' }
  }
  if (score >= 70) {
    return { level: 'Good', color: 'text-salunga-primary', bgColor: 'bg-salunga-primary/10' }
  }
  if (score >= 50) {
    return { level: 'Fair', color: 'text-salunga-warning', bgColor: 'bg-salunga-warning/10' }
  }
  return { level: 'Poor', color: 'text-salunga-danger', bgColor: 'bg-salunga-danger/10' }
}

/**
 * Category labels for display
 */
const categoryLabels: Record<RecommendationCategory, string> = {
  'missing-technical-details': 'Missing Technical Details',
  'vague-language': 'Vague Language',
  'missing-ac-references': 'Missing AC References',
  'missing-success-criteria': 'Missing Success Criteria',
  'missing-dependencies': 'Missing Dependencies',
  'missing-environment-setup': 'Missing Environment Setup',
  'missing-test-coverage': 'Missing Test Coverage',
  'missing-definition-of-done': 'Missing Definition of Done',
}

/**
 * Category icons
 */
function getCategoryIcon(category: RecommendationCategory) {
  switch (category) {
    case 'vague-language':
      return <AlertCircle className="w-5 h-5" />
    case 'missing-ac-references':
    case 'missing-success-criteria':
      return <CheckCircle className="w-5 h-5" />
    default:
      return <Info className="w-5 h-5" />
  }
}

/**
 * Clarity Score Display Component
 */
function ClarityScoreDisplay({ score }: { score: number }) {
  const { level, color, bgColor } = getClarityLevel(score)

  return (
    <div className="flex items-center justify-between p-4 rounded-salunga-lg border border-salunga-border bg-salunga-bg-secondary">
      <div className="flex-1">
        <div className="text-sm font-medium text-salunga-fg-secondary mb-1" data-testid="clarity-score-label">
          Task Clarity Score
        </div>
        <div className={cn('text-3xl font-bold', color)} data-testid="clarity-score-value">
          {score}%
        </div>
        <div className={cn('text-sm font-medium mt-1', color)}>{level}</div>
      </div>
      <div
        className={cn('flex items-center justify-center w-20 h-20 rounded-full', bgColor)}
        data-testid="clarity-score"
      >
        <svg className="w-16 h-16 transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-salunga-border"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 28}`}
            strokeDashoffset={`${2 * Math.PI * 28 * (1 - score / 100)}`}
            className={color}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

/**
 * Vague Term Highlight Component
 */
function VagueTermHighlight({
  term,
  context,
  suggestion,
}: {
  term: string
  context: string
  suggestion: string
}) {
  return (
    <div className="mt-2 p-3 bg-salunga-warning/5 border border-salunga-warning/20 rounded-salunga-md">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-salunga-warning mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium text-salunga-fg" data-testid="vague-term-highlight">
            Vague term: <span className="font-mono bg-salunga-warning/20 px-1 rounded">{term}</span>
          </div>
          <div className="text-xs text-salunga-fg-secondary mt-1">Context: "{context}"</div>
          <div
            className="text-xs text-salunga-success mt-1 font-medium"
            data-testid="vague-term-suggestion"
          >
            Suggestion: {suggestion}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Missing Element Highlight Component
 */
function MissingElementHighlight({ element, description }: { element: string; description: string }) {
  return (
    <div className="mt-2 p-3 bg-salunga-danger/5 border border-salunga-danger/20 rounded-salunga-md">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-salunga-danger mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium text-salunga-fg" data-testid="missing-element">
            Missing: {element}
          </div>
          <div className="text-xs text-salunga-fg-secondary mt-1">{description}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Recommendation Item Component
 */
function RecommendationItem({
  recommendation,
  onApply,
}: {
  recommendation: Recommendation
  onApply?: (id: string) => void
}) {
  return (
    <div className="p-4 bg-salunga-bg border border-salunga-border rounded-salunga-md hover:shadow-salunga-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SalungaBadge variant={getSeverityVariant(recommendation.severity)} data-testid="severity-badge">
              {recommendation.severity}
            </SalungaBadge>
            {recommendation.impactScore > 0 && (
              <span className="text-xs text-salunga-fg-muted" data-testid="impact-score">
                Impact: +{recommendation.impactScore}%
              </span>
            )}
          </div>
          <h4 className="font-medium text-salunga-fg mb-1">{recommendation.title}</h4>
          <p className="text-sm text-salunga-fg-secondary mb-2">{recommendation.description}</p>
          {recommendation.suggestedAction && (
            <div className="text-sm text-salunga-primary font-medium">
              → {recommendation.suggestedAction}
            </div>
          )}

          {/* Vague term details */}
          {recommendation.vagueTerm && (
            <VagueTermHighlight
              term={recommendation.vagueTerm.term}
              context={recommendation.vagueTerm.context}
              suggestion={recommendation.vagueTerm.suggestion}
            />
          )}

          {/* Missing element details */}
          {recommendation.missingElement && (
            <MissingElementHighlight
              element={recommendation.missingElement.element}
              description={recommendation.missingElement.description}
            />
          )}
        </div>

        {onApply && (
          <button
            onClick={() => onApply(recommendation.id)}
            className="px-3 py-1.5 text-sm font-medium text-salunga-primary hover:bg-salunga-primary/10 rounded-salunga-md transition-colors"
            data-testid="apply-recommendation-button"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Category Section Component (Expandable)
 */
function CategorySection({
  category,
  onToggle,
  onApply,
}: {
  category: CategorizedRecommendations
  onToggle: () => void
  onApply?: (id: string) => void
}) {
  const Icon = getCategoryIcon(category.category)

  return (
    <div
      className="border border-salunga-border rounded-salunga-lg overflow-hidden"
      data-testid={`recommendation-category-${category.category}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-salunga-bg-secondary hover:bg-salunga-bg-muted transition-colors"
        data-testid="expand-category-button"
      >
        <div className="flex items-center gap-3">
          <div className="text-salunga-primary">{Icon}</div>
          <div className="text-left">
            <h3 className="font-semibold text-salunga-fg" data-testid="category-label">
              {categoryLabels[category.category]}
            </h3>
            <p className="text-sm text-salunga-fg-muted">
              {category.recommendations.length} recommendation
              {category.recommendations.length !== 1 ? 's' : ''}
              {category.totalImpact > 0 && (
                <span data-testid="category-total-impact"> • +{category.totalImpact}% potential</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {category.isExpanded ? (
            <ChevronDown className="w-5 h-5 text-salunga-fg-muted" />
          ) : (
            <ChevronRight className="w-5 h-5 text-salunga-fg-muted" />
          )}
        </div>
      </button>

      {category.isExpanded && (
        <div className="p-4 bg-salunga-bg space-y-3" data-testid="category-content">
          {category.recommendations.map((rec) => (
            <RecommendationItem key={rec.id} recommendation={rec} onApply={onApply} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * AI Compatibility Check Component
 */
function AICompatibilityCheck({ checks }: { checks: Record<string, boolean> }) {
  const checkItems = [
    { key: 'successCriteria', label: 'Clear Success Criteria', testId: 'check-success-criteria' },
    { key: 'dependencies', label: 'Explicit Dependencies', testId: 'check-dependencies' },
    { key: 'environment', label: 'Environment Setup', testId: 'check-environment' },
    { key: 'testCoverage', label: 'Test Coverage Expectations', testId: 'check-test-coverage' },
    { key: 'definitionOfDone', label: 'Definition of Done', testId: 'check-definition-done' },
  ]

  return (
    <div
      className="p-4 bg-salunga-bg-secondary border border-salunga-border rounded-salunga-lg"
      data-testid="ai-compatibility-check"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-salunga-accent" />
        <h3 className="font-semibold text-salunga-fg">AI Agent Compatibility</h3>
      </div>
      <div className="space-y-2">
        {checkItems.map((item) => (
          <div key={item.key} className="flex items-center gap-2" data-testid={item.testId}>
            {checks[item.key] ? (
              <CheckCircle className="w-4 h-4 text-salunga-success" />
            ) : (
              <AlertCircle className="w-4 h-4 text-salunga-danger" />
            )}
            <span className={cn('text-sm', checks[item.key] ? 'text-salunga-fg' : 'text-salunga-fg-muted')}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Main Task Recommendations Panel Component
 */
export function TaskRecommendationsPanel({
  taskId,
  taskDescription,
  taskTitle,
  acReferences = [],
  onRecommendationApply,
  onEnhanceTask,
  className,
}: TaskRecommendationsPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState<TaskAnalysisData | null>(null)

  // State for expandable sections
  const [expandedCategories, setExpandedCategories] = useState<Set<RecommendationCategory>>(
    new Set()
  )

  // Mock data for demonstration (in production, this would come from API)
  const mockAnalysisData: TaskAnalysisData = useMemo(() => {
    const mockRecommendations: Recommendation[] = [
      {
        id: '1',
        taskId,
        category: 'missing-technical-details',
        severity: 'high',
        title: 'Add specific file paths to modify',
        description: 'Task should specify which files need to be created or modified',
        suggestedAction: 'Add file paths like src/components/TaskPanel.tsx',
        impactScore: 25,
        missingElement: {
          element: 'File paths',
          category: 'missing-technical-details',
          description: 'Specify exact files to create or modify',
          importance: 'high',
        },
      },
      {
        id: '2',
        taskId,
        category: 'vague-language',
        severity: 'medium',
        title: 'Replace vague term: "create"',
        description: 'The term "create" is too vague without specific implementation details',
        suggestedAction: 'Replace with "Implement React component with props X, Y, Z"',
        impactScore: 15,
        vagueTerm: {
          term: 'create',
          position: 0,
          context: 'Create recommendations panel component',
          suggestion: 'Implement React component with categorized sections, expandable UI, and severity badges',
        },
      },
      {
        id: '3',
        taskId,
        category: 'missing-ac-references',
        severity: 'high',
        title: 'Link to specific acceptance criteria',
        description: acReferences.length === 0
          ? 'Task has no AC references'
          : `Task references ${acReferences.length} ACs but could be more specific`,
        suggestedAction: 'Add AC IDs: 81054dee, 30639999, 5649e91e',
        impactScore: 20,
      },
    ]

    const categorized: CategorizedRecommendations[] = []
    const categoryMap = new Map<RecommendationCategory, Recommendation[]>()

    mockRecommendations.forEach((rec) => {
      const existing = categoryMap.get(rec.category) || []
      categoryMap.set(rec.category, [...existing, rec])
    })

    categoryMap.forEach((recommendations, category) => {
      categorized.push({
        category,
        categoryLabel: categoryLabels[category],
        recommendations,
        totalImpact: recommendations.reduce((sum, r) => sum + r.impactScore, 0),
        isExpanded: expandedCategories.has(category),
      })
    })

    return {
      clarityScore: {
        score: 65,
        level: 'fair',
        improvementPotential: 35,
        dimensions: [
          {
            dimension: 'technical',
            score: 60,
            label: 'Technical Details',
            description: 'Includes file paths, functions, and technical approach',
          },
          {
            dimension: 'specificity',
            score: 70,
            label: 'Specificity',
            description: 'Uses concrete actions with measurable outcomes',
          },
          {
            dimension: 'completeness',
            score: 65,
            label: 'Completeness',
            description: 'Has necessary context and dependencies',
          },
          {
            dimension: 'testability',
            score: 65,
            label: 'Testability',
            description: 'Includes clear success criteria and test coverage',
          },
        ],
      },
      recommendations: mockRecommendations,
      categorizedRecommendations: categorized,
      vagueterms: mockRecommendations
        .filter((r) => r.vagueTerm)
        .map((r) => r.vagueTerm!),
      missingElements: mockRecommendations
        .filter((r) => r.missingElement)
        .map((r) => r.missingElement!),
      analysisTimestamp: new Date().toISOString(),
    }
  }, [taskId, acReferences, expandedCategories])

  // Toggle category expansion
  const toggleCategory = (category: RecommendationCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Update categorized recommendations when expansion state changes
  const updatedCategories = useMemo(() => {
    return mockAnalysisData.categorizedRecommendations.map((cat) => ({
      ...cat,
      isExpanded: expandedCategories.has(cat.category),
    }))
  }, [mockAnalysisData, expandedCategories])

  // AI compatibility checks (mock)
  const aiCompatibilityChecks = {
    successCriteria: acReferences.length > 0,
    dependencies: taskDescription.toLowerCase().includes('depend'),
    environment: taskDescription.toLowerCase().includes('env'),
    testCoverage: taskDescription.toLowerCase().includes('test'),
    definitionOfDone: taskDescription.toLowerCase().includes('done'),
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        data-testid="recommendations-loading"
      >
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-salunga-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-salunga-fg-muted">Analyzing task...</p>
        </div>
      </div>
    )
  }

  const hasRecommendations = mockAnalysisData.recommendations.length > 0

  return (
    <div className={cn('space-y-4', className)} data-testid="task-recommendations-panel">
      <SalungaCard>
        <SalungaCardHeader>
          <h2 className="text-xl font-bold text-salunga-fg">Task Readiness Analysis</h2>
          {taskTitle && <p className="text-sm text-salunga-fg-muted mt-1">{taskTitle}</p>}
        </SalungaCardHeader>
        <SalungaCardBody className="space-y-4">
          {/* Clarity Score */}
          <TaskClarityScoreVisualization
            clarityScore={mockAnalysisData.clarityScore}
            showDimensions={true}
          />

          {/* AI Compatibility Check */}
          <AICompatibilityCheck checks={aiCompatibilityChecks} />

          {/* Recommendations */}
          {hasRecommendations ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-salunga-fg">Recommendations</h3>
                {onEnhanceTask && (
                  <button
                    onClick={onEnhanceTask}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-salunga-accent hover:bg-salunga-accent/90 rounded-salunga-md transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Enhance
                  </button>
                )}
              </div>

              {updatedCategories.map((category) => (
                <CategorySection
                  key={category.category}
                  category={category}
                  onToggle={() => toggleCategory(category.category)}
                  onApply={onRecommendationApply}
                />
              ))}
            </div>
          ) : (
            <div
              className="p-8 text-center bg-salunga-success/5 border border-salunga-success/20 rounded-salunga-lg"
              data-testid="no-recommendations"
            >
              <CheckCircle className="w-12 h-12 text-salunga-success mx-auto mb-3" />
              <h3 className="font-semibold text-salunga-fg mb-1">Task is Well-Defined!</h3>
              <p className="text-sm text-salunga-fg-muted">
                No recommendations needed. This task meets all readiness criteria.
              </p>
            </div>
          )}
        </SalungaCardBody>
      </SalungaCard>
    </div>
  )
}

/**
 * Showcase Component for Brand Page
 */
export function TaskRecommendationsPanelShowcase() {
  const handleApply = (id: string) => {
    console.log('Apply recommendation:', id)
  }

  const handleEnhance = () => {
    console.log('AI Enhance task')
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-salunga-fg mb-2">Task Recommendations Panel</h2>
        <p className="text-salunga-fg-secondary">
          Display categorized recommendations with clarity score, missing elements highlighting, and
          expandable sections.
        </p>
      </div>

      <TaskRecommendationsPanel
        taskId="task-123"
        taskTitle="Create recommendations panel component"
        taskDescription="Display categorized recommendations. Highlight missing elements. Show flagged vague terms. Expandable sections."
        acReferences={['81054dee-14c5-455f-a580-7d8870ba34ee', '30639999-a0b1-4381-b92b-173a7d946bc8']}
        onRecommendationApply={handleApply}
        onEnhanceTask={handleEnhance}
      />
    </div>
  )
}
