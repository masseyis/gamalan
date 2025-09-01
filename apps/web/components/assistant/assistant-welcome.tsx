'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAssistantStore } from '@/lib/stores/assistant'
import { 
  Sparkles, 
  MessageSquare, 
  Zap, 
  Target,
  ArrowRight,
  Lightbulb
} from 'lucide-react'

const EXAMPLE_UTTERANCES = [
  {
    text: "I finished the authentication task",
    description: "Mark a task as completed",
    icon: Target
  },
  {
    text: "Split the user onboarding story",
    description: "Break down a large story into smaller ones",
    icon: Lightbulb
  },
  {
    text: "What should I demo this sprint?",
    description: "Get demo suggestions from completed work",
    icon: Sparkles
  },
  {
    text: "Check if story ABC-123 is ready",
    description: "Analyze story readiness for development",
    icon: Zap
  }
]

export function AssistantWelcome() {
  const setUtterance = useAssistantStore(state => state.setUtterance)

  const handleExampleClick = (utterance: string) => {
    setUtterance(utterance)
    // Focus the input (this would need to be coordinated with AssistantBar)
    document.querySelector('textarea')?.focus()
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/20 rounded-full">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to Your AI Assistant</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            I&apos;m here to help you stay on track with your agile workflow. Simply tell me what you want to do in natural language, 
            and I&apos;ll help you get it done efficiently.
          </p>
        </CardContent>
      </Card>

      {/* Example Interactions */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Try saying something like...</h2>
          <p className="text-sm text-muted-foreground">
            Click any example below to try it out, or type your own request in the bar above.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXAMPLE_UTTERANCES.map((example, index) => {
            const Icon = example.icon
            
            return (
              <Card 
                key={index} 
                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
                onClick={() => handleExampleClick(example.text)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm mb-1">
                            &ldquo;{example.text}&rdquo;
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {example.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Features Overview */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            What I can help you with
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Task Management</h4>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Mark tasks and stories complete</li>
                <li>• Update status and assignments</li>
                <li>• Track progress automatically</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Story Development</h4>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Generate acceptance criteria</li>
                <li>• Split large stories into smaller ones</li>
                <li>• Check story readiness</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Sprint Support</h4>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Sprint planning suggestions</li>
                <li>• Demo preparation</li>
                <li>• Velocity prediction</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>
          💡 <strong>Tip:</strong> Use <kbd className="px-2 py-1 bg-muted rounded text-xs">Cmd+K</kbd> to quickly focus the assistant bar from anywhere
        </p>
        <p>
          🎯 <strong>Be specific:</strong> The more context you provide, the more accurate I&apos;ll be
        </p>
      </div>
    </div>
  )
}