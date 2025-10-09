'use client'

import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { backlogApi } from '@/lib/api/backlog'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { Task, TaskStatus, StoryStatus } from '@/lib/types'
import {
  Clock,
  User,
  Play,
  CheckCircle,
  AlertCircle,
  Timer,
  Zap,
  UserCheck,
  UserMinus,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TaskOwnershipProps {
  task: Task
  showEstimate?: boolean
  showWorkflow?: boolean
  compact?: boolean
  className?: string
  storyStatus?: StoryStatus
  sprintId?: string | null
}

export function TaskOwnership({
  task,
  showEstimate = true,
  showWorkflow = true,
  compact = false,
  className = '',
  storyStatus,
  sprintId,
}: TaskOwnershipProps) {
  const [estimateDialogOpen, setEstimateDialogOpen] = useState(false)
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours?.toString() || '')
  const [estimateError, setEstimateError] = useState('')

  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { canTakeTaskOwnership } = usePermissions()
  const { user, isContributor } = useRoles()

  // Check if current user owns this task
  const isOwner = task.ownerUserId === user?.id

  const storyStatusesAllowingOwnership: StoryStatus[] = [
    'committed',
    'inprogress',
    'taskscomplete',
    'deployed',
    'awaitingacceptance',
  ]

  const isStoryInSprint = Boolean(sprintId)
  const isStoryEligibleForOwnership = isStoryInSprint
    ? !storyStatus || storyStatusesAllowingOwnership.includes(storyStatus)
    : false

  const canDisplayOwnership = canTakeTaskOwnership && isStoryEligibleForOwnership

  // Task ownership mutations
  const takeOwnershipMutation = useMutation({
    mutationFn: () => backlogApi.takeTaskOwnership(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['story', task.storyId] })
      toast({
        title: "Task ownership taken",
        description: "You are now responsible for this task",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to take ownership",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const releaseOwnershipMutation = useMutation({
    mutationFn: () => backlogApi.releaseTaskOwnership(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['story', task.storyId] })
      setReleaseDialogOpen(false)
      toast({
        title: "Ownership released",
        description: "Task is now available for others to take",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to release ownership",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const startWorkMutation = useMutation({
    mutationFn: () => backlogApi.startTaskWork(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['story', task.storyId] })
      toast({
        title: "Work started",
        description: "Task is now in progress",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to start work",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const completeWorkMutation = useMutation({
    mutationFn: () => backlogApi.completeTaskWork(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['story', task.storyId] })
      toast({
        title: "Task completed",
        description: "Great work! Task has been marked as complete",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to complete task",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const setEstimateMutation = useMutation({
    mutationFn: (hours: number | undefined) =>
      backlogApi.setTaskEstimate(task.id, { estimatedHours: hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['story', task.storyId] })
      setEstimateDialogOpen(false)
      setEstimateError('')
      toast({
        title: "Estimate updated",
        description: "Task estimate has been saved",
      })
    },
    onError: (error) => {
      setEstimateError(error instanceof Error ? error.message : "An error occurred")
    },
  })

  // Get status configuration
  const getStatusConfig = (status: TaskStatus) => {
    const configs = {
      available: {
        icon: Clock,
        label: 'Available',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        description: 'Ready for someone to take ownership'
      },
      owned: {
        icon: UserCheck,
        label: 'Owned',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Claimed but work not started'
      },
      inprogress: {
        icon: Zap,
        label: 'In Progress',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        description: 'Work is actively in progress'
      },
      completed: {
        icon: CheckCircle,
        label: 'Completed',
        color: 'bg-green-100 text-green-800 border-green-200',
        description: 'Work has been completed'
      },
    }
    return configs[status]
  }

  const statusConfig = getStatusConfig(task.status)
  const StatusIcon = statusConfig.icon

  // Handle estimate submission
  const handleEstimateSubmit = () => {
    const hours = estimatedHours ? parseInt(estimatedHours) : undefined

    if (hours !== undefined) {
      if (hours <= 0) {
        setEstimateError('Estimated hours must be greater than 0')
        return
      }
      if (hours > 40) {
        setEstimateError('Task cannot exceed 40 hours. Consider splitting this task.')
        return
      }
    }

    setEstimateMutation.mutate(hours)
  }

  // Compact view for lists
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className={statusConfig.color}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {statusConfig.label}
        </Badge>

        {task.ownerUserId && (
          <div className="flex items-center text-sm text-gray-600">
            <User className="w-3 h-3 mr-1" />
            {isOwner ? 'You' : 'Assigned'}
          </div>
        )}

        {task.estimatedHours && (
          <div className="flex items-center text-sm text-gray-600">
            <Timer className="w-3 h-3 mr-1" />
            {task.estimatedHours}h
          </div>
        )}
      </div>
    )
  }

  // Full ownership card
  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Task Ownership</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className={statusConfig.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{statusConfig.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Owner Information */}
        {task.ownerUserId && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-500" />
            <span className="font-medium">
              {isOwner ? 'You own this task' : 'Owned by another contributor'}
            </span>
          </div>
        )}

        {/* Time Tracking */}
        <div className="space-y-2 text-sm text-gray-600">
          {task.ownedAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                Owned {formatDistanceToNow(new Date(task.ownedAt), { addSuffix: true })}
              </span>
            </div>
          )}

          {task.completedAt && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>
                Completed {formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}
              </span>
            </div>
          )}

          {showEstimate && task.estimatedHours && (
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4" />
              <span>Estimated: {task.estimatedHours} hours</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Available tasks - show "I'm on it" button */}
          {task.status === 'available' && canDisplayOwnership && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => takeOwnershipMutation.mutate()}
                    disabled={takeOwnershipMutation.isPending}
                    data-testid={`take-ownership-${task.id}`}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    I&apos;m on it
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Take ownership of this task</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Available tasks - restriction message for non-contributors */}
          {task.status === 'available' && !canDisplayOwnership && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" disabled>
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Restricted
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isStoryEligibleForOwnership
                    ? <p>Only contributors can take task ownership</p>
                    : <p>Tasks can only be claimed once the story is in an active sprint</p>
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Owned tasks - owner actions */}
          {task.status === 'owned' && isOwner && (
            <>
              <Button
                size="sm"
                onClick={() => startWorkMutation.mutate()}
                disabled={startWorkMutation.isPending}
                data-testid={`start-work-${task.id}`}
              >
                <Play className="w-4 h-4 mr-1" />
                Start Work
              </Button>

              <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`release-ownership-${task.id}`}
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    Release
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="confirm-release-dialog">
                  <DialogHeader>
                    <DialogTitle>Release Task Ownership</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to release ownership of this task?
                      It will become available for other contributors to take.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setReleaseDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => releaseOwnershipMutation.mutate()}
                      disabled={releaseOwnershipMutation.isPending}
                      data-testid="confirm-release-btn"
                    >
                      Release Ownership
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* In Progress tasks - owner actions */}
          {task.status === 'inprogress' && isOwner && (
            <Button
              size="sm"
              onClick={() => completeWorkMutation.mutate()}
              disabled={completeWorkMutation.isPending}
              data-testid={`complete-work-${task.id}`}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Complete
            </Button>
          )}

          {/* Estimate button for owned tasks */}
          {(task.status === 'owned' || task.status === 'inprogress') && isOwner && showEstimate && (
            <Dialog open={estimateDialogOpen} onOpenChange={setEstimateDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`estimate-hours-${task.id}`}
                >
                  <Timer className="w-4 h-4 mr-1" />
                  {task.estimatedHours ? 'Update' : 'Add'} Estimate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Task Estimate</DialogTitle>
                  <DialogDescription>
                    How many hours do you estimate this task will take? (1-40 hours)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="hours">Estimated Hours</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="1"
                      max="40"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      placeholder="Enter hours (optional)"
                      data-testid="hours-input"
                    />
                    {estimateError && (
                      <p className="text-sm text-red-600 mt-1" data-testid="estimate-error">
                        {estimateError}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEstimateDialogOpen(false)
                      setEstimateError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEstimateSubmit}
                    disabled={setEstimateMutation.isPending}
                    data-testid="save-estimate-btn"
                  >
                    Save Estimate
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Workflow Guide */}
        {showWorkflow && isContributor && (
          <div className="text-xs text-gray-500 border-t pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-1 cursor-help"
                    data-testid={`task-workflow-help-${task.id}`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>Workflow: Available → Owned → In Progress → Completed</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent data-testid="workflow-guidance-tooltip">
                  <p>
                    1. Take ownership (&quot;I&apos;m on it&quot;)<br />
                    2. Set estimate (optional)<br />
                    3. Start work<br />
                    4. Complete task
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
