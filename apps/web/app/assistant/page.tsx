'use client'

import { SuggestionFeed } from '@/components/assistant/suggestion-feed'
import { AssistantWelcome } from '@/components/assistant/assistant-welcome'
import { useAssistantStore, useAutoFetchSuggestions } from '@/lib/stores/assistant'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RecentActions } from '@/components/assistant/recent-actions'
import { QuickActions } from '@/components/assistant/quick-actions'

export default function AssistantPage() {
  const suggestions = useAssistantStore(state => state.suggestions)
  const recentActions = useAssistantStore(state => state.recentActions)
  
  // Auto-fetch suggestions when component mounts
  useAutoFetchSuggestions()

  const hasSuggestions = suggestions.length > 0
  const hasRecentActions = recentActions.length > 0

  return (
    <div className="container py-6 space-y-6">
      {/* Welcome section - only show if no recent activity */}
      {!hasSuggestions && !hasRecentActions && <AssistantWelcome />}

      {/* Main content tabs */}
      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <span>Suggestions</span>
            {hasSuggestions && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {suggestions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          <TabsTrigger value="history">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          {hasSuggestions ? (
            <SuggestionFeed />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-lg">No suggestions at the moment</p>
                <p className="text-sm mt-2">
                  I'll notify you when there are opportunities to improve your workflow
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="actions">
          <QuickActions />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {hasRecentActions ? (
            <RecentActions />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-lg">No recent activity</p>
                <p className="text-sm mt-2">
                  Your recent actions and completions will appear here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}