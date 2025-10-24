'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAssistantStore } from '@/lib/stores/assistant'
import { Send, Loader2, Sparkles, Mic, MicOff, AlertCircle, Command } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: (event: SpeechRecognitionEvent) => void
  onend: () => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  start(): void
  stop(): void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

export function AssistantBar() {
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  const {
    currentUtterance,
    isProcessing,
    error,
    setUtterance,
    submitUtterance,
    clearError,
    utteranceHistory,
  } = useAssistantStore()

  // Initialize speech recognition
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()

        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map((result: SpeechRecognitionResult) => result[0])
            .map((result: SpeechRecognitionAlternative) => result.transcript)
            .join('')

          setUtterance(transcript)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsListening(false)
          toast({
            title: 'Speech Recognition Error',
            description: 'Unable to process speech input. Please try typing instead.',
            variant: 'destructive',
          })
        }

        setRecognition(recognition)
      }
    }
  }, [setUtterance, toast])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus assistant bar
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        textareaRef.current?.focus()
      }

      // Escape to clear error
      if (event.key === 'Escape' && error) {
        clearError()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [error, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUtterance.trim() || isProcessing) return

    try {
      await submitUtterance(currentUtterance.trim())
    } catch (error) {
      console.error('Failed to submit utterance:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }

    // Navigate history with up/down arrows when textarea is empty
    if (currentUtterance === '' && utteranceHistory.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setUtterance(utteranceHistory[0] || '')
      }
    }
  }

  const toggleListening = () => {
    if (!recognition) {
      toast({
        title: 'Speech Recognition Not Available',
        description: 'Your browser does not support speech recognition.',
        variant: 'destructive',
      })
      return
    }

    if (isListening) {
      recognition.stop()
      setIsListening(false)
    } else {
      recognition.start()
      setIsListening(true)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUtterance(e.target.value)

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  const canSubmit = currentUtterance.trim() && !isProcessing

  return (
    <div className="space-y-3">
      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm flex-1">{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="h-auto p-1 text-destructive hover:bg-destructive/20"
          >
            ×
          </Button>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="relative" data-testid="assistant-bar">
        <div className="flex items-end gap-3 p-4 bg-card border rounded-xl shadow-sm">
          {/* Sparkles Icon */}
          <div className="flex-shrink-0 p-2">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          {/* Input Area */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                AI Assistant
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Command className="h-3 w-3" />
                <span>+ K to focus</span>
              </div>
            </div>

            <Textarea
              ref={textareaRef}
              value={currentUtterance}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Tell me what you'd like to do... (e.g., 'I finished the login task', 'Split the user onboarding story')"
              className="min-h-[44px] max-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0 p-0 text-base"
              disabled={isProcessing}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Voice Input Button */}
            {recognition && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleListening}
                disabled={isProcessing}
                className={cn('h-10 w-10 p-0', isListening && 'bg-primary/10 text-primary')}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}

            {/* Submit Button */}
            <Button type="submit" size="sm" disabled={!canSubmit} className="h-10 px-4">
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Status Indicator */}
        {isProcessing && (
          <div className="absolute -bottom-6 left-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Processing your request...</span>
          </div>
        )}
      </form>

      {/* Usage Hints */}
      {!currentUtterance && !isProcessing && utteranceHistory.length === 0 && (
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Try saying things like:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              '"I finished the authentication task"',
              '"Split the user registration story"',
              '"What should I demo this sprint?"',
              '"Check if story ABC-123 is ready"',
            ].map((example, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={() => setUtterance(example.replace(/"/g, ''))}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
