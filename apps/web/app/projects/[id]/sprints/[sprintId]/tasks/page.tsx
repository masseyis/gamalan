'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SprintTaskBoard } from '@/components/sprint/SprintTaskBoard'
import { backlogApi } from '@/lib/api/backlog'
import { sprintsApi } from '@/lib/api/teams'
import { useUserContext } from '@/components/providers/UserContextProvider'

/**
 * Sprint Task Board Page
 *
 * Displays all tasks from all stories in a sprint with:
 * - Sprint header showing name, dates, days remaining, and progress
 * - Filtering by task status
 * - Grouping by story or status
 * - Visual distinction for available tasks and current user's tasks
 * - Real-time updates via WebSocket
 *
 * Route: /projects/[id]/sprints/[sprintId]/tasks
 *
 * Acceptance Criteria:
 * - AC1: Display all task information (ID, title, status, owner, parent story, AC refs)
 * - AC2: Filter by status and group by story/status with counts
 * - AC3: Visual distinction for available tasks and current user's tasks
 * - AC4: Real-time updates without page refresh
 * - AC5: Sprint header with name, dates, progress, and story count
 */
export default function SprintTaskBoardPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUserContext()
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth()

  const projectId = params.id as string
  const sprintId = params.sprintId as string

  // Wait for Clerk to load and have a signed-in user before making authenticated API calls
  const canMakeAuthenticatedCalls = isClerkLoaded && isSignedIn

  // Fetch sprint data (wait for Clerk auth to be ready)
  const {
    data: sprint,
    isLoading: sprintLoading,
    error: sprintError,
    refetch: refetchSprint,
  } = useQuery({
    queryKey: ['sprint', projectId, sprintId],
    queryFn: () => sprintsApi.getSprint(projectId, sprintId),
    enabled: !!projectId && !!sprintId && canMakeAuthenticatedCalls,
  })

  // Fetch stories with tasks for this sprint (wait for Clerk auth to be ready)
  const {
    data: stories,
    isLoading: storiesLoading,
    error: storiesError,
    refetch: refetchStories,
  } = useQuery({
    queryKey: ['stories', projectId, sprintId],
    queryFn: () => backlogApi.getStories(projectId, sprintId, undefined, { includeTasks: true }),
    enabled: !!projectId && !!sprintId && canMakeAuthenticatedCalls,
  })

  const isLoading = !isClerkLoaded || sprintLoading || storiesLoading || userLoading
  const error = sprintError || storiesError

  // Handle refresh from WebSocket events
  const handleRefresh = () => {
    refetchSprint()
    refetchStories()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href={`/projects/${projectId}/sprints`}
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sprints
            </Link>
            <h1 className="text-3xl font-bold">Sprint Task Board</h1>
            <p className="text-muted-foreground mt-2">Loading sprint tasks...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state (only show if not loading)
  if (!isLoading && (error || !sprint)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href={`/projects/${projectId}/sprints`}
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sprints
            </Link>
            <h1 className="text-3xl font-bold">Sprint Task Board</h1>
          </div>

          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-destructive mb-2">Error Loading Sprint</h3>
                  <p className="text-muted-foreground">
                    {error instanceof Error ? error.message : 'Failed to load sprint data'}
                  </p>
                  <Button onClick={handleRefresh} className="mt-4" variant="outline">
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // If no sprint data yet, show nothing (loading state already handled above)
  if (!sprint) {
    return null
  }

  // Main content
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Page Header */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}/sprints`}
            className="inline-flex items-center text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sprints
          </Link>
        </div>

        {/* Sprint Task Board Component */}
        <SprintTaskBoard
          sprint={sprint}
          stories={stories || []}
          currentUserId={user?.id}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  )
}
