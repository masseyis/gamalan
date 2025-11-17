/**
 * Task Recommendations Types
 *
 * Types for the task readiness analysis and recommendations panel component
 * Based on AC references:
 * - 81054dee-14c5-455f-a580-7d8870ba34ee: Missing technical details
 * - 30639999-a0b1-4381-b92b-173a7d946bc8: Vague/ambiguous language
 * - 5649e91e-043f-4097-916b-9907620bff3e: Missing AC references
 */

export type RecommendationSeverity = 'low' | 'medium' | 'high'

export type RecommendationCategory =
  | 'missing-technical-details'
  | 'vague-language'
  | 'missing-ac-references'
  | 'missing-success-criteria'
  | 'missing-dependencies'
  | 'missing-environment-setup'
  | 'missing-test-coverage'
  | 'missing-definition-of-done'

export interface VagueTerm {
  term: string
  position: number
  context: string
  suggestion: string
}

export interface MissingElement {
  element: string
  category: RecommendationCategory
  description: string
  importance: RecommendationSeverity
}

export interface Recommendation {
  id: string
  taskId: string
  category: RecommendationCategory
  severity: RecommendationSeverity
  title: string
  description: string
  suggestedAction: string
  impactScore: number // 0-100
  vagueTerm?: VagueTerm
  missingElement?: MissingElement
}

export interface CategorizedRecommendations {
  category: RecommendationCategory
  categoryLabel: string
  recommendations: Recommendation[]
  totalImpact: number
  isExpanded: boolean
}

export interface DimensionScore {
  dimension: 'technical' | 'specificity' | 'completeness' | 'testability'
  score: number // 0-100
  label: string
  description: string
}

export interface TaskClarityScore {
  score: number // 0-100
  level: 'poor' | 'fair' | 'good' | 'excellent'
  improvementPotential: number
  dimensions: DimensionScore[]
}

export interface TaskRecommendationsPanelProps {
  taskId: string
  taskDescription: string
  taskTitle?: string
  acReferences?: string[]
  onRecommendationApply?: (recommendationId: string) => void
  onEnhanceTask?: () => void
  className?: string
}

export interface TaskAnalysisData {
  clarityScore: TaskClarityScore
  recommendations: Recommendation[]
  categorizedRecommendations: CategorizedRecommendations[]
  vagueterms: VagueTerm[]
  missingElements: MissingElement[]
  analysisTimestamp: string
}
