/**
 * Task Readiness Analysis Types
 *
 * These types support the Task Readiness Analysis and Enhancement Recommendations feature.
 * They define the structure for analyzing task clarity and providing improvement recommendations.
 */

/**
 * Clarity score indicating how well-defined a task is
 * Range: 0-100
 */
export interface ClarityScore {
  score: number
  level: 'poor' | 'fair' | 'good' | 'excellent'
}

/**
 * Vague term flagged in task description
 */
export interface VagueTerm {
  term: string
  position: number
  suggestion: string
}

/**
 * Missing element in task definition
 */
export interface MissingElement {
  category: 'technical-details' | 'acceptance-criteria' | 'dependencies' | 'environment' | 'testing' | 'definition-of-done'
  description: string
  importance: 'critical' | 'high' | 'medium' | 'low'
  recommendation: string
}

/**
 * Technical detail recommendation
 */
export interface TechnicalDetailRecommendation {
  type: 'file-path' | 'function' | 'component' | 'input-output' | 'architecture'
  description: string
  example?: string
}

/**
 * Acceptance criteria reference recommendation
 */
export interface AcceptanceCriteriaRecommendation {
  acId: string
  description: string
  relevance: 'high' | 'medium' | 'low'
}

/**
 * Example of well-defined task
 */
export interface TaskExample {
  title: string
  description: string
  source: 'project' | 'domain' | 'template'
  projectId?: string
  taskId?: string
}

/**
 * Category of recommendations
 */
export type RecommendationCategory =
  | 'technical-details'
  | 'vague-terms'
  | 'acceptance-criteria'
  | 'ai-compatibility'
  | 'examples'

/**
 * Recommendation item for a specific category
 */
export interface Recommendation {
  id: string
  category: RecommendationCategory
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  actionable: boolean
  autoApplyable?: boolean
}

/**
 * Complete task readiness analysis result
 */
export interface TaskReadinessAnalysis {
  taskId: string
  clarityScore: ClarityScore
  vagueTerms: VagueTerm[]
  missingElements: MissingElement[]
  technicalDetailRecommendations: TechnicalDetailRecommendation[]
  acRecommendations: AcceptanceCriteriaRecommendation[]
  aiCompatibilityIssues: string[]
  examples: TaskExample[]
  recommendations: Recommendation[]
  analyzedAt: string
}

/**
 * AI-assisted task enrichment suggestion
 */
export interface TaskEnrichmentSuggestion {
  taskId: string
  originalDescription?: string
  suggestedDescription: string
  suggestedTitle?: string
  suggestedAcRefs?: string[]
  confidence: number
  reasoning: string
  generatedAt: string
}

/**
 * Request for AI-assisted task enrichment
 */
export interface TaskEnrichmentRequest {
  taskId: string
  storyId: string
  includeStoryContext: boolean
  includeRelatedTasks: boolean
  includeCodebaseContext: boolean
}

/**
 * Story-Level Task Readiness Types
 * Aggregates task readiness metrics across all tasks in a story
 */

/**
 * Summary of task readiness analysis at story level
 */
export interface StoryAnalysisSummary {
  storyId: string
  totalTasks: number
  analyzedTasks: number
  avgClarityScore: number | null
  tasksAiReady: number
  tasksNeedingImprovement: number
  commonIssues: string[]
  lastAnalyzedAt?: string
}

/**
 * AI-generated task suggestion
 */
export interface TaskSuggestion {
  id: string
  title: string
  description: string
  acceptanceCriteriaRefs: string[]
  estimatedHours: number | null
  relevantFiles: string[]
  confidence: number
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
}

/**
 * Clarity score thresholds
 */
export const CLARITY_SCORE_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 70,
  FAIR: 40,
} as const

/**
 * Minimum clarity score to be considered AI-ready
 */
export const AI_READY_THRESHOLD = 80

/**
 * Props for StoryAnalysisSummary component
 */
export interface StoryAnalysisSummaryProps {
  storyId: string
  onAnalyzeAll?: () => Promise<void>
  onSuggestTasks?: () => Promise<void>
  className?: string
}

/**
 * Props for TaskSuggestionsPanel component
 */
export interface TaskSuggestionsPanelProps {
  storyId: string
  onSuggestionApproved?: (suggestionId: string) => void
  className?: string
}
