'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAssistantStore } from '@/lib/stores/assistant'
import { ActionResult } from '@/lib/types/assistant'
import { CheckCircle2, XCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

function ActionResultCard({ action, index }: { action: ActionResult; index: number }) {
  const isSuccess = action.success
  const StatusIcon = isSuccess ? CheckCircle2 : XCircle

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isSuccess ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
      )}
      data-testid="action-result-card"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            )}
          >
            <StatusIcon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-medium text-sm">{action.message}</p>
                <Badge
                  variant="secondary"
                  className={cn(
                    'mt-1 text-xs',
                    isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  )}
                >
                  {isSuccess ? 'Completed' : 'Failed'}
                </Badge>
              </div>
            </div>

            {/* Action Details */}
            {action.data && (
              <div className="mt-2 p-2 bg-background/50 rounded border text-xs">
                <div className="font-medium mb-1">Details:</div>
                {typeof action.data === 'object' ? (
                  <div className="space-y-1">
                    {Object.entries(action.data).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="font-medium">{key}:</span>
                        <span>{String(value)}</span>
                        {key === 'entityId' && (
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span>{String(action.data)}</span>
                )}
              </div>
            )}

            {/* Error Details */}
            {action.errors && action.errors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                <div className="flex items-center gap-1 font-medium mb-1 text-red-800">
                  <AlertCircle className="h-3 w-3" />
                  Errors:
                </div>
                <ul className="space-y-1 list-disc list-inside text-red-700">
                  {action.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 text-xs text-muted-foreground">#{index + 1}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentActions() {
  const recentActions = useAssistantStore((state) => state.recentActions)
  const clearHistory = useAssistantStore((state) => state.clearHistory)

  if (recentActions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No recent activity</p>
          <p className="text-sm mt-2">Your completed actions and their results will appear here</p>
        </CardContent>
      </Card>
    )
  }

  const successCount = recentActions.filter((a) => a.success).length
  const failureCount = recentActions.length - successCount

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{successCount} successful</span>
            </div>
            {failureCount > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>{failureCount} failed</span>
              </div>
            )}
            <div className="ml-auto">
              <button
                onClick={clearHistory}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear History
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Action List */}
      <div className="space-y-3">
        {recentActions.map((action, index) => (
          <ActionResultCard key={`${action.message}-${index}`} action={action} index={index} />
        ))}
      </div>

      {recentActions.length >= 20 && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <p>Showing the 20 most recent actions</p>
            <button onClick={clearHistory} className="text-primary hover:underline mt-1">
              Clear history to see more
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
