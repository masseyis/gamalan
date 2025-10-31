'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Calendar,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  User,
  AlertCircle,
  Loader2,
  ListChecks,
  Grid3x3,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { sprintApi } from '@/lib/api/sprint'
import { teamsApi } from '@/lib/api/teams'
import { useToast } from '@/hooks/use-toast'
import { Story, Task, TaskStatus } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useRoles } from '@/components/providers/UserContextProvider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type TaskWithStory = Task & {
  story: Story
  isMyTask: boolean
  isAvailable: boolean
}

type GroupBy = 'story' | 'status'

const taskStatusLabels: Record<TaskStatus, string> = {
  available: 'Available',
  owned: 'Owned',
  inprogress: 'In Progress',
  completed: 'Completed',
}

const taskStatusBadgeClasses: Record<TaskStatus, string> = {
  available: 'bg-slate-100 text-slate-700 border-slate-200',
  owned: 'bg-amber-100 text-amber-700 border-amber-200',
  inprogress: 'bg-sky-100 text-sky-700 border-sky-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

interface TaskCardProps {
  task: TaskWithStory
  onTakeOwnership?: (taskId: string) => void
  isUpdating?: boolean
}

function TaskCard({ task, onTakeOwnership, isUpdating = false }: TaskCardProps) {
  const acRefs = task.acceptanceCriteriaRefs?.join(', ') || 'None'

  return (
    <Card
      className={`group transition-shadow hover:shadow-md ${
        task.isMyTask ? 'border-primary/50 bg-primary/5' : ''
      } ${task.isAvailable && !task.isMyTask ? 'border-dashed' : ''}`}
      data-testid="task-card"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className={taskStatusBadgeClasses[task.status]}>
                {taskStatusLabels[task.status]}
              </Badge>
              {task.isMyTask && (
                <Badge variant="default" className="bg-primary">
                  <User className="mr-1 h-3 w-3" />
                  My Task
                </Badge>
              )}
              {task.isAvailable && !task.isMyTask && (
                <Badge variant="outline" className="border-green-500 text-green-700">
                  Available to claim
                </Badge>
              )}
            </div>
            <CardTitle className="line-clamp-2 text-base font-semibold">{task.title}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">#{task.id.slice(-6)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="rounded-md border border-muted-foreground/10 bg-muted/30 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Story
          </p>
          <p className="mt-1 text-sm text-foreground">{task.story.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-muted-foreground/10 bg-muted/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              AC Refs
            </p>
            <p className="mt-1 text-foreground">{acRefs}</p>
          </div>
          {task.estimatedHours && (
            <div className="rounded-md border border-muted-foreground/10 bg-muted/20 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Estimate
              </p>
              <p className="mt-1 text-foreground">{task.estimatedHours}h</p>
            </div>
          )}
        </div>

        {task.ownerUserId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>Owner: {task.ownerUserId.slice(0, 8)}...</span>
          </div>
        )}

        {task.isAvailable && !task.isMyTask && onTakeOwnership && (
          <Button
            size="sm"
            onClick={() => onTakeOwnership(task.id)}
            disabled={isUpdating}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Taking ownership...
              </>
            ) : (
              <>
                <User className="mr-2 h-3.5 w-3.5" />
                I'm on it
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function formatSprintDateRange(sprint: Sprint): string {
  const start = new Date(sprint.startDate)
  const end = new Date(sprint.endDate)
  return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`
}

function calculateDaysRemaining(endDate: string): number {
  const end = new Date(endDate)
  const diff = end.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function SprintTasksPage() {
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string
  const sprintId = params.sprint_id as string
  const { user: contextUser } = useRoles()

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('story')

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', project?.teamId],
    queryFn: () => teamsApi.getTeam(project!.teamId!),
    enabled: !!project?.teamId,
  })

  // Fetch sprint details
  const { data: sprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprints', projectId, sprintId],
    queryFn: () => sprintApi.getSprint(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  })

  // Fetch sprint stories with tasks
  const {
    data: sprintStories = [],
    isLoading: sprintStoriesLoading,
    error: sprintStoriesError,
  } = useQuery({
    queryKey: ['sprint-stories', projectId, sprintId],
    queryFn: () => backlogApi.getStories(projectId, sprintId, undefined, { includeTasks: true }),
    enabled: !!projectId && !!sprintId,
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
  })

  const takeOwnershipMutation = useMutation({
    mutationFn: (taskId: string) => backlogApi.takeTaskOwnership(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-stories', projectId, sprintId] })
      toast({
        title: 'Task claimed',
        description: 'You are now the owner of this task.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to claim task',
        description: 'Unable to take task ownership. Please try again.',
        variant: 'destructive',
      })
      console.error('Take ownership error:', error)
    },
  })

  // Real-time update detection
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sprint-task-update') {
        queryClient.invalidateQueries({ queryKey: ['sprint-stories', projectId, sprintId] })
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [projectId, sprintId, queryClient])

  // Transform stories into tasks with story context
  const allTasks = useMemo<TaskWithStory[]>(() => {
    return sprintStories.flatMap((story) =>
      (story.tasks || []).map((task) => ({
        ...task,
        story,
        isMyTask: task.ownerUserId === contextUser?.id,
        isAvailable: task.status === 'available' && !task.ownerUserId,
      }))
    )
  }, [sprintStories, contextUser?.id])

  // Apply filters
  const filteredTasks = useMemo(() => {
    let tasks = allTasks

    if (statusFilter !== 'all') {
      tasks = tasks.filter((task) => task.status === statusFilter)
    }

    return tasks
  }, [allTasks, statusFilter])

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'story') {
      const groups = new Map<string, TaskWithStory[]>()
      filteredTasks.forEach((task) => {
        const key = task.story.id
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(task)
      })
      return Array.from(groups.entries()).map(([storyId, tasks]) => ({
        id: storyId,
        title: tasks[0].story.title,
        tasks,
      }))
    } else {
      const groups = new Map<TaskStatus, TaskWithStory[]>()
      filteredTasks.forEach((task) => {
        const key = task.status
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(task)
      })
      return Array.from(groups.entries()).map(([status, tasks]) => ({
        id: status,
        title: taskStatusLabels[status],
        tasks,
      }))
    }
  }, [filteredTasks, groupBy])

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = allTasks.length
    const completed = allTasks.filter((t) => t.status === 'completed').length
    const myTasks = allTasks.filter((t) => t.isMyTask).length
    const available = allTasks.filter((t) => t.isAvailable).length
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, myTasks, available, completionPercent }
  }, [allTasks])

  const isLoading = projectLoading || sprintLoading || sprintStoriesLoading
  const error = projectError || sprintStoriesError
  const missingTeam = !project?.teamId

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Sprint Tasks</h1>
          <p className="mt-2 text-muted-foreground">Loading sprint task board...</p>
        </div>
      </div>
    )
  }

  if (error || !project || !sprint) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}/board`}
            className="mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sprint Board
          </Link>
          <h1 className="text-3xl font-bold">Sprint Tasks</h1>
          <p className="mt-2 text-muted-foreground">
            Sprint not found or failed to load. Please return to the board.
          </p>
        </div>
      </div>
    )
  }

  const daysRemaining = calculateDaysRemaining(sprint.endDate)

  return (
    <div className="bg-gradient-soft min-h-screen">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href={`/projects/${projectId}/board`}
              className="group mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Sprint Board
            </Link>
            <h1 className="text-4xl font-bold text-gradient-primary">{sprint.name} — Tasks</h1>
            <p className="mt-2 text-lg text-muted-foreground">{sprint.goal || 'Sprint tasks view'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Badge
                variant={team ? 'secondary' : 'outline'}
                className={team ? 'bg-primary/10 text-primary border-0' : 'border-dashed border-amber-400 text-amber-700'}
              >
                <Users className="mr-1 h-3 w-3" />
                {teamLoading ? 'Loading...' : team ? team.name : 'No team'}
              </Badge>
              <Badge variant="outline" className="bg-muted">
                <Calendar className="mr-1 h-3 w-3" />
                {formatSprintDateRange(sprint)}
              </Badge>
              <Badge variant="outline" className="bg-muted">
                <Clock className="mr-1 h-3 w-3" />
                {daysRemaining} days remaining
              </Badge>
            </div>
          </div>
        </div>

        {missingTeam && (
          <Alert className="mb-8 border-amber-200 bg-amber-50">
            <AlertTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              No team assigned
            </AlertTitle>
            <AlertDescription className="mt-2 text-amber-900/90">
              This project needs a team assignment for proper task tracking.
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{sprintStories.length}</CardTitle>
              <CardDescription>Stories in sprint</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{metrics.total}</CardTitle>
              <CardDescription>Total tasks</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{metrics.completed}</CardTitle>
              <CardDescription>Tasks completed</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{metrics.myTasks}</CardTitle>
              <CardDescription>My tasks</CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{metrics.completionPercent}%</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <CardDescription>Tasks progress</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="status-filter" className="mb-2 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter by status
                </Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | 'all')}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tasks</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="owned">Owned</SelectItem>
                    <SelectItem value="inprogress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="group-by" className="mb-2 flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4" />
                  Group by
                </Label>
                <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                  <SelectTrigger id="group-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">By Story</SelectItem>
                    <SelectItem value="status">By Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {filteredTasks.length} of {allTasks.length} tasks
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Groups */}
        {groupedTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                <ListChecks className="mb-4 h-12 w-12 opacity-60" />
                <p className="text-lg font-medium">No tasks found</p>
                <p className="text-sm">
                  {statusFilter !== 'all'
                    ? 'Try adjusting your filters to see more tasks.'
                    : 'Tasks will appear here once stories have tasks created.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedTasks.map((group) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                    <Badge variant="secondary">{group.tasks.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.tasks.map((task) => {
                      const isUpdating =
                        takeOwnershipMutation.isPending &&
                        takeOwnershipMutation.variables === task.id

                      return (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onTakeOwnership={(taskId) => takeOwnershipMutation.mutate(taskId)}
                          isUpdating={isUpdating}
                        />
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
