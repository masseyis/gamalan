'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Copy, ThumbsUp, ThumbsDown, Lightbulb, FileText, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface AISuggestion {
  id: string
  type: 'acceptance-criteria' | 'story-breakdown' | 'task-clarification'
  title: string
  description?: string
  content: string
  confidence?: number
  metadata?: Record<string, any>
}

interface AISuggestionsModalProps {
  isOpen: boolean
  onClose: () => void
  suggestions: AISuggestion[]
  title: string
  description?: string
  onApplySuggestion?: (suggestion: AISuggestion) => void
}

const suggestionTypeConfig = {
  'acceptance-criteria': {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  'story-breakdown': {
    icon: Lightbulb,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  'task-clarification': {
    icon: MessageSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  }
}

export function AISuggestionsModal({
  isOpen,
  onClose,
  suggestions,
  title,
  description,
  onApplySuggestion
}: AISuggestionsModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleCopy = async (suggestion: AISuggestion) => {
    try {
      await navigator.clipboard.writeText(suggestion.content)
      setCopiedId(suggestion.id)
      toast({
        title: 'Copied to clipboard',
        description: 'Suggestion content has been copied to your clipboard.'
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Unable to copy to clipboard. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleApply = (suggestion: AISuggestion) => {
    onApplySuggestion?.(suggestion)
    toast({
      title: 'Suggestion applied',
      description: 'The AI suggestion has been applied to your project.'
    })
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-700'
    if (confidence >= 90) return 'bg-green-100 text-green-700'
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-base">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No suggestions generated</p>
              <p className="text-sm">Try running the AI assistant again or check your input.</p>
            </div>
          ) : (
            suggestions.map((suggestion, index) => {
              const config = suggestionTypeConfig[suggestion.type]
              const Icon = config.icon
              const isCopied = copiedId === suggestion.id

              return (
                <Card 
                  key={suggestion.id} 
                  className={`${config.borderColor} ${config.bgColor} border-2`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${config.color}`} />
                        <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        {suggestion.confidence && (
                          <Badge 
                            variant="secondary" 
                            className={getConfidenceColor(suggestion.confidence)}
                          >
                            {suggestion.confidence}% confidence
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(suggestion)}
                          className="h-8"
                        >
                          {isCopied ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {onApplySuggestion && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApply(suggestion)}
                            className="h-8"
                          >
                            Apply
                          </Button>
                        )}
                      </div>
                    </div>
                    {suggestion.description && (
                      <CardDescription>{suggestion.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-white rounded-lg p-4 border">
                      <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                        {suggestion.content}
                      </pre>
                    </div>
                    
                    {suggestion.metadata && Object.keys(suggestion.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(suggestion.metadata).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Feedback buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">Was this helpful?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {suggestions.length > 0 && (
            <Button 
              onClick={() => {
                // Copy all suggestions to clipboard
                const allContent = suggestions.map((s, i) => 
                  `${i + 1}. ${s.title}\n${s.content}\n`
                ).join('\n')
                navigator.clipboard.writeText(allContent)
                toast({
                  title: 'All suggestions copied',
                  description: 'All AI suggestions have been copied to your clipboard.'
                })
              }}
            >
              Copy All
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}