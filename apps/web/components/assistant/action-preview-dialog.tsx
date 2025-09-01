'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAssistantStore } from '@/lib/stores/assistant'
import { ActionDraft, ActionStep } from '@/lib/types/assistant'
import { 
  Eye,
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Zap, 
  ArrowRight,
  Play,
  Settings,
  Bell,
  Shield,
  Lightbulb,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const STEP_ICONS = {
  validation: CheckCircle2,
  api_call: Zap,
  update_status: Settings,
  create_item: Play,
  send_notification: Bell,
} as const

const RISK_CONFIG = {
  low: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-800',
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
  },
  high: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-800',
  }
} as const

function ActionStepCard({ step, index }: { step: ActionStep; index: number }) {
  const StepIcon = STEP_ICONS[step.type] || Settings
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="transition-all duration-200 hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
            {index + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <StepIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium text-sm">{step.description}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {step.type.replace('_', ' ')}
                    </Badge>
                    {step.canSkip && (
                      <Badge variant="secondary" className="text-xs">
                        Optional
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-muted-foreground"
              >
                {isExpanded ? '−' : '+'}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="pl-9 text-sm text-muted-foreground">
            <p className="leading-relaxed">{step.details}</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export function ActionPreviewDialog() {
  const {
    pendingAction,
    selectedCandidate,
    isProcessing,
    confirmAction,
    cancelAction,
  } = useAssistantStore()

  // Only show preview if action has draft and we haven't confirmed yet
  const isOpen = !!pendingAction?.draft && !isProcessing
  const draft = pendingAction?.draft
  const entityTitle = selectedCandidate?.title

  if (!isOpen || !pendingAction || !draft) return null

  const riskConfig = RISK_CONFIG[pendingAction.riskLevel]
  const RiskIcon = riskConfig.icon

  const handleProceed = async () => {
    try {
      await confirmAction()
    } catch (error) {
      console.error('Failed to execute action:', error)
    }
  }

  const requiredSteps = draft.steps.filter(step => !step.canSkip)
  const optionalSteps = draft.steps.filter(step => step.canSkip)

  return (
    <Dialog open={isOpen} onOpenChange={() => !isProcessing && cancelAction()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="action-preview-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Action Preview
          </DialogTitle>
          <DialogDescription>
            Review what I&apos;m planning to do before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Summary Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                What I&apos;ll Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{draft.summary}</p>
              
              {entityTitle && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  <span>Target: <strong>{entityTitle}</strong></span>
                </div>
              )}
              
              {draft.estimatedTime && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Estimated time: {draft.estimatedTime}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          <Alert className={cn("border", riskConfig.bgColor)}>
            <div className="flex items-center gap-2">
              <RiskIcon className={cn("h-4 w-4", riskConfig.color)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">Risk Level</span>
                  <Badge className={cn("text-xs", riskConfig.badge)} variant="secondary">
                    {pendingAction.riskLevel.charAt(0).toUpperCase() + pendingAction.riskLevel.slice(1)}
                  </Badge>
                </div>
                <AlertDescription className="text-xs">
                  {pendingAction.riskLevel === 'low' && 'This action is safe and easily reversible.'}
                  {pendingAction.riskLevel === 'medium' && 'This action may affect multiple items. Review carefully.'}
                  {pendingAction.riskLevel === 'high' && 'This action cannot be easily undone. Proceed with caution.'}
                </AlertDescription>
              </div>
            </div>
          </Alert>

          {/* Steps to Execute */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Steps to Execute ({requiredSteps.length} required)
            </h3>
            
            <div className="space-y-3">
              {requiredSteps.map((step, index) => (
                <ActionStepCard key={step.id} step={step} index={index} />
              ))}
            </div>

            {optionalSteps.length > 0 && (
              <>
                <h4 className="font-medium text-sm text-muted-foreground mt-6">
                  Optional Steps ({optionalSteps.length})
                </h4>
                <div className="space-y-2">
                  {optionalSteps.map((step, index) => (
                    <ActionStepCard 
                      key={step.id} 
                      step={step} 
                      index={requiredSteps.length + index} 
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* AI Reasoning */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Why I&apos;m Suggesting This</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {draft.reasoning}
              </p>
            </CardContent>
          </Card>

          {/* Expected Outcome */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Expected Outcome
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700 leading-relaxed">
                {draft.expectedOutcome}
              </p>
            </CardContent>
          </Card>

          {/* Potential Issues */}
          {draft.potentialIssues && draft.potentialIssues.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Things to Consider
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {draft.potentialIssues.map((issue, index) => (
                    <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 flex-shrink-0" />
                      <span className="leading-relaxed">{issue}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={cancelAction}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProceed}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90"
          >
            <Play className="mr-2 h-4 w-4" />
            Proceed with Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}