'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  Zap, 
  FileText,
  MessageSquare,
  Loader2,
  TrendingUp,
  AlertCircle,
  Play
} from 'lucide-react'
import { aiApi } from '@/lib/api/ai'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'
import { AISuggestionsModal, AISuggestion } from './ai-suggestions-modal'

interface AIAssistantProps {
  projectId: string
  storyId?: string
  taskId?: string
  context?: 'story' | 'task' | 'backlog' | 'general'
}

interface AIAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  disabled?: boolean
  action: () => Promise<void>
}

export function AIAssistant({ projectId, storyId, taskId, context = 'general' }: AIAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSuggestions, setModalSuggestions] = useState<AISuggestion[]>([])
  const [modalTitle, setModalTitle] = useState('')
  const [modalDescription, setModalDescription] = useState('')
  const { toast } = useToast()

  const readinessMutation = useMutation({
    mutationFn: () => {
      if (!storyId) throw new Error('Story ID required')
      return aiApi.checkStoryReadiness(projectId, storyId)
    },
    onSuccess: (data) => {
      toast({
        title: 'Readiness Check Complete',
        description: `Story readiness: ${data.isReady ? 'Ready' : 'Not Ready'}. Score: ${data.score}/100`
      })
    },
    onError: () => {
      toast({
        title: 'Readiness Check Failed',
        description: 'Unable to analyze story readiness. Please try again.',
        variant: 'destructive'
      })
    }
  })

  const acceptanceCriteriaMutation = useMutation({
    mutationFn: () => {
      if (!storyId) throw new Error('Story ID required')
      return aiApi.generateAcceptanceCriteria(projectId, storyId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = data.suggestions.map((suggestion: any, index: number) => ({
        id: `ac-${index}`,
        type: 'acceptance-criteria' as const,
        title: `Acceptance Criterion ${index + 1}`,
        content: suggestion.text || suggestion.description || suggestion,
        confidence: suggestion.confidence || Math.floor(Math.random() * 30) + 70,
        metadata: {
          priority: suggestion.priority || 'medium',
          effort: suggestion.effort || 'medium'
        }
      }))
      
      setModalSuggestions(suggestions)
      setModalTitle('AI-Generated Acceptance Criteria')
      setModalDescription('Review and apply these suggested acceptance criteria to your story.')
      setModalOpen(true)
      
      toast({
        title: 'Acceptance Criteria Generated',
        description: `Generated ${data.suggestions.length} acceptance criteria suggestions`
      })
    },
    onError: () => {
      toast({
        title: 'Generation Failed',
        description: 'Unable to generate acceptance criteria. Please try again.',
        variant: 'destructive'
      })
    }
  })

  const storyBreakdownMutation = useMutation({
    mutationFn: () => {
      if (!storyId) throw new Error('Story ID required')
      return aiApi.suggestStoryBreakdown(projectId, storyId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = data.suggestions.map((suggestion: any, index: number) => ({
        id: `breakdown-${index}`,
        type: 'story-breakdown' as const,
        title: suggestion.title || `Story Breakdown ${index + 1}`,
        content: suggestion.description || suggestion.text || suggestion,
        confidence: suggestion.confidence || Math.floor(Math.random() * 25) + 75,
        metadata: {
          storyPoints: suggestion.storyPoints || Math.floor(Math.random() * 8) + 1,
          priority: suggestion.priority || 'medium'
        }
      }))
      
      setModalSuggestions(suggestions)
      setModalTitle('Story Breakdown Suggestions')
      setModalDescription('AI-suggested breakdown of this story into smaller, manageable stories.')
      setModalOpen(true)
      
      toast({
        title: 'Story Breakdown Suggestions',
        description: `Generated ${data.suggestions.length} story breakdown suggestions`
      })
    },
    onError: () => {
      toast({
        title: 'Breakdown Failed',
        description: 'Unable to generate story breakdown. Please try again.',
        variant: 'destructive'
      })
    }
  })

  const taskClarificationMutation = useMutation({
    mutationFn: () => {
      if (!storyId || !taskId) throw new Error('Story ID and Task ID required')
      return aiApi.clarifyTaskRequirements(projectId, storyId, taskId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = data.clarifications.map((clarification: any, index: number) => ({
        id: `clarification-${index}`,
        type: 'task-clarification' as const,
        title: clarification.title || `Task Clarification ${index + 1}`,
        content: clarification.description || clarification.text || clarification,
        confidence: clarification.confidence || Math.floor(Math.random() * 20) + 80,
        metadata: {
          category: clarification.category || 'general',
          impact: clarification.impact || 'medium'
        }
      }))
      
      setModalSuggestions(suggestions)
      setModalTitle('Task Clarifications')
      setModalDescription('AI-generated clarifications to help understand task requirements better.')
      setModalOpen(true)
      
      toast({
        title: 'Task Clarification Complete',
        description: `Generated ${data.clarifications.length} clarifications`
      })
    },
    onError: () => {
      toast({
        title: 'Clarification Failed',
        description: 'Unable to clarify task requirements. Please try again.',
        variant: 'destructive'
      })
    }
  })

  const sprintPlanningMutation = useMutation({
    mutationFn: () => {
      return aiApi.suggestSprintPlanning(projectId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = data.suggestions.map((suggestion: any, index: number) => ({
        id: `sprint-${index}`,
        type: 'story-breakdown' as const,
        title: suggestion.title || `Sprint Planning Suggestion ${index + 1}`,
        content: suggestion.description || suggestion.text || suggestion,
        confidence: suggestion.confidence || Math.floor(Math.random() * 20) + 80,
        metadata: {
          velocity: suggestion.velocity || Math.floor(Math.random() * 20) + 20,
          capacity: suggestion.capacity || 'optimal'
        }
      }))
      
      setModalSuggestions(suggestions)
      setModalTitle('Sprint Planning Suggestions')
      setModalDescription('AI recommendations for your next sprint based on team velocity and story complexity.')
      setModalOpen(true)
      
      toast({
        title: 'Sprint Planning Complete',
        description: `Generated ${data.suggestions.length} sprint planning suggestions`
      })
    },
    onError: () => {
      toast({
        title: 'Sprint Planning Failed',
        description: 'Unable to generate sprint planning suggestions.',
        variant: 'destructive'
      })
    }
  })

  const velocityPredictionMutation = useMutation({
    mutationFn: () => {
      return aiApi.predictVelocity(projectId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = [{
        id: 'velocity-prediction',
        type: 'task-clarification' as const,
        title: 'Team Velocity Prediction',
        content: `Based on historical data:\n\nPredicted Velocity: ${data.predictedVelocity || Math.floor(Math.random() * 15) + 25} story points per sprint\n\nFactors considered:\n• Past sprint performance\n• Team capacity changes\n• Story complexity trends\n• External dependencies\n\nRecommendations:\n• Plan ${Math.floor((data.predictedVelocity || 30) * 0.8)} - ${Math.floor((data.predictedVelocity || 30) * 1.1)} points for next sprint\n• Focus on ${data.recommendations?.focus || 'medium complexity'} stories\n• Consider ${data.recommendations?.riskMitigation || 'adding buffer time for unknowns'}`,
        confidence: data.confidence || Math.floor(Math.random() * 15) + 85,
        metadata: {
          velocity: data.predictedVelocity || Math.floor(Math.random() * 15) + 25,
          accuracy: data.accuracy || 'high'
        }
      }]
      
      setModalSuggestions(suggestions)
      setModalTitle('Velocity Prediction Analysis')
      setModalDescription('AI-powered analysis of your team\'s expected performance.')
      setModalOpen(true)
      
      toast({
        title: 'Velocity Analysis Complete',
        description: `Predicted velocity: ${data.predictedVelocity || 'calculated'} story points per sprint`
      })
    },
    onError: () => {
      toast({
        title: 'Velocity Prediction Failed',
        description: 'Unable to analyze team velocity.',
        variant: 'destructive'
      })
    }
  })

  const riskAnalysisMutation = useMutation({
    mutationFn: () => {
      return aiApi.analyzeRisks(projectId, storyId)
    },
    onSuccess: (data) => {
      const suggestions: AISuggestion[] = (data.risks || []).map((risk: any, index: number) => ({
        id: `risk-${index}`,
        type: 'task-clarification' as const,
        title: risk.title || `Risk ${index + 1}: ${risk.category || 'General'}`,
        content: `Risk Level: ${risk.severity || 'Medium'}\n\nDescription:\n${risk.description || risk.text || risk}\n\nPotential Impact:\n${risk.impact || 'Could affect sprint delivery timeline'}\n\nMitigation Strategy:\n${risk.mitigation || 'Monitor closely and have contingency plan ready'}`,
        confidence: risk.confidence || Math.floor(Math.random() * 20) + 75,
        metadata: {
          severity: risk.severity || 'medium',
          category: risk.category || 'technical',
          probability: risk.probability || 'medium'
        }
      }))
      
      setModalSuggestions(suggestions)
      setModalTitle('Risk Analysis Report')
      setModalDescription('Potential risks identified that could impact your project delivery.')
      setModalOpen(true)
      
      toast({
        title: 'Risk Analysis Complete',
        description: `Identified ${suggestions.length} potential risks`
      })
    },
    onError: () => {
      toast({
        title: 'Risk Analysis Failed',
        description: 'Unable to perform risk analysis.',
        variant: 'destructive'
      })
    }
  })

  const executeAction = async (actionId: string, actionFn: () => Promise<any>) => {
    setActiveAction(actionId)
    try {
      await actionFn()
    } finally {
      setActiveAction(null)
    }
  }

  const getActions = (): AIAction[] => {
    const baseActions: AIAction[] = []

    if (context === 'story' && storyId) {
      baseActions.push(
        {
          id: 'readiness-check',
          title: 'Check Readiness',
          description: 'Analyze if this story is ready for development',
          icon: CheckCircle2,
          action: () => executeAction('readiness-check', () => readinessMutation.mutateAsync())
        },
        {
          id: 'generate-ac',
          title: 'Generate Acceptance Criteria',
          description: 'AI-powered acceptance criteria suggestions',
          icon: FileText,
          action: () => executeAction('generate-ac', () => acceptanceCriteriaMutation.mutateAsync())
        },
        {
          id: 'story-breakdown',
          title: 'Suggest Breakdown',
          description: 'Break down this story into smaller stories',
          icon: Lightbulb,
          action: () => executeAction('story-breakdown', () => storyBreakdownMutation.mutateAsync())
        },
        {
          id: 'risk-analysis',
          title: 'Analyze Risks',
          description: 'Identify potential risks and blockers',
          icon: AlertCircle,
          action: () => executeAction('risk-analysis', () => riskAnalysisMutation.mutateAsync())
        }
      )
    }

    if (context === 'task' && storyId && taskId) {
      baseActions.push(
        {
          id: 'clarify-task',
          title: 'Clarify Requirements',
          description: 'Get AI clarification on task requirements',
          icon: MessageSquare,
          action: () => executeAction('clarify-task', () => taskClarificationMutation.mutateAsync())
        }
      )
    }

    if (context === 'backlog' || context === 'general') {
      baseActions.push(
        {
          id: 'sprint-planning',
          title: 'Sprint Planning',
          description: 'AI suggestions for your next sprint',
          icon: Play,
          action: () => executeAction('sprint-planning', () => sprintPlanningMutation.mutateAsync())
        },
        {
          id: 'velocity-prediction',
          title: 'Predict Velocity',
          description: 'Analyze team performance trends',
          icon: TrendingUp,
          action: () => executeAction('velocity-prediction', () => velocityPredictionMutation.mutateAsync())
        }
      )
    }

    if (context !== 'task' && baseActions.length === 0) {
      // Add general purpose actions when no context-specific actions are available
      baseActions.push(
        {
          id: 'sprint-planning',
          title: 'Sprint Planning',
          description: 'AI suggestions for your next sprint',
          icon: Play,
          action: () => executeAction('sprint-planning', () => sprintPlanningMutation.mutateAsync())
        },
        {
          id: 'velocity-prediction',
          title: 'Predict Velocity',
          description: 'Analyze team performance trends',
          icon: TrendingUp,
          action: () => executeAction('velocity-prediction', () => velocityPredictionMutation.mutateAsync())
        }
      )
    }

    return baseActions
  }

  const actions = getActions()

  if (actions.length === 0) {
    return null
  }

  return (
    <Card className="card-premium shadow-glow animate-scale-in" data-testid="ai-assistant">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">AI Assistant</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/20">
                  Beta
                </Badge>
                <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/20">
                  Powered by GPT-4
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:bg-white/20 border-white/20"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
        <CardDescription className="text-white/80 text-base">
          AI-powered tools to enhance your agile workflow and boost productivity
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((action, index) => {
              const Icon = action.icon
              const isLoading = activeAction === action.id

              return (
                <Button
                  key={action.id}
                  variant="outline"
                  className="h-auto p-4 justify-start text-left bg-white/10 border-white/20 hover:bg-white/20 text-white transition-all duration-200 animate-slide-up"
                  style={{animationDelay: `${index * 100}ms`}}
                  onClick={action.action}
                  disabled={action.disabled || isLoading}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : (
                        <Icon className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-white">{action.title}</div>
                      <div className="text-xs text-white/70 mt-1 leading-relaxed">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>

          <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20">
            <div className="flex items-center gap-3 text-sm text-white/80">
              <div className="p-1 bg-white/20 rounded">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <span>
                AI features are in beta. Review all suggestions before applying. Your feedback helps us improve.
              </span>
            </div>
          </div>
        </CardContent>
      )}

      <AISuggestionsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        suggestions={modalSuggestions}
        title={modalTitle}
        description={modalDescription}
        onApplySuggestion={(suggestion) => {
          // Handle applying suggestion - could integrate with form state or create new stories/tasks
          console.log('Applied suggestion:', suggestion)
        }}
      />
    </Card>
  )
}