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
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAssistantStore } from '@/lib/stores/assistant'
import { ActionCommand } from '@/lib/types/assistant'
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  CheckSquare, 
  Calendar, 
  Loader2,
  Shield,
  Zap,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

const RISK_CONFIG = {
  low: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-800',
    description: 'This action is safe and easily reversible.'
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    description: 'This action may affect multiple items. Review carefully.'
  },
  high: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-800',
    description: 'This action cannot be easily undone. Proceed with caution.'
  }
} as const

const ACTION_ICONS = {
  mark_complete: CheckCircle2,
  mark_task_complete: CheckSquare,
  generate_story_breakdown: FileText,
  generate_acceptance_criteria: FileText,
  update_status: Clock,
  assign_task: CheckSquare,
  create_sprint: Calendar,
  default: Zap
} as const

function ActionSummary({ action, entityTitle }: { action: ActionCommand; entityTitle?: string }) {
  const ActionIcon = ACTION_ICONS[action.type as keyof typeof ACTION_ICONS] || ACTION_ICONS.default
  
  return (
    <Card className="border-0 bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-background rounded-lg border">
            <ActionIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              {action.description}
            </h3>
            {entityTitle && (
              <p className="text-sm text-muted-foreground">
                Target: <span className="font-medium">{entityTitle}</span>
              </p>
            )}
            {Object.keys(action.parameters).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Parameters:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(action.parameters).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RiskAssessment({ riskLevel }: { riskLevel: ActionCommand['riskLevel'] }) {
  const config = RISK_CONFIG[riskLevel]
  const RiskIcon = config.icon
  
  return (
    <Alert className={cn("border", config.bgColor)}>
      <div className="flex items-center gap-2">
        <RiskIcon className={cn("h-4 w-4", config.color)} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">Risk Level</span>
            <Badge className={cn("text-xs", config.badge)} variant="secondary">
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            </Badge>
          </div>
          <AlertDescription className="text-xs">
            {config.description}
          </AlertDescription>
        </div>
      </div>
    </Alert>
  )
}

export function ConfirmActionDialog() {
  const {
    pendingAction,
    selectedCandidate,
    isProcessing,
    confirmAction,
    cancelAction,
  } = useAssistantStore()

  // Only show if there's a pending action but no draft (draft case is handled by ActionPreviewDialog)
  const isOpen = !!pendingAction && !pendingAction.draft
  const entityTitle = selectedCandidate?.title

  if (!isOpen || !pendingAction) return null

  const handleConfirm = async () => {
    try {
      await confirmAction()
    } catch (error) {
      console.error('Failed to confirm action:', error)
    }
  }

  // Auto-confirm for low-risk actions after a brief delay (optional)
  // useEffect(() => {
  //   if (pendingAction?.riskLevel === 'low' && !pendingAction.confirmationRequired) {
  //     const timer = setTimeout(() => {
  //       handleConfirm()
  //     }, 2000)
  //     return () => clearTimeout(timer)
  //   }
  // }, [pendingAction])

  return (
    <Dialog open={isOpen} onOpenChange={() => !isProcessing && cancelAction()}>
      <DialogContent className="max-w-lg" data-testid="confirm-action-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Confirm Action
          </DialogTitle>
          <DialogDescription>
            Please review the action details before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Summary */}
          <ActionSummary action={pendingAction} entityTitle={entityTitle} />

          {/* Risk Assessment */}
          <RiskAssessment riskLevel={pendingAction.riskLevel} />

          {/* Additional Warnings for High-Risk Actions */}
          {pendingAction.riskLevel === 'high' && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="font-medium mb-1">Important:</div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>This action cannot be easily undone</li>
                  <li>It may affect other team members' work</li>
                  <li>Consider discussing with your team first</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={cancelAction}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={cn(
              pendingAction.riskLevel === 'high' && "bg-red-600 hover:bg-red-700"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              'Confirm & Execute'
            )}
          </Button>
        </DialogFooter>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm font-medium">Executing action...</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}