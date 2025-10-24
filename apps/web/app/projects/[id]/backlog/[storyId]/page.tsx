'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Edit,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  User,
  Timer,
  AlertTriangle,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { aiApi } from '@/lib/api/ai'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { TaskOwnership } from '@/components/tasks/TaskOwnership'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { CanModifyBacklog, CanAcceptStories } from '@/components/guards/RoleGuard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import type { ReadinessEvaluation } from '@/lib/types/ai'

// Updated status config to match new 9-stage workflow
const statusConfig = {
  draft: { icon: Circle, label: 'Draft', color: 'text-gray-500', stage: 1 },
  needsrefinement: { icon: Circle, label: 'Needs Refinement', color: 'text-orange-500', stage: 2 },
  ready: { icon: CheckCircle2, label: 'Ready', color: 'text-green-500', stage: 3 },
  committed: { icon: Zap, label: 'Committed', color: 'text-blue-500', stage: 4 },
  inprogress: { icon: Clock, label: 'In Progress', color: 'text-yellow-500', stage: 5 },
  taskscomplete: {
    icon: CheckCircle2,
    label: 'Tasks Complete',
    color: 'text-purple-500',
    stage: 6,
  },
  deployed: { icon: Zap, label: 'Deployed', color: 'text-indigo-500', stage: 7 },
  awaitingacceptance: {
    icon: Clock,
    label: 'Awaiting Acceptance',
    color: 'text-pink-500',
    stage: 8,
  },
  accepted: { icon: CheckCircle2, label: 'Accepted', color: 'text-green-600', stage: 9 },

  // Legacy mappings for compatibility
  backlog: { icon: CheckCircle2, label: 'Ready', color: 'text-green-500', stage: 3 },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-yellow-500', stage: 5 },
  'in-review': { icon: Clock, label: 'In Review', color: 'text-orange-500', stage: 8 },
  done: { icon: CheckCircle2, label: 'Done', color: 'text-green-600', stage: 9 },
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
}

export default function StoryDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const storyId = params.storyId as string
  const { canModifyBacklog, canAcceptStories } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [isEditStoryOpen, setIsEditStoryOpen] = useState(false)
  const [isAddCriterionOpen, setIsAddCriterionOpen] = useState(false)
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideConfirmation, setOverrideConfirmation] = useState('')

  const [editStoryTitle, setEditStoryTitle] = useState('')
  const [editStoryDescription, setEditStoryDescription] = useState('')
  const [editStoryPoints, setEditStoryPoints] = useState<string>('')

  const [criterionGiven, setCriterionGiven] = useState('')
  const [criterionWhen, setCriterionWhen] = useState('')
  const [criterionThen, setCriterionThen] = useState('')

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskAcceptanceRefs, setTaskAcceptanceRefs] = useState<string[]>([])
  const [taskManualRefs, setTaskManualRefs] = useState('')

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const {
    data: story,
    isLoading: storyLoading,
    error: storyError,
  } = useQuery({
    queryKey: ['stories', projectId, storyId],
    queryFn: () => backlogApi.getStory(projectId, storyId),
    enabled: !!projectId && !!storyId,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId, storyId],
    queryFn: () => backlogApi.getTasks(projectId, storyId),
    enabled: !!projectId && !!storyId,
  })

  const { data: acceptanceCriteria = [], isLoading: acLoading } = useQuery({
    queryKey: ['acceptance-criteria', projectId, storyId],
    queryFn: () => backlogApi.getAcceptanceCriteria(projectId, storyId),
    enabled: !!projectId && !!storyId,
  })

  const {
    data: readinessEvaluation,
    isLoading: readinessLoading,
    isFetching: readinessFetching,
    refetch: refetchReadiness,
    error: readinessError,
  } = useQuery<ReadinessEvaluation>({
    queryKey: ['story-readiness', projectId, storyId, story?.updatedAt],
    queryFn: () => aiApi.checkStoryReadiness(projectId, storyId),
    enabled: !!projectId && !!storyId && !!story,
  })

  const updateStoryMutation = useMutation({
    mutationFn: (payload: { title?: string; description?: string; storyPoints?: number }) =>
      backlogApi.updateStory(projectId, storyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId, storyId] })
      toast({ title: 'Story updated', description: 'Story details saved successfully.' })
      setIsEditStoryOpen(false)
      refetchReadiness()
    },
    onError: (error) => {
      toast({
        title: 'Failed to update story',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const applyReadyMutation = useMutation({
    mutationFn: () => backlogApi.updateStoryStatus(projectId, storyId, 'ready'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId, storyId] })
      toast({
        title: 'Story marked as Ready',
        description: 'Status updated based on readiness review.',
      })
      refetchReadiness()
    },
    onError: (error) => {
      toast({
        title: 'Failed to mark story ready',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const overrideReadyMutation = useMutation({
    mutationFn: (reason?: string) =>
      backlogApi.overrideStoryReady(
        projectId,
        storyId,
        reason && reason.trim() ? reason.trim() : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId, storyId] })
      toast({
        title: 'Readiness override recorded',
        description: 'Story marked as Ready with manual override.',
      })
      setOverrideDialogOpen(false)
      setOverrideReason('')
      setOverrideConfirmation('')
      refetchReadiness()
    },
    onError: (error) => {
      toast({
        title: 'Failed to override readiness',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const createCriterionMutation = useMutation({
    mutationFn: (payload: { given: string; when: string; then: string }) =>
      backlogApi.createAcceptanceCriterion(projectId, storyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acceptance-criteria', projectId, storyId] })
      toast({ title: 'Acceptance criterion added' })
      setIsAddCriterionOpen(false)
      setCriterionGiven('')
      setCriterionWhen('')
      setCriterionThen('')
    },
    onError: (error) => {
      toast({
        title: 'Failed to add acceptance criterion',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      title: string
      description?: string
      acceptanceCriteriaRefs: string[]
    }) => backlogApi.createTask(projectId, storyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId, storyId] })
      toast({ title: 'Task created' })
      setIsAddTaskOpen(false)
      setTaskTitle('')
      setTaskDescription('')
      setTaskAcceptanceRefs([])
      setTaskManualRefs('')
    },
    onError: (error) => {
      toast({
        title: 'Failed to add task',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const isLoading = projectLoading || storyLoading || tasksLoading || acLoading

  // Seed form fields when story data is available
  useEffect(() => {
    if (story) {
      setEditStoryTitle(story.title)
      setEditStoryDescription(story.description ?? '')
      setEditStoryPoints(story.storyPoints ? String(story.storyPoints) : '')
    }
  }, [story])

  useEffect(() => {
    if (isAddTaskOpen) {
      if (acceptanceCriteria.length) {
        setTaskAcceptanceRefs(acceptanceCriteria.map((criterion) => criterion.id))
      } else {
        setTaskAcceptanceRefs([])
      }
      setTaskManualRefs('')
    }
  }, [isAddTaskOpen, acceptanceCriteria])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Story Details</h1>
            <p className="text-muted-foreground mt-2">Loading story details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (storyError || !story || !project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href={`/projects/${projectId}/backlog`}
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Backlog
            </Link>
            <h1 className="text-3xl font-bold">Story Details</h1>
            <p className="text-muted-foreground mt-2">Story not found or failed to load</p>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[story.status] || {
    icon: Circle,
    label: 'Unknown',
    color: 'text-gray-500',
    stage: 0,
  }
  const StatusIcon = statusInfo.icon

  // Calculate task completion progress
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const handleStorySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    updateStoryMutation.mutate({
      title: editStoryTitle.trim() || undefined,
      description: editStoryDescription.trim() || undefined,
      storyPoints: editStoryPoints ? Number(editStoryPoints) : undefined,
    })
  }

  const handleAddCriterion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createCriterionMutation.mutate({
      given: criterionGiven.trim(),
      when: criterionWhen.trim(),
      then: criterionThen.trim(),
    })
  }

  const handleAddTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    let finalRefs: string[]

    if (acceptanceCriteria.length) {
      finalRefs = taskAcceptanceRefs.length
        ? taskAcceptanceRefs
        : acceptanceCriteria.map((criterion) => criterion.id)
    } else {
      const manual = taskManualRefs
        .split(',')
        .map((ref) => ref.trim())
        .filter(Boolean)

      finalRefs = manual.length ? manual : ['AC-1']
    }

    createTaskMutation.mutate({
      title: taskTitle.trim(),
      description: taskDescription.trim() || undefined,
      acceptanceCriteriaRefs: finalRefs,
    })
  }

  const toggleTaskRef = (id: string) => {
    setTaskAcceptanceRefs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href={`/projects/${projectId}/backlog`}
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Backlog
            </Link>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
                          <Badge
                            variant="outline"
                            className={statusInfo.color.replace('text-', 'border-')}
                          >
                            {statusInfo.label}
                          </Badge>
                          <span className="text-xs text-gray-500">({statusInfo.stage}/9)</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Stage {statusInfo.stage} of 9: {statusInfo.label}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {story.storyPoints && (
                    <Badge variant="outline" className="text-blue-700 border-blue-200">
                      {story.storyPoints} pts
                    </Badge>
                  )}

                  {story.sprintId && (
                    <Badge variant="outline" className="text-purple-700 border-purple-200">
                      In Sprint
                    </Badge>
                  )}

                  <span className="text-muted-foreground text-sm">#{story.id.slice(-6)}</span>
                </div>

                <h1 className="text-3xl font-bold" data-testid={`story-title-${story.id}`}>
                  {story.title}
                </h1>

                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span>{project.name}</span>
                  {user && (
                    <span>
                      Viewing as:{' '}
                      <Badge variant="outline" className="ml-1">
                        {getRoleDisplayName()}
                      </Badge>
                    </span>
                  )}
                  {story.assignedToUserId && (
                    <span className="text-blue-600">
                      <User className="w-4 h-4 inline mr-1" />
                      Assigned
                    </span>
                  )}
                </div>

                {/* Task Progress */}
                {totalTasks > 0 && (
                  <div className="mt-4 max-w-md">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Task Progress</span>
                      <span>
                        {completedTasks}/{totalTasks} completed
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <CanModifyBacklog
                fallback={
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button disabled>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Story
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Only Product Owners can edit stories</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                }
              >
                <Button onClick={() => setIsEditStoryOpen(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Story
                </Button>
              </CanModifyBacklog>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Story Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {story.description || 'No description provided'}
                  </p>
                </CardContent>
              </Card>

              {/* Acceptance Criteria */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle>Acceptance Criteria</CardTitle>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant={acceptanceCriteria.length >= 3 ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {acceptanceCriteria.length}/3+
                              </Badge>
                              <span className="text-gray-400 cursor-help">ℹ️</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Stories need 3+ acceptance criteria to be considered Ready</p>
                            <p className="text-xs text-gray-300">
                              {acceptanceCriteria.length >= 3
                                ? '✅ This story meets the readiness requirement'
                                : `⚠️ Need ${3 - acceptanceCriteria.length} more criteria`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <CanModifyBacklog
                      fallback={
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" disabled>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Criterion
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Only Product Owners can modify acceptance criteria</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="add-acceptance-criteria"
                        onClick={() => setIsAddCriterionOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Criterion
                      </Button>
                    </CanModifyBacklog>
                  </div>
                </CardHeader>
                <CardContent>
                  {acceptanceCriteria.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">
                        No acceptance criteria defined yet
                      </p>
                      <p className="text-sm text-orange-600">
                        ⚠️ Stories need 3+ acceptance criteria to be Ready for sprint
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {acceptanceCriteria.map((ac, index) => (
                        <div key={ac.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">Criterion {index + 1}</h4>
                            {ac.acId && (
                              <Badge variant="outline" className="text-xs">
                                ID: {ac.acId}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm space-y-1">
                            <p>
                              <span className="font-medium text-green-700">Given:</span> {ac.given}
                            </p>
                            <p>
                              <span className="font-medium text-blue-700">When:</span>{' '}
                              {ac.whenClause}
                            </p>
                            <p>
                              <span className="font-medium text-purple-700">Then:</span>{' '}
                              {ac.thenClause}
                            </p>
                          </div>
                          {ac.description && (
                            <p className="text-xs text-gray-600 mt-2">{ac.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tasks */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle>Tasks</CardTitle>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant={taskProgress === 100 ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {completedTasks}/{totalTasks}
                              </Badge>
                              <span className="text-gray-400 cursor-help">ℹ️</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Task completion drives story progress through workflow stages</p>
                            <p className="text-xs text-gray-300">
                              {taskProgress === 100
                                ? '✅ All tasks complete - story can move to Tasks Complete stage'
                                : `⚠️ ${totalTasks - completedTasks} tasks remaining`}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <CanModifyBacklog
                      fallback={
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="outline" disabled>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Task
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Only Product Owners can add tasks</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="add-task"
                        onClick={() => setIsAddTaskOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                      </Button>
                    </CanModifyBacklog>
                  </div>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">No tasks created yet</p>
                      <p className="text-sm text-orange-600">
                        ⚠️ Stories need tasks to track progress through workflow stages
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {tasks.map((task) => (
                        <div key={task.id} className="space-y-4">
                          {/* Task Basic Info */}
                          <div className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4
                                  className="font-medium text-lg"
                                  data-testid={`task-title-${task.id}`}
                                >
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {task.description}
                                  </p>
                                )}
                                {task.id && (
                                  <span className="text-xs text-gray-500">
                                    #{task.id.slice(-6)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Task Ownership Component */}
                            <TaskOwnership
                              task={task}
                              showEstimate={true}
                              showWorkflow={true}
                              compact={false}
                              storyStatus={story.status}
                              sprintId={story.sprintId}
                              projectId={projectId}
                            />
                          </div>
                        </div>
                      ))}

                      {/* Task Workflow Guide for Contributors */}
                      {user &&
                        (user.role === 'contributor' || user.role === 'managing_contributor') && (
                          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-3">
                              <Timer className="w-5 h-5 text-blue-600 mt-0.5" />
                              <div className="flex-1">
                                <h5 className="font-medium text-blue-900 mb-2">
                                  Task Self-Selection Workflow
                                </h5>
                                <div className="text-sm text-blue-800 space-y-1">
                                  <p>
                                    • <strong>Available tasks:</strong> Click &quot;I&apos;m on
                                    it&quot; to take ownership
                                  </p>
                                  <p>
                                    • <strong>Owned tasks:</strong> Add time estimate, then start
                                    work
                                  </p>
                                  <p>
                                    • <strong>In Progress:</strong> Complete when finished
                                  </p>
                                  <p>
                                    • <strong>One at a time:</strong> Complete current task before
                                    taking another
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* AI Assistant */}
              <AIAssistant projectId={projectId} storyId={storyId} context="story" />

              {/* AI Readiness Review */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI Readiness Review
                  </CardTitle>
                  <CardDescription>
                    Automatic guidance to determine when the story is sprint-ready.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {readinessLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Evaluating story readiness…</span>
                    </div>
                  ) : readinessError ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        <span>
                          {readinessError instanceof Error
                            ? readinessError.message
                            : 'Unable to run readiness check. Please try again.'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refetchReadiness()}
                        disabled={readinessFetching}
                      >
                        {readinessFetching && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        Retry Check
                      </Button>
                    </div>
                  ) : readinessEvaluation ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant={readinessEvaluation.isReady ? 'default' : 'destructive'}>
                          {readinessEvaluation.isReady ? 'Ready for Sprint' : 'Needs Refinement'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Score: {readinessEvaluation.score}/100
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{readinessEvaluation.summary}</p>

                      {readinessEvaluation.missingItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Blocking Items
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-red-600">
                            {readinessEvaluation.missingItems.map((item, index) => (
                              <li key={index} className="flex gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {readinessEvaluation.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Suggested Actions
                          </p>
                          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                            {readinessEvaluation.recommendations.map((item, index) => (
                              <li key={index} className="flex gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {story?.readinessOverride && (
                        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                          <p className="font-semibold">Manual override is active</p>
                          {story.readinessOverrideReason && (
                            <p className="mt-1">{story.readinessOverrideReason}</p>
                          )}
                          <p className="mt-1 text-amber-800">
                            Applied{' '}
                            {story.readinessOverrideAt
                              ? new Date(story.readinessOverrideAt).toLocaleString()
                              : 'previously'}
                            {story.readinessOverrideBy && ` by ${story.readinessOverrideBy}`}.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refetchReadiness()}
                          disabled={readinessFetching}
                        >
                          {readinessFetching && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Re-run Check
                        </Button>

                        {readinessEvaluation.isReady &&
                          story &&
                          story.status !== 'ready' &&
                          ![
                            'committed',
                            'inprogress',
                            'taskscomplete',
                            'deployed',
                            'awaitingacceptance',
                            'accepted',
                          ].includes(story.status) &&
                          canAcceptStories && (
                            <Button
                              size="sm"
                              onClick={() => applyReadyMutation.mutate()}
                              disabled={applyReadyMutation.isPending}
                            >
                              {applyReadyMutation.isPending && (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              )}
                              Mark Story Ready
                            </Button>
                          )}

                        {!readinessEvaluation.isReady &&
                          canAcceptStories &&
                          !story?.readinessOverride && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setOverrideDialogOpen(true)}
                            >
                              Override & Mark Ready
                            </Button>
                          )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Make a change to the story or run a manual check to see readiness feedback.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Story Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Story Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline">{statusConfig[story.status]?.label}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Priority</span>
                    <Badge
                      variant="outline"
                      className={priorityConfig[story.priority || 'medium'].color}
                    >
                      {priorityConfig[story.priority || 'medium'].label}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Story Points</span>
                    <span>{story.storyPoints ?? 'Not estimated'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Readiness Override</span>
                    <Badge variant={story.readinessOverride ? 'destructive' : 'outline'}>
                      {story.readinessOverride ? 'Enabled' : 'None'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tasks</span>
                    <span>{tasks.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Acceptance Criteria</span>
                    <span>{acceptanceCriteria.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-sm">
                      {new Date(story.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={isEditStoryOpen} onOpenChange={setIsEditStoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Story</DialogTitle>
            <DialogDescription>
              Update the story details. Leave a field blank to keep its current value.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleStorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="story-title">Title</Label>
              <Input
                id="story-title"
                value={editStoryTitle}
                onChange={(event) => setEditStoryTitle(event.target.value)}
                placeholder="Story title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story-description">Description</Label>
              <Textarea
                id="story-description"
                value={editStoryDescription}
                onChange={(event) => setEditStoryDescription(event.target.value)}
                placeholder="Story description"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="story-points">Story Points</Label>
              <Input
                id="story-points"
                type="number"
                min={1}
                max={8}
                value={editStoryPoints}
                onChange={(event) => setEditStoryPoints(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditStoryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateStoryMutation.isPending}>
                {updateStoryMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          setOverrideDialogOpen(open)
          if (!open) {
            setOverrideReason('')
            setOverrideConfirmation('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Readiness Recommendation</DialogTitle>
            <DialogDescription>
              Provide a justification and confirm the override. Overrides are logged and should be
              used sparingly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="override-reason">Override justification</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Explain why this story should advance despite the AI feedback."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-confirm">Type OVERRIDE to confirm</Label>
              <Input
                id="override-confirm"
                value={overrideConfirmation}
                onChange={(event) => setOverrideConfirmation(event.target.value)}
                placeholder="Type OVERRIDE to continue"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The system will continue to highlight missing readiness items even after an override.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOverrideDialogOpen(false)
                setOverrideReason('')
                setOverrideConfirmation('')
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => overrideReadyMutation.mutate(overrideReason)}
              disabled={
                overrideReadyMutation.isPending ||
                overrideReason.trim().length < 10 ||
                overrideConfirmation.trim().toLowerCase() !== 'override'
              }
            >
              {overrideReadyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddCriterionOpen} onOpenChange={setIsAddCriterionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Acceptance Criterion</DialogTitle>
            <DialogDescription>
              Provide the Given / When / Then details for this criterion.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCriterion} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="criterion-given">Given</Label>
              <Input
                id="criterion-given"
                value={criterionGiven}
                onChange={(event) => setCriterionGiven(event.target.value)}
                placeholder="Given ..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion-when">When</Label>
              <Input
                id="criterion-when"
                value={criterionWhen}
                onChange={(event) => setCriterionWhen(event.target.value)}
                placeholder="When ..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="criterion-then">Then</Label>
              <Input
                id="criterion-then"
                value={criterionThen}
                onChange={(event) => setCriterionThen(event.target.value)}
                placeholder="Then ..."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddCriterionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCriterionMutation.isPending}>
                {createCriterionMutation.isPending ? 'Adding...' : 'Add Criterion'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Capture a new task for this story. Acceptance criteria references are optional and can
              be a comma-separated list.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Task title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                placeholder="Optional task description"
                rows={4}
              />
            </div>
            {acceptanceCriteria.length > 0 ? (
              <div className="space-y-2">
                <Label>Acceptance Criteria References</Label>
                <div className="space-y-2">
                  {acceptanceCriteria.map((criterion, index) => (
                    <label key={criterion.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={taskAcceptanceRefs.includes(criterion.id)}
                        onChange={() => toggleTaskRef(criterion.id)}
                      />
                      <span>
                        Criterion {index + 1}: {criterion.given} → {criterion.thenClause}
                      </span>
                    </label>
                  ))}
                </div>
                {taskAcceptanceRefs.length === 0 && (
                  <p className="text-xs text-orange-600">
                    No criteria selected — all criteria will be linked automatically.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="task-refs">Acceptance Criteria References</Label>
                <Input
                  id="task-refs"
                  value={taskManualRefs}
                  onChange={(event) => setTaskManualRefs(event.target.value)}
                  placeholder="e.g. AC-1, AC-2"
                />
                <p className="text-xs text-muted-foreground">
                  Provide at least one reference so the task can be validated.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
