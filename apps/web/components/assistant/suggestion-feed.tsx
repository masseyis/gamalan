'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useAssistantStore } from '@/lib/stores/assistant'
import { AISuggestion, SuggestionAction } from '@/lib/types/assistant'
import { 
  CheckCircle2, 
  Edit3, 
  X, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Presentation,
  ListTodo,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const SUGGESTION_ICONS = {
  'story-readiness': FileText,
  'task-completion': CheckCircle2,
  'sprint-planning': Calendar,
  'demo-prep': Presentation,
  'backlog-refinement': ListTodo,
} as const

const PRIORITY_CONFIG = {
  low: { color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-800' },
  urgent: { color: 'text-red-600', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800' },
} as const

function SuggestionCard({ 
  suggestion, 
  onAction 
}: { 
  suggestion: AISuggestion
  onAction: (action: SuggestionAction) => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState(suggestion.description)
  const [isActioning, setIsActioning] = useState(false)

  const Icon = SUGGESTION_ICONS[suggestion.type] || AlertTriangle
  const priorityConfig = PRIORITY_CONFIG[suggestion.priority]

  const handleAction = async (type: SuggestionAction['type'], parameters?: Record<string, any>) => {
    setIsActioning(true)
    try {
      await onAction({ 
        type, 
        suggestionId: suggestion.id, 
        parameters: { ...parameters, editedDescription: editedDescription !== suggestion.description ? editedDescription : undefined }
      })
    } finally {
      setIsActioning(false)
      setIsEditing(false)
    }
  }

  const timeAgo = new Date(suggestion.createdAt).toLocaleString()

  return (
    <Card className={cn("transition-all duration-200", priorityConfig.bg)} data-testid="suggestion-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn("p-2 rounded-lg bg-background border", priorityConfig.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-1">
                <h3 className="font-semibold text-sm leading-tight">
                  {suggestion.title}
                </h3>
                <Badge className={cn("text-xs", priorityConfig.badge)} variant="secondary">
                  {suggestion.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs capitalize">
                  {suggestion.type.replace('-', ' ')}
                </Badge>
                <span>•</span>
                <span>{Math.round(suggestion.confidence * 100)}% confidence</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Description */}
        <div className="mb-4">
          {isEditing ? (
            <Textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="min-h-[60px] text-sm"
              placeholder="Edit suggestion description..."
            />
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {editedDescription}
            </p>
          )}
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mb-4 p-3 bg-background/50 rounded-lg border text-xs space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Entity Type:</span>
                <span className="ml-2 capitalize">{suggestion.entityType || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium">Actionable:</span>
                <span className="ml-2">{suggestion.actionable ? 'Yes' : 'No'}</span>
              </div>
            </div>
            {suggestion.suggestedAction && (
              <div>
                <span className="font-medium">Suggested Action:</span>
                <span className="ml-2 capitalize">{suggestion.suggestedAction.replace(/[_-]/g, ' ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {suggestion.actionable && (
            <Button
              size="sm"
              onClick={() => handleAction('accept')}
              disabled={isActioning}
              className="flex-1"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isEditing) {
                handleAction('edit')
              } else {
                setIsEditing(true)
              }
            }}
            disabled={isActioning}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {isEditing ? 'Save' : 'Edit'}
          </Button>
          
          {isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditing(false)
                setEditedDescription(suggestion.description)
              }}
              disabled={isActioning}
            >
              Cancel
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleAction('dismiss')}
            disabled={isActioning}
            className="text-muted-foreground hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SuggestionFeed() {
  const [filter, setFilter] = useState<'all' | AISuggestion['type']>('all')
  const { toast } = useToast()
  
  const {
    suggestions,
    fetchSuggestions,
    applySuggestionAction
  } = useAssistantStore()

  const filteredSuggestions = suggestions.filter(suggestion => 
    filter === 'all' || suggestion.type === filter
  )

  // Group suggestions by priority
  const groupedSuggestions = {
    urgent: filteredSuggestions.filter(s => s.priority === 'urgent'),
    high: filteredSuggestions.filter(s => s.priority === 'high'),
    medium: filteredSuggestions.filter(s => s.priority === 'medium'),
    low: filteredSuggestions.filter(s => s.priority === 'low'),
  }

  const handleSuggestionAction = async (action: SuggestionAction) => {
    try {
      await applySuggestionAction(action)
      
      const actionLabels = {
        accept: 'accepted',
        edit: 'updated',
        dismiss: 'dismissed'
      }
      
      toast({
        title: `Suggestion ${actionLabels[action.type]}`,
        description: `The suggestion has been ${actionLabels[action.type]} successfully.`,
      })
    } catch (error) {
      toast({
        title: 'Action Failed',
        description: 'Unable to process the suggestion action. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleRefresh = async () => {
    try {
      await fetchSuggestions()
      toast({
        title: 'Suggestions Updated',
        description: 'Fresh suggestions have been loaded.',
      })
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Unable to fetch new suggestions. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const suggestionTypes = [
    { value: 'all', label: 'All Suggestions' },
    { value: 'story-readiness', label: 'Story Readiness' },
    { value: 'task-completion', label: 'Task Completion' },
    { value: 'sprint-planning', label: 'Sprint Planning' },
    { value: 'demo-prep', label: 'Demo Prep' },
    { value: 'backlog-refinement', label: 'Backlog Refinement' },
  ] as const

  return (
    <div className="space-y-6" data-testid="suggestion-feed">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Suggestions</h2>
          <Badge variant="secondary">{filteredSuggestions.length}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {suggestionTypes.map(type => (
          <Button
            key={type.value}
            variant={filter === type.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(type.value)}
            className="text-xs"
          >
            {type.label}
          </Button>
        ))}
      </div>

      {/* Suggestions by Priority */}
      <div className="space-y-6">
        {Object.entries(groupedSuggestions).map(([priority, prioritySuggestions]) => {
          if (prioritySuggestions.length === 0) return null
          
          return (
            <div key={priority} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium capitalize">{priority} Priority</h3>
                <Badge variant="outline" className="text-xs">
                  {prioritySuggestions.length}
                </Badge>
              </div>
              
              <div className="space-y-3">
                {prioritySuggestions.map(suggestion => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onAction={handleSuggestionAction}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {filteredSuggestions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No suggestions available</p>
            <p className="text-sm mt-2">
              {filter === 'all' 
                ? "I'll notify you when there are opportunities to improve your workflow"
                : `No ${filter.replace('-', ' ')} suggestions at the moment`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}