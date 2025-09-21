'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Calendar,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Settings,
  Users,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { teamsApi, sprintsApi, sprintHelpers } from '@/lib/api/teams'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { ManagerOnly } from '@/components/guards/RoleGuard'
import { useToast } from '@/hooks/use-toast'
import { SprintStatus } from '@/lib/types/team'

export default function SprintDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const sprintId = params.sprintId as string
  const { canManageTeam } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    enabled: !!teamId,
  })

  const { data: sprint, isLoading: sprintLoading, error: sprintError } = useQuery({
    queryKey: ['sprint', teamId, sprintId],
    queryFn: () => sprintsApi.getSprint(teamId, sprintId),
    enabled: !!teamId && !!sprintId,
  })

  const updateSprintStatusMutation = useMutation({
    mutationFn: ({ sprintId, status }: { sprintId: string; status: SprintStatus }) =>
      sprintsApi.updateSprintStatus(sprintId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', teamId, sprintId] })
      queryClient.invalidateQueries({ queryKey: ['team-sprints', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      setStatusUpdateDialogOpen(false)
      toast({
        title: "Sprint status updated",
        description: "Sprint status has been changed successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to update sprint status",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const deleteSprintMutation = useMutation({
    mutationFn: () => sprintsApi.deleteSprint(sprintId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-sprints', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      toast({
        title: "Sprint deleted",
        description: "Sprint has been permanently deleted",
      })
      window.location.href = `/teams/${teamId}/sprints`
    },
    onError: (error) => {
      toast({
        title: "Failed to delete sprint",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const isLoading = teamLoading || sprintLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sprint Details</h1>
            <p className="text-muted-foreground mt-2">Loading sprint information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (sprintError || !sprint || !team) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link href={`/teams/${teamId}/sprints`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sprints
            </Link>
            <h1 className="text-3xl font-bold">Sprint Details</h1>
            <p className="text-muted-foreground mt-2">Sprint not found or failed to load</p>
          </div>
        </div>
      </div>
    )
  }

  const getStatusIcon = (status: SprintStatus) => {
    switch (status) {
      case 'planning':
        return <Clock className="h-5 w-5" />
      case 'active':
        return <PlayCircle className="h-5 w-5" />
      case 'review':
        return <PauseCircle className="h-5 w-5" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
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

  const progress = sprintHelpers.calculateSprintProgress(sprint)
  const daysRemaining = sprintHelpers.getDaysRemaining(sprint)

  const getNextStatus = (currentStatus: SprintStatus): SprintStatus | null => {
    switch (currentStatus) {
      case 'planning':
        return 'active'
      case 'active':
        return 'review'
      case 'review':
        return 'completed'
      default:
        return null
    }
  }

  const getStatusActionLabel = (status: SprintStatus) => {
    switch (status) {
      case 'planning':
        return 'Start Sprint'
      case 'active':
        return 'End Sprint'
      case 'review':
        return 'Complete Sprint'
      default:
        return null
    }
  }

  const canUpdateStatus = (status: SprintStatus) => {
    switch (status) {
      case 'planning':
        return sprintHelpers.canStartSprint(sprint)
      case 'active':
        return sprintHelpers.canEndSprint(sprint)
      case 'review':
        return sprintHelpers.canCompleteSprint(sprint)
      default:
        return false
    }
  }

  const canDelete = sprint.status === 'planning'
  const nextStatus = getNextStatus(sprint.status)
  const statusActionLabel = getStatusActionLabel(sprint.status)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href={`/teams/${teamId}/sprints`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sprints
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{sprint.name}</h1>
                <Badge variant={getStatusColor(sprint.status) as any} className="text-sm">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(sprint.status)}
                    <span className="capitalize">{sprint.status}</span>
                  </div>
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Sprint for {team.name} • {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
              </p>
              {user && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">
                    Viewing as: <Badge variant="outline">{getRoleDisplayName()}</Badge>
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Status Update Button */}
              {nextStatus && canManageTeam && canUpdateStatus(sprint.status) && (
                <ManagerOnly fallback={null}>
                  <Dialog open={statusUpdateDialogOpen} onOpenChange={setStatusUpdateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        {getStatusIcon(nextStatus)}
                        <span className="ml-2">{statusActionLabel}</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{statusActionLabel}</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to {statusActionLabel?.toLowerCase()}? This will change the sprint status from{' '}
                          <strong>{sprint.status}</strong> to <strong>{nextStatus}</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setStatusUpdateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => updateSprintStatusMutation.mutate({ sprintId, status: nextStatus })}
                          disabled={updateSprintStatusMutation.isPending}
                        >
                          {updateSprintStatusMutation.isPending ? 'Updating...' : statusActionLabel}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </ManagerOnly>
              )}

              {/* Edit Button */}
              {sprint.status === 'planning' && canManageTeam && (
                <ManagerOnly fallback={null}>
                  <Link href={`/teams/${teamId}/sprints/${sprintId}/edit`}>
                    <Button variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                </ManagerOnly>
              )}

              {/* Settings Button */}
              <ManagerOnly fallback={
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" disabled>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Only Product Owners and Managing Contributors can modify sprint settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }>
                <Button variant="outline">
                  <Settings className="h-4 w-4" />
                </Button>
              </ManagerOnly>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sprint Goal */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Goal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{sprint.goal}</p>
              </CardContent>
            </Card>

            {/* Progress Overview */}
            {sprint.status === 'active' && (
              <Card>
                <CardHeader>
                  <CardTitle>Progress Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{sprint.completedPoints}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">{sprint.committedPoints - sprint.completedPoints}</div>
                      <div className="text-sm text-gray-600">Remaining</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{progress.progressPercentage}%</div>
                      <div className="text-sm text-gray-600">Complete</div>
                    </div>
                  </div>

                  {sprint.committedPoints > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Sprint Progress</span>
                        <span>{progress.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${
                            progress.isOnTrack ? 'bg-green-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(100, progress.progressPercentage)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>On Track: {progress.isOnTrack ? 'Yes' : 'No'}</span>
                        <span>{daysRemaining} days remaining</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sprint Backlog Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Backlog</CardTitle>
                <CardDescription>
                  Stories committed to this sprint
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Target className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">Sprint backlog integration</h4>
                  <p className="text-gray-500 mb-4">
                    Story management will be integrated in a future update.
                  </p>
                  <Button variant="outline" disabled>
                    Manage Stories
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sprint Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="font-medium">{sprint.capacityPoints} points</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Committed</span>
                  <span className="font-medium">{sprint.committedPoints} points</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{sprint.completedPoints} points</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {Math.ceil((new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-sm">
                    {new Date(sprint.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sprint Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Start: {new Date(sprint.startDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>End: {new Date(sprint.endDate).toLocaleDateString()}</span>
                </div>
                {sprint.status === 'active' && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-orange-700">{daysRemaining} days remaining</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sprint Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Target className="h-4 w-4 mr-2" />
                  Manage Stories
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <Users className="h-4 w-4 mr-2" />
                  Sprint Retrospective
                </Button>

                {/* Delete Sprint */}
                {canDelete && canManageTeam && (
                  <ManagerOnly fallback={null}>
                    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full justify-start">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Sprint
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Sprint</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete &quot;{sprint.name}&quot;?
                            This action cannot be undone and will permanently remove the sprint
                            and all associated data.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => deleteSprintMutation.mutate()}
                            disabled={deleteSprintMutation.isPending}
                          >
                            {deleteSprintMutation.isPending ? 'Deleting...' : 'Delete Sprint'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </ManagerOnly>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}