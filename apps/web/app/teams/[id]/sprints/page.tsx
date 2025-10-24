'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Plus,
  Calendar,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { teamsApi, sprintsApi } from '@/lib/api/teams'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { ManagerOnly } from '@/components/guards/RoleGuard'
import { Sprint, SprintStatus } from '@/lib/types/team'

export default function TeamSprintsPage() {
  const params = useParams()
  const teamId = params.id as string
  const { canManageTeam } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    enabled: !!teamId,
  })

  const { data: sprints = [], isLoading: sprintsLoading } = useQuery({
    queryKey: ['team-sprints', teamId],
    queryFn: () => sprintsApi.getTeamSprints(teamId),
    enabled: !!teamId,
  })

  const isLoading = teamLoading || sprintsLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Team Sprints</h1>
            <p className="text-muted-foreground mt-2">Loading sprint information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href="/teams"
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
            <h1 className="text-3xl font-bold">Team Sprints</h1>
            <p className="text-muted-foreground mt-2">Team not found</p>
          </div>
        </div>
      </div>
    )
  }

  // Group sprints by status
  const activeSprints = sprints.filter((s: Sprint) => s.status === 'active')
  const planningSprints = sprints.filter((s: Sprint) => s.status === 'planning')
  const reviewSprints = sprints.filter((s: Sprint) => s.status === 'review')
  const completedSprints = sprints.filter((s: Sprint) => s.status === 'completed')

  const getStatusIcon = (status: SprintStatus) => {
    switch (status) {
      case 'planning':
        return <Clock className="h-4 w-4" />
      case 'active':
        return <PlayCircle className="h-4 w-4" />
      case 'review':
        return <PauseCircle className="h-4 w-4" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: SprintStatus) => {
    switch (status) {
      case 'planning':
        return 'secondary'
      case 'active':
        return 'default'
      case 'review':
        return 'outline'
      case 'completed':
        return 'secondary'
      default:
        return 'destructive'
    }
  }

  const calculateProgress = (sprint: Sprint) => {
    if (sprint.committedPoints === 0) return 0
    return Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  }

  const SprintCard = ({ sprint }: { sprint: Sprint }) => (
    <Card key={sprint.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            <Link href={`/teams/${teamId}/sprints/${sprint.id}`} className="hover:text-blue-600">
              {sprint.name}
            </Link>
          </CardTitle>
          <Badge variant={getStatusColor(sprint.status) as any}>
            <div className="flex items-center gap-1">
              {getStatusIcon(sprint.status)}
              <span className="capitalize">{sprint.status}</span>
            </div>
          </Badge>
        </div>
        {sprint.goal && <CardDescription className="text-sm">{sprint.goal}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sprint Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gray-500" />
            <span>{sprint.capacityPoints} capacity</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <span>
              {sprint.completedPoints}/{sprint.committedPoints} points
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {sprint.status === 'active' && sprint.committedPoints > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{calculateProgress(sprint)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, calculateProgress(sprint))}%` }}
              />
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>
            {new Date(sprint.startDate).toLocaleDateString()} -{' '}
            {new Date(sprint.endDate).toLocaleDateString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Link href={`/teams/${teamId}/sprints/${sprint.id}`} className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              View Details
            </Button>
          </Link>
          {sprint.status === 'planning' && canManageTeam && (
            <Link href={`/teams/${teamId}/sprints/${sprint.id}/edit`} className="flex-1">
              <Button variant="outline" className="w-full" size="sm">
                Edit
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {team.name}
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Sprint Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage sprints and track team velocity for {team.name}
              </p>
              {user && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">
                    Viewing as: <Badge variant="outline">{getRoleDisplayName()}</Badge>
                  </span>
                </div>
              )}
            </div>

            <ManagerOnly
              fallback={
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button disabled>
                        <Plus className="h-4 w-4 mr-2" />
                        New Sprint
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Only Product Owners and Managing Contributors can create sprints</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }
            >
              <Link href={`/teams/${teamId}/sprints/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Sprint
                </Button>
              </Link>
            </ManagerOnly>
          </div>
        </div>

        {sprints.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sprints yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first sprint to start tracking team velocity and organizing work.
            </p>
            {canManageTeam && (
              <Link href={`/teams/${teamId}/sprints/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Sprint
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Sprint */}
            {activeSprints.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Active Sprint</h2>
                <div className="grid grid-cols-1 gap-4">
                  {activeSprints.map((sprint) => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </div>
              </div>
            )}

            {/* Planning Sprints */}
            {planningSprints.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Planning ({planningSprints.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {planningSprints.map((sprint) => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </div>
              </div>
            )}

            {/* Review Sprints */}
            {reviewSprints.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">In Review ({reviewSprints.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewSprints.map((sprint) => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Sprints */}
            {completedSprints.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Completed ({completedSprints.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedSprints.slice(0, 6).map((sprint) => (
                    <SprintCard key={sprint.id} sprint={sprint} />
                  ))}
                </div>
                {completedSprints.length > 6 && (
                  <div className="text-center mt-4">
                    <p className="text-sm text-gray-500">
                      Showing 6 of {completedSprints.length} completed sprints
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sprint Management Guide */}
        {user && ['product_owner', 'managing_contributor'].includes(user.role) && (
          <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Calendar className="w-6 h-6 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">Sprint Management Guide</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    • <strong>Planning:</strong> Set capacity, define goals, and prepare stories
                    before starting
                  </p>
                  <p>
                    • <strong>Active:</strong> Track progress daily, manage scope changes carefully
                  </p>
                  <p>
                    • <strong>Review:</strong> Demo completed work and gather feedback before
                    closing
                  </p>
                  <p>
                    • <strong>Velocity:</strong> Use completed points to improve future sprint
                    planning
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
