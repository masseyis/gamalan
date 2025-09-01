'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAssistantStore } from '@/lib/stores/assistant'
import { 
  Zap, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Presentation,
  ListTodo,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  Target,
  Clock
} from 'lucide-react'

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
  utterance: string
  category: 'common' | 'planning' | 'analysis'
  badge?: string
}

const QUICK_ACTIONS: QuickAction[] = [
  // Common Actions
  {
    id: 'mark-task-done',
    title: 'Mark Task Complete',
    description: 'Mark your current task as finished',
    icon: CheckCircle2,
    utterance: 'I finished my current task',
    category: 'common',
  },
  {
    id: 'story-ready',
    title: 'Check Story Readiness',
    description: 'Analyze if a story is ready for development',
    icon: Target,
    utterance: 'Check if my assigned story is ready',
    category: 'common',
  },
  {
    id: 'generate-ac',
    title: 'Generate Acceptance Criteria',
    description: 'Create Given/When/Then criteria for a story',
    icon: FileText,
    utterance: 'Generate acceptance criteria for my story',
    category: 'common',
  },
  
  // Planning Actions
  {
    id: 'split-story',
    title: 'Split Large Story',
    description: 'Break down a story into smaller pieces',
    icon: Lightbulb,
    utterance: 'Split my oversized story into smaller ones',
    category: 'planning',
  },
  {
    id: 'sprint-planning',
    title: 'Sprint Planning Help',
    description: 'Get suggestions for next sprint',
    icon: Calendar,
    utterance: 'Help me plan the next sprint',
    category: 'planning',
  },
  {
    id: 'demo-prep',
    title: 'Prepare Demo',
    description: 'Generate demo pack from completed work',
    icon: Presentation,
    utterance: 'What should I demo this sprint?',
    category: 'planning',
  },
  
  // Analysis Actions
  {
    id: 'velocity-analysis',
    title: 'Analyze Velocity',
    description: 'Get team velocity predictions',
    icon: TrendingUp,
    utterance: 'Predict our team velocity',
    category: 'analysis',
  },
  {
    id: 'risk-analysis',
    title: 'Risk Assessment',
    description: 'Identify potential project risks',
    icon: AlertCircle,
    utterance: 'Analyze risks for current sprint',
    category: 'analysis',
  },
  {
    id: 'backlog-health',
    title: 'Backlog Health Check',
    description: 'Review backlog organization and readiness',
    icon: ListTodo,
    utterance: 'Check our backlog health',
    category: 'analysis',
    badge: 'Beta'
  },
]

const CATEGORY_CONFIG = {
  common: {
    title: 'Common Actions',
    description: 'Everyday tasks and quick operations',
    icon: Zap,
  },
  planning: {
    title: 'Planning & Organization',
    description: 'Sprint planning and story management',
    icon: Calendar,
  },
  analysis: {
    title: 'Analysis & Insights',
    description: 'Team metrics and risk assessment',
    icon: TrendingUp,
  },
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const setUtterance = useAssistantStore(state => state.setUtterance)
  const Icon = action.icon

  const handleClick = () => {
    setUtterance(action.utterance)
    // Focus the assistant bar
    document.querySelector('textarea')?.focus()
  }

  return (
    <Card className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30 group">
      <CardContent className="p-4" onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                {action.title}
              </h3>
              {action.badge && (
                <Badge variant="secondary" className="text-xs">
                  {action.badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {action.description}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>&ldquo;</span>
              <span className="italic">{action.utterance}</span>
              <span>&rdquo;</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QuickActions() {
  const isProcessing = useAssistantStore(state => state.isProcessing)

  const groupedActions = Object.entries(CATEGORY_CONFIG).map(([category, config]) => ({
    ...config,
    category: category as keyof typeof CATEGORY_CONFIG,
    actions: QUICK_ACTIONS.filter(action => action.category === category)
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-primary/5 to-background">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center mb-3">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <p className="text-sm text-muted-foreground">
            Click any action below to automatically fill the assistant bar with the right command
          </p>
        </CardContent>
      </Card>

      {/* Action Categories */}
      {groupedActions.map(category => {
        const CategoryIcon = category.icon
        
        return (
          <div key={category.category} className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4" />
                  {category.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {category.actions.map(action => (
                <QuickActionCard 
                  key={action.id} 
                  action={action} 
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Processing State */}
      {isProcessing && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <Clock className="h-4 w-4 animate-pulse" />
              <span>Processing your request...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Tip */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>💡 Pro tip:</strong> You can also type custom requests directly
          </p>
          <p>
            Try being specific with IDs like &ldquo;Mark task ABC-123 as complete&rdquo; or &ldquo;Check if story XYZ-456 is ready&rdquo;
          </p>
        </CardContent>
      </Card>
    </div>
  )
}