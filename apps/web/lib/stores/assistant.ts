import { useCallback, useEffect } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  AssistantState,
  AssistantStore,
  IntentResult,
  EntityMatch,
  ActionCommand,
  ActionResult,
  AISuggestion,
  SuggestionAction,
} from '@/lib/types/assistant'
import { orchestratorApi } from '@/lib/api/orchestrator'

const UTTERANCE_HISTORY_LIMIT = 10
const RECENT_ACTIONS_LIMIT = 20

export const useAssistantStore = create<AssistantStore>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      isFetchingSuggestions: false,
      suggestionsProjectId: null,
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
      dismissedSuggestions: new Set<string>(),
      suggestionsLastFetched: null,

      // History
      utteranceHistory: [],
      recentActions: [],

      setActiveProjectId: (projectId: string | null) => {
        const currentProjectId = get().activeProjectId
        if (currentProjectId === projectId) {
          return
        }

        set((state) => ({
          activeProjectId: projectId,
          suggestions:
            projectId && state.suggestionsProjectId === projectId ? state.suggestions : [],
          suggestionsProjectId:
            projectId && state.suggestionsProjectId === projectId
              ? state.suggestionsProjectId
              : null,
          suggestionsLastFetched:
            projectId && state.suggestionsProjectId === projectId
              ? state.suggestionsLastFetched
              : null,
        }))
      },

      // Input actions
      setUtterance: (utterance: string) => {
        set({ currentUtterance: utterance, error: null })
      },

      submitUtterance: async (utterance: string) => {
        const projectId = get().activeProjectId

        if (!projectId) {
          set({
            error: 'Select a project to use the assistant',
          })
          return
        }

        const { addToHistory } = get()

        set({
          isProcessing: true,
          error: null,
          currentUtterance: utterance,
          lastIntentResult: null,
          selectedCandidate: null,
          pendingAction: null,
        })

        try {
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
            selectedCandidate:
              result.autoSelect && result.entities.length > 0 ? result.entities[0] : null,
            pendingAction:
              result.autoSelect && result.suggestedAction ? result.suggestedAction : null,
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to process request. Please try again.'

          set({
            isProcessing: false,
            error: errorMessage,
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
          pendingAction: null, // Will be set after interpretation
        })
      },

      confirmAction: async () => {
        const { pendingAction, recentActions } = get()
        if (!pendingAction) return

        const projectId = get().activeProjectId

        if (!projectId) {
          set({
            error: 'Select a project before confirming actions',
          })
          return
        }

        set({ isProcessing: true, error: null })

        try {
          const result = await orchestratorApi.executeAction({
            action: pendingAction,
            projectId,
            userId: 'current-user', // TODO: Get from auth
          })

          const actionResult: ActionResult = {
            success: result.success,
            message: result.message,
            data: result.data,
            errors: result.errors,
          }

          // Add to recent actions (keep only last N)
          const updatedActions = [actionResult, ...recentActions].slice(0, RECENT_ACTIONS_LIMIT)

          set({
            recentActions: updatedActions,
            pendingAction: null,
            selectedCandidate: null,
            lastIntentResult: null,
            isProcessing: false,
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Failed to execute action. Please try again.'

          set({
            isProcessing: false,
            error: errorMessage,
          })
        }
      },

      cancelAction: () => {
        set({
          pendingAction: null,
          selectedCandidate: null,
          lastIntentResult: null,
        })
      },

      // Suggestions
      fetchSuggestions: async (projectId?: string) => {
        try {
          const targetProjectId = projectId ?? get().activeProjectId

          if (!targetProjectId) {
            console.warn('Attempted to fetch suggestions without a project context')
            return
          }

          set({ isFetchingSuggestions: true })

          const result = await orchestratorApi.getSuggestions(targetProjectId)

          set({
            suggestions: result.suggestions,
            suggestionsProjectId: targetProjectId,
            suggestionsLastFetched: new Date().toISOString(),
          })
        } catch (error) {
          console.error('Failed to fetch suggestions:', error)
          // Don't set error state for suggestions as it's not critical
        } finally {
          set({ isFetchingSuggestions: false })
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
        const updatedSuggestions = suggestions.filter((s) => s.id !== action.suggestionId)
        set({ suggestions: updatedSuggestions })

        // TODO: Implement actual suggestion action execution
      },

      dismissSuggestion: (suggestionId: string) => {
        const { suggestions, dismissedSuggestions } = get()

        const updatedSuggestions = suggestions.filter((s) => s.id !== suggestionId)
        const updatedDismissed = new Set(dismissedSuggestions).add(suggestionId)

        set({
          suggestions: updatedSuggestions,
          dismissedSuggestions: updatedDismissed,
        })
      },

      // History
      addToHistory: (utterance: string) => {
        const { utteranceHistory } = get()

        // Don't add empty or duplicate utterances
        if (!utterance.trim() || utteranceHistory[0] === utterance) return

        const updatedHistory = [utterance, ...utteranceHistory].slice(0, UTTERANCE_HISTORY_LIMIT)

        set({ utteranceHistory: updatedHistory })
      },

      clearHistory: () => {
        set({
          utteranceHistory: [],
          recentActions: [],
        })
      },
    }),
    {
      name: 'salunga-assistant',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive state
        utteranceHistory: state.utteranceHistory,
        dismissedSuggestions: Array.from(state.dismissedSuggestions ?? new Set<string>()),
        suggestionsLastFetched: state.suggestionsLastFetched,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }

        const persistedDismissed = (state as unknown as { dismissedSuggestions?: unknown })
          .dismissedSuggestions

        ;(state as AssistantState).dismissedSuggestions = new Set(
          Array.isArray(persistedDismissed) ? (persistedDismissed as string[]) : []
        )
      },
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
  const fetchSuggestions = useAssistantStore((state) => state.fetchSuggestions)
  const lastFetched = useAssistantStore((state) => state.suggestionsLastFetched)
  const activeProjectId = useAssistantStore((state) => state.activeProjectId)
  const suggestionsProjectId = useAssistantStore((state) => state.suggestionsProjectId)

  useEffect(() => {
    const targetProjectId = activeProjectId

    if (!targetProjectId) {
      return
    }

    const fetchedForProject = suggestionsProjectId === targetProjectId
    const isStale =
      !lastFetched ||
      !fetchedForProject ||
      Date.now() - new Date(lastFetched).getTime() > 5 * 60 * 1000

    if (isStale) {
      void fetchSuggestions(targetProjectId)
    }
  }, [activeProjectId, suggestionsProjectId, lastFetched, fetchSuggestions])
}

export function useProjectSuggestions(projectId?: string) {
  const setActiveProjectId = useAssistantStore((state) => state.setActiveProjectId)
  const fetchSuggestions = useAssistantStore((state) => state.fetchSuggestions)
  const suggestions = useAssistantStore((state) => state.suggestions)
  const suggestionsProjectId = useAssistantStore((state) => state.suggestionsProjectId)
  const isFetching = useAssistantStore((state) => state.isFetchingSuggestions)
  const lastFetched = useAssistantStore((state) => state.suggestionsLastFetched)

  useEffect(() => {
    if (!projectId) {
      setActiveProjectId(null)
      return
    }

    setActiveProjectId(projectId)

    return () => {
      setActiveProjectId(null)
    }
  }, [projectId, setActiveProjectId])

  useEffect(() => {
    if (!projectId) {
      return
    }

    const fetchedForProject = suggestionsProjectId === projectId
    const isStale =
      !lastFetched ||
      !fetchedForProject ||
      Date.now() - new Date(lastFetched).getTime() > 5 * 60 * 1000

    if (!fetchedForProject || isStale) {
      void fetchSuggestions(projectId)
    }
  }, [projectId, fetchSuggestions, suggestionsProjectId, lastFetched])

  const refresh = useCallback(() => {
    if (!projectId) return
    void fetchSuggestions(projectId)
  }, [projectId, fetchSuggestions])

  const projectSuggestions = suggestionsProjectId === projectId ? suggestions : []

  return {
    suggestions: projectSuggestions,
    isFetching,
    refresh,
    lastFetched,
  }
}
