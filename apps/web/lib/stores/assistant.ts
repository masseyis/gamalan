import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { 
  AssistantStore, 
  IntentResult, 
  EntityMatch, 
  ActionCommand, 
  ActionResult, 
  AISuggestion,
  SuggestionAction
} from '@/lib/types/assistant'
import { orchestratorApi } from '@/lib/api/orchestrator'

const UTTERANCE_HISTORY_LIMIT = 10
const RECENT_ACTIONS_LIMIT = 20

export const useAssistantStore = create<AssistantStore>()(
  persist(
    (set, get) => ({
      // Input state
      currentUtterance: '',
      isProcessing: false,
      error: null,
      
      // Intent & candidate state
      lastIntentResult: null,
      selectedCandidate: null,
      pendingAction: null,
      
      // Suggestions state
      suggestions: [],
      dismissedSuggestions: new Set(),
      suggestionsLastFetched: null,
      
      // History
      utteranceHistory: [],
      recentActions: [],

      // Input actions
      setUtterance: (utterance: string) => {
        set({ currentUtterance: utterance, error: null })
      },

      submitUtterance: async (utterance: string) => {
        const { addToHistory } = get()
        
        set({ 
          isProcessing: true, 
          error: null, 
          currentUtterance: utterance,
          lastIntentResult: null,
          selectedCandidate: null,
          pendingAction: null
        })
        
        try {
          // Get current project context (this would come from route params in real usage)
          const projectId = 'current-project' // TODO: Get from router/context
          
          const result = await orchestratorApi.interpretUtterance({
            utterance,
            projectId,
            // TODO: Add contextEntities from current page/route
          })
          
          addToHistory(utterance)
          
          set({ 
            lastIntentResult: result,
            isProcessing: false,
            currentUtterance: '',
            // Auto-select if high confidence and not ambiguous
            selectedCandidate: result.autoSelect && result.entities.length > 0 
              ? result.entities[0] 
              : null,
            pendingAction: result.autoSelect && result.suggestedAction 
              ? result.suggestedAction 
              : null
          })
          
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to process request. Please try again.'
            
          set({ 
            isProcessing: false, 
            error: errorMessage 
          })
        }
      },

      clearError: () => {
        set({ error: null })
      },

      // Candidate selection
      selectCandidate: (candidate: EntityMatch) => {
        set({ 
          selectedCandidate: candidate,
          pendingAction: null // Will be set after interpretation
        })
      },

      confirmAction: async () => {
        const { pendingAction, recentActions } = get()
        if (!pendingAction) return
        
        set({ isProcessing: true, error: null })
        
        try {
          const result = await orchestratorApi.executeAction({
            action: pendingAction,
            projectId: 'current-project', // TODO: Get from context
            userId: 'current-user' // TODO: Get from auth
          })
          
          const actionResult: ActionResult = {
            success: result.success,
            message: result.message,
            data: result.data,
            errors: result.errors
          }
          
          // Add to recent actions (keep only last N)
          const updatedActions = [actionResult, ...recentActions].slice(0, RECENT_ACTIONS_LIMIT)
          
          set({
            recentActions: updatedActions,
            pendingAction: null,
            selectedCandidate: null,
            lastIntentResult: null,
            isProcessing: false
          })
          
        } catch (error) {
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Failed to execute action. Please try again.'
            
          set({ 
            isProcessing: false, 
            error: errorMessage 
          })
        }
      },

      cancelAction: () => {
        set({ 
          pendingAction: null,
          selectedCandidate: null,
          lastIntentResult: null
        })
      },

      // Suggestions
      fetchSuggestions: async () => {
        try {
          const projectId = 'current-project' // TODO: Get from context
          const result = await orchestratorApi.getSuggestions(projectId)
          
          set({ 
            suggestions: result.suggestions,
            suggestionsLastFetched: new Date().toISOString()
          })
          
        } catch (error) {
          console.error('Failed to fetch suggestions:', error)
          // Don't set error state for suggestions as it's not critical
        }
      },

      applySuggestionAction: async (action: SuggestionAction) => {
        const { suggestions } = get()
        
        if (action.type === 'dismiss') {
          const { dismissSuggestion } = get()
          dismissSuggestion(action.suggestionId)
          return
        }
        
        // For accept/edit actions, we would typically call the orchestrator
        // For now, just remove the suggestion
        const updatedSuggestions = suggestions.filter(s => s.id !== action.suggestionId)
        set({ suggestions: updatedSuggestions })
        
        // TODO: Implement actual suggestion action execution
      },

      dismissSuggestion: (suggestionId: string) => {
        const { suggestions, dismissedSuggestions } = get()
        
        const updatedSuggestions = suggestions.filter(s => s.id !== suggestionId)
        const updatedDismissed = new Set(dismissedSuggestions).add(suggestionId)
        
        set({ 
          suggestions: updatedSuggestions,
          dismissedSuggestions: updatedDismissed
        })
      },

      // History
      addToHistory: (utterance: string) => {
        const { utteranceHistory } = get()
        
        // Don't add empty or duplicate utterances
        if (!utterance.trim() || utteranceHistory[0] === utterance) return
        
        const updatedHistory = [utterance, ...utteranceHistory]
          .slice(0, UTTERANCE_HISTORY_LIMIT)
        
        set({ utteranceHistory: updatedHistory })
      },

      clearHistory: () => {
        set({ 
          utteranceHistory: [],
          recentActions: []
        })
      },
    }),
    {
      name: 'salunga-assistant',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive state
        utteranceHistory: state.utteranceHistory,
        dismissedSuggestions: Array.from(state.dismissedSuggestions), // Convert Set to Array for JSON
        suggestionsLastFetched: state.suggestionsLastFetched,
      }),
      onRehydrateStorage: () => (state) => {
        // Convert dismissed suggestions back to Set after rehydration
        if (state && Array.isArray(state.dismissedSuggestions)) {
          state.dismissedSuggestions = new Set(state.dismissedSuggestions as string[])
        }
      }
    }
  )
)

// Hook to get current project ID from router context
export function useCurrentProjectId(): string | null {
  // TODO: Implement based on Next.js router/context
  // This would typically come from useParams() or useRouter()
  return 'current-project'
}

// Hook to automatically fetch suggestions on mount
export function useAutoFetchSuggestions() {
  const fetchSuggestions = useAssistantStore(state => state.fetchSuggestions)
  const lastFetched = useAssistantStore(state => state.suggestionsLastFetched)
  
  // Auto-fetch suggestions if not fetched recently
  const shouldFetch = !lastFetched || 
    (Date.now() - new Date(lastFetched).getTime() > 5 * 60 * 1000) // 5 minutes
    
  if (shouldFetch) {
    fetchSuggestions()
  }
}