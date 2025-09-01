// Assistant-related types for the AI-first interface

export interface IntentResult {
  intent: string
  confidence: number
  entities: EntityMatch[]
  autoSelect: boolean
  ambiguous: boolean
}

export interface EntityMatch {
  id: string
  type: 'story' | 'task' | 'sprint' | 'project'
  title: string
  description?: string
  confidence: number
  evidence: EvidenceChip[]
  metadata?: Record<string, any>
}

export interface EvidenceChip {
  type: 'pr' | 'commit' | 'assignment' | 'time' | 'mention'
  label: string
  value: string
  url?: string
}

export interface ActionCommand {
  type: string
  entityId: string
  entityType: string
  parameters: Record<string, any>
  riskLevel: 'low' | 'medium' | 'high'
  description: string
  confirmationRequired: boolean
  // New draft preview fields
  draft?: ActionDraft
}

export interface ActionDraft {
  summary: string
  steps: ActionStep[]
  reasoning: string
  expectedOutcome: string
  potentialIssues?: string[]
  estimatedTime?: string
}

export interface ActionStep {
  id: string
  description: string
  type: 'api_call' | 'update_status' | 'create_item' | 'send_notification' | 'validation'
  details: string
  canSkip: boolean
}

export interface ActionResult {
  success: boolean
  message: string
  data?: any
  errors?: string[]
}

export interface AISuggestion {
  id: string
  type: 'story-readiness' | 'task-completion' | 'sprint-planning' | 'demo-prep' | 'backlog-refinement'
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  confidence: number
  actionable: boolean
  entityId?: string
  entityType?: string
  suggestedAction?: string
  createdAt: string
  dismissedAt?: string
}

export interface SuggestionAction {
  type: 'accept' | 'edit' | 'dismiss'
  suggestionId: string
  parameters?: Record<string, any>
}

export interface AssistantState {
  // Input state
  currentUtterance: string
  isProcessing: boolean
  error: string | null
  
  // Intent & candidate state
  lastIntentResult: IntentResult | null
  selectedCandidate: EntityMatch | null
  pendingAction: ActionCommand | null
  
  // Suggestions state
  suggestions: AISuggestion[]
  dismissedSuggestions: Set<string>
  suggestionsLastFetched: string | null
  
  // History
  utteranceHistory: string[]
  recentActions: ActionResult[]
}

export interface AssistantActions {
  // Input actions
  setUtterance: (utterance: string) => void
  submitUtterance: (utterance: string) => Promise<void>
  clearError: () => void
  
  // Candidate selection
  selectCandidate: (candidate: EntityMatch) => void
  confirmAction: () => Promise<void>
  cancelAction: () => void
  
  // Suggestions
  fetchSuggestions: () => Promise<void>
  applySuggestionAction: (action: SuggestionAction) => Promise<void>
  dismissSuggestion: (suggestionId: string) => void
  
  // History
  addToHistory: (utterance: string) => void
  clearHistory: () => void
}

export type AssistantStore = AssistantState & AssistantActions

// API request/response types
export interface InterpretRequest {
  utterance: string
  projectId: string
  contextEntities?: {
    storyId?: string
    taskId?: string
    sprintId?: string
  }
}

export interface InterpretResponse {
  intent: string
  confidence: number
  entities: EntityMatch[]
  autoSelect: boolean
  ambiguous: boolean
  suggestedAction?: ActionCommand
}

export interface ActionRequest {
  action: ActionCommand
  projectId: string
  userId: string
}

export interface ActionResponse {
  success: boolean
  message: string
  data?: any
  errors?: string[]
}

export interface SuggestionsResponse {
  suggestions: AISuggestion[]
  hasMore: boolean
  nextCursor?: string
}