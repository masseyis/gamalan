'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  Plus,
  Users,
  Circle,
  ClipboardList,
  CheckCircle2,
  Flag,
  Clock,
  ListChecks,
  Rocket,
  ShieldCheck,
  ChevronRight,
  RotateCcw,
  Calendar,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { sprintApi } from '@/lib/api/sprint'
import { teamsApi } from '@/lib/api/teams'
import { useToast } from '@/hooks/use-toast'
import { Story, StoryStatus, StoryPriority, Task } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { aiApi } from '@/lib/api/ai'
import type { ReadinessEvaluation } from '@/lib/types/ai'
import { useRoles } from '@/components/providers/UserContextProvider'

type WorkflowStage = {
  label: string
  description: string
  stage: number
  icon: LucideIcon
  badgeClass: string
}

const workflowOrder: StoryStatus[] = [
  'draft',
  'needsrefinement',
  'ready',
  'committed',
  'inprogress',
  'taskscomplete',
  'deployed',
  'awaitingacceptance',
  'accepted',
]

const workflowMeta: Record<StoryStatus, WorkflowStage> = {
  draft: {
    label: 'Draft',
    description: 'Story captured; needs shaping before it can be pulled.',
    stage: 1,
    icon: Circle,
    badgeClass: 'bg-slate-100 text-slate-600',
  },
  needsrefinement: {
    label: 'Needs Refinement',
    description: 'Clarify scope, personas, and acceptance criteria.',
    stage: 2,
    icon: ClipboardList,
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  ready: {
    label: 'Ready',
    description: 'Ready checklist satisfied; safe to commit.',
    stage: 3,
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  committed: {
    label: 'Committed',
    description: 'Pulled into the sprint and owned by the team.',
    stage: 4,
    icon: Flag,
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  inprogress: {
    label: 'In Progress',
    description: 'Active development underway.',
    stage: 5,
    icon: Clock,
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  taskscomplete: {
    label: 'Tasks Complete',
    description: 'Implementation complete; prepping for deploy.',
    stage: 6,
    icon: ListChecks,
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  deployed: {
    label: 'Deployed',
    description: 'Changes deployed to target environment.',
    stage: 7,
    icon: Rocket,
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
  awaitingacceptance: {
    label: 'Awaiting Acceptance',
    description: 'Pending product acceptance or UAT confirmation.',
    stage: 8,
    icon: Clock,
    badgeClass: 'bg-pink-100 text-pink-700',
  },
  accepted: {
    label: 'Accepted',
    description: 'Validated outcome; ready for demo.',
    stage: 9,
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-200 text-emerald-800',
  },
}

type ColumnDefinition = {
  id: string
  title: string
  subtitle: string
  statuses: StoryStatus[]
}

const executionColumns: ColumnDefinition[] = [
  {
    id: 'committed',
    title: 'Committed',
    subtitle: 'Stories locked into the sprint.',
    statuses: ['committed'],
  },
  {
    id: 'execution',
    title: 'Execution',
    subtitle: 'Hands-on delivery work.',
    statuses: ['inprogress', 'taskscomplete'],
  },
  {
    id: 'validation',
    title: 'Validation',
    subtitle: 'Deployments and acceptance checks.',
    statuses: ['deployed', 'awaitingacceptance'],
  },
  {
    id: 'done',
    title: 'Done',
    subtitle: 'Accepted, demo-ready outcomes.',
    statuses: ['accepted'],
  },
]

const priorityClasses: Record<StoryPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const taskStatusOrder: Record<Task['status'], number> = {
  inprogress: 0,
  owned: 1,
  available: 2,
  completed: 3,
}

const taskStatusBadgeClasses: Record<Task['status'], string> = {
  available: 'bg-slate-100 text-slate-700 border-slate-200',
  owned: 'bg-amber-100 text-amber-700 border-amber-200',
  inprogress: 'bg-sky-100 text-sky-700 border-sky-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const taskStatusLabels: Record<Task['status'], string> = {
  available: 'Available',
  owned: 'Owned',
  inprogress: 'In Progress',
  completed: 'Completed',
}

type ToastFn = ReturnType<typeof useToast>['toast']

function getStageRangeLabel(statuses: StoryStatus[]): string {
  const stages = statuses
    .map((status) => workflowMeta[status]?.stage)
    .filter((value): value is number => typeof value === 'number')

  if (stages.length === 0) {
    return ''
  }

  const minStage = Math.min(...stages)
  const maxStage = Math.max(...stages)

  return minStage === maxStage ? `Stage ${minStage}` : `Stages ${minStage}–${maxStage}`
}

function getNextStatus(current: StoryStatus): StoryStatus | null {
  const index = workflowOrder.indexOf(current)
  return index >= 0 && index < workflowOrder.length - 1 ? workflowOrder[index + 1] : null
}

function getPreviousStatus(current: StoryStatus): StoryStatus | null {
  const index = workflowOrder.indexOf(current)
  return index > 0 ? workflowOrder[index - 1] : null
}

interface StoryCardProps {
  story: Story
  onAdvance?: (targetStatus: StoryStatus) => void
  onRevert?: (targetStatus: StoryStatus) => void
  isUpdating?: boolean
  hideWorkflowActions?: boolean
}

function StoryCard({
  story,
  onAdvance,
  onRevert,
  isUpdating = false,
  hideWorkflowActions = false,
}: StoryCardProps) {
  const meta = workflowMeta[story.status] ?? workflowMeta.ready
  const StatusIcon = meta.icon
  const nextStatus = getNextStatus(story.status)
  const previousStatus = getPreviousStatus(story.status)

  const totalTasks = story.tasks?.length ?? 0
  const completedTasks = story.tasks?.filter((task) => task.status === 'completed').length ?? 0
  const taskSummary =
    totalTasks > 0 ? `${completedTasks}/${totalTasks} tasks` : 'Tasks not yet created'

  const previewTasks = (story.tasks ?? [])
    .slice()
    .sort((a, b) => taskStatusOrder[a.status] - taskStatusOrder[b.status])
    .slice(0, 3)

  const priorityClass =
    (story.priority && priorityClasses[story.priority]) ?? priorityClasses.medium

  const showAdvance = !hideWorkflowActions && !!onAdvance && !!nextStatus
  const showRevert = !hideWorkflowActions && !!onRevert && !!previousStatus

  return (
    <Card className="group transition-shadow hover:shadow-lg" data-testid="board-story-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className={`${meta.badgeClass} border-0`}>
                <StatusIcon className="mr-1 h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">{meta.label}</span>
                <span className="ml-1 text-[10px] opacity-80">(Stage {meta.stage})</span>
              </Badge>
              <Badge variant="outline" className={priorityClass}>
                {story.priority ?? 'medium'}
              </Badge>
              {story.storyPoints ? (
                <Badge variant="outline" className="bg-muted text-xs">
                  {story.storyPoints} pts
                </Badge>
              ) : null}
            </div>
            <CardTitle className="line-clamp-2 text-base font-semibold">{story.title}</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">#{story.id.slice(-6)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {story.description ?? 'No description captured yet.'}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{taskSummary}</span>
          <span>Updated {new Date(story.updatedAt).toLocaleDateString()}</span>
        </div>

        {previewTasks.length > 0 ? (
          <div className="rounded-md border border-muted-foreground/10 bg-muted/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Next tasks
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {previewTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{task.title}</span>
                  <Badge
                    variant="outline"
                    className={`${taskStatusBadgeClasses[task.status]} text-[10px] uppercase`}
                  >
                    {taskStatusLabels[task.status]}
                  </Badge>
                </li>
              ))}
              {totalTasks > previewTasks.length ? (
                <li className="text-muted-foreground/80">
                  +{totalTasks - previewTasks.length} more task
                  {totalTasks - previewTasks.length > 1 ? 's' : ''}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {!hideWorkflowActions && (showAdvance || showRevert) ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {showRevert ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isUpdating}
                onClick={() => previousStatus && onRevert(previousStatus)}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {previousStatus ? workflowMeta[previousStatus].label : 'Previous'}
              </Button>
            ) : null}
            {showAdvance ? (
              <Button
                size="sm"
                disabled={isUpdating}
                onClick={() => nextStatus && onAdvance(nextStatus)}
              >
                Move to {nextStatus ? workflowMeta[nextStatus].label : 'next stage'}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface SprintSpotlightProps {
  projectId: string
  sprint: Sprint
  team?: {
    name: string
    velocityHistory?: number[]
  }
  stories: Story[]
  readinessByStoryId: Record<string, ReadinessEvaluation | undefined>
  toast: ToastFn
}

function SprintSpotlight({
  projectId,
  sprint,
  team,
  stories,
  readinessByStoryId,
  toast,
}: SprintSpotlightProps) {
  const totalStoryPoints = useMemo(
    () => stories.reduce((acc, story) => acc + (story.storyPoints ?? 0), 0),
    [stories]
  )

  const capacityTarget = useMemo(() => {
    if (team?.velocityHistory && team.velocityHistory.length > 0) {
      const sum = team.velocityHistory.reduce((acc, velocity) => acc + velocity, 0)
      return Math.max(1, Math.round(sum / team.velocityHistory.length))
    }
    return 40
  }, [team])

  const capacityUsage = capacityTarget > 0 ? totalStoryPoints / capacityTarget : 0
  const capacityPercent = Math.min(100, Math.round(capacityUsage * 100))
  const capacityStatus =
    capacityUsage >= 1 ? 'Over capacity' : capacityUsage >= 0.8 ? 'Near capacity' : 'Healthy'

  const capacityStyles =
    capacityUsage >= 1
      ? 'bg-red-50 border-red-200 text-red-700'
      : capacityUsage >= 0.8
        ? 'bg-amber-50 border-amber-200 text-amber-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700'

  const warningRef = useRef(false)
  useEffect(() => {
    if (!warningRef.current && capacityUsage >= 0.8) {
      toast({
        title: capacityUsage >= 1 ? 'Sprint over capacity' : 'Sprint nearing capacity',
        description: `Committed ${totalStoryPoints} pts (~${capacityPercent}% of assumed capacity ${capacityTarget} pts).`,
        variant: capacityUsage >= 1 ? 'destructive' : 'default',
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('battra:capacity-warning', {
            detail: {
              sprintId: sprint.id,
              capacityPercent,
              totalStoryPoints,
              capacityTarget,
              timestamp: Date.now(),
            },
          })
        )
      }
      warningRef.current = true
    }
    if (capacityUsage < 0.8) {
      warningRef.current = false
    }
  }, [capacityUsage, capacityPercent, capacityTarget, sprint.id, toast, totalStoryPoints])

  const upcomingTasks = useMemo(() => {
    return stories
      .flatMap((story) =>
        (story.tasks ?? []).map((task) => ({
          story,
          task,
        }))
      )
      .sort((a, b) => taskStatusOrder[a.task.status] - taskStatusOrder[b.task.status])
  }, [stories])

  const blockers = useMemo(() => {
    const items: Array<{ storyId: string; storyTitle: string; text: string }> = []
    stories.forEach((story) => {
      const readiness = readinessByStoryId[story.id]
      readiness?.missingItems.forEach((item) => {
        items.push({ storyId: story.id, storyTitle: story.title, text: item })
      })
    })
    return items
  }, [readinessByStoryId, stories])

  const recommendations = useMemo(() => {
    const items: Array<{ storyId: string; storyTitle: string; text: string }> = []
    stories.forEach((story) => {
      const readiness = readinessByStoryId[story.id]
      readiness?.recommendations.forEach((rec) => {
        items.push({ storyId: story.id, storyTitle: story.title, text: rec })
      })
    })
    return items
  }, [readinessByStoryId, stories])

  const daysRemaining = useMemo(() => {
    const end = new Date(sprint.endDate)
    const diff = end.getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [sprint.endDate])

  const topTasks = upcomingTasks.slice(0, 5)

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Sprint spotlight
          </div>
          <CardTitle className="text-2xl">{sprint.name}</CardTitle>
          <CardDescription>{sprint.goal || 'No sprint goal captured yet.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-muted-foreground/10 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Team
              </p>
              <p className="mt-1 text-base font-medium text-foreground">
                {team?.name ?? 'Unassigned'}
              </p>
            </div>
            <div className="rounded-md border border-muted-foreground/10 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Stories
              </p>
              <p className="mt-1 text-base font-medium text-foreground">{stories.length}</p>
            </div>
            <div className="rounded-md border border-muted-foreground/10 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Days remaining
              </p>
              <p className="mt-1 text-base font-medium text-foreground">{daysRemaining}</p>
            </div>
          </div>

          <div className="rounded-md border border-muted-foreground/10 bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">Next actions</h3>
            {topTasks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No tasks have been created for the active sprint yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {topTasks.map(({ story, task }) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-muted-foreground/10 bg-muted/20 p-3"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {story.title}
                      </p>
                      <p className="text-sm text-foreground">{task.title}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={`${taskStatusBadgeClasses[task.status]} text-[10px] uppercase`}
                      >
                        {taskStatusLabels[task.status]}
                      </Badge>
                      <Link
                        href={`/projects/${projectId}/backlog/${story.id}`}
                        className="text-xs text-primary transition-colors hover:text-primary/80"
                      >
                        View story
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className={capacityStyles}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Capacity usage</CardTitle>
            <CardDescription className="text-sm">
              {totalStoryPoints} pts committed · Target capacity {capacityTarget} pts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm font-medium">
              <span>{capacityStatus}</span>
              <span>{capacityPercent}% utilised</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className={`h-full rounded-full ${
                  capacityUsage >= 1
                    ? 'bg-red-500'
                    : capacityUsage >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, capacityPercent)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Risks & recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {blockers.length === 0 && recommendations.length === 0 ? (
              <p className="text-muted-foreground">
                No risks flagged. Keep an eye on readiness feedback.
              </p>
            ) : null}
            {blockers.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Blockers
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  {blockers.map((item) => (
                    <li key={`${item.storyId}-${item.text}`} className="leading-snug">
                      <span className="font-medium">{item.storyTitle}:</span> {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {recommendations.length > 0 ? (
              <div>
                <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Recommendations
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  {recommendations.map((item) => (
                    <li key={`${item.storyId}-${item.text}`} className="leading-snug">
                      <span className="font-medium">{item.storyTitle}:</span> {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface AddExtraStoryDialogProps {
  projectId: string
  readyStories: Story[]
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoading: boolean
}

function AddExtraStoryDialog({
  projectId,
  readyStories,
  open,
  onOpenChange,
  isLoading,
}: AddExtraStoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add extra story
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Commit an extra story</DialogTitle>
          <DialogDescription>
            Extra sprint scope should be intentional. Review ready backlog items below, then open
            the backlog to confirm scope with the team before committing.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading ready stories…</p>
          ) : readyStories.length === 0 ? (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
              No ready stories available. Refine backlog items before adjusting sprint scope.
            </div>
          ) : (
            readyStories.map((story) => (
              <Card key={story.id} className="border-muted shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{story.title}</CardTitle>
                      <CardDescription>
                        {story.storyPoints ? `${story.storyPoints} pts · ` : ''}
                        Updated {new Date(story.updatedAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                      Ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 pt-0 text-sm text-muted-foreground">
                  <span className="line-clamp-2">
                    {story.description ?? 'No description captured yet.'}
                  </span>
                  <Link href={`/projects/${projectId}/backlog/${story.id}`}>
                    <Button variant="secondary" size="sm">
                      Review story
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Link href={`/projects/${projectId}/backlog`}>
            <Button size="sm">Open backlog</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ExecutionMetrics = {
  total: number
  committed: number
  inProgress: number
  inValidation: number
  accepted: number
}

function buildExecutionMetrics(stories: Story[]): ExecutionMetrics {
  const inProgressStatuses: StoryStatus[] = ['inprogress', 'taskscomplete']
  const validationStatuses: StoryStatus[] = ['deployed', 'awaitingacceptance']

  return {
    total: stories.length,
    committed: stories.filter((story) => story.status === 'committed').length,
    inProgress: stories.filter((story) => inProgressStatuses.includes(story.status)).length,
    inValidation: stories.filter((story) => validationStatuses.includes(story.status)).length,
    accepted: stories.filter((story) => story.status === 'accepted').length,
  }
}

function formatSprintDateRange(sprint: Sprint): string {
  const start = new Date(sprint.startDate)
  const end = new Date(sprint.endDate)
  return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`
}

export default function ProjectBoardPage() {
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string
  const [extraStoryDialogOpen, setExtraStoryDialogOpen] = useState(false)
  const { user: contextUser } = useRoles()
  const isContributorRole =
    contextUser?.role === 'contributor' || contextUser?.role === 'managing_contributor'

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

  const { data: activeSprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprints', projectId, 'active'],
    queryFn: () => sprintApi.getActiveSprint(projectId),
    enabled: !!projectId,
  })

  const {
    data: sprintStories = [],
    isLoading: sprintStoriesLoading,
    error: sprintStoriesError,
  } = useQuery({
    queryKey: ['sprint-stories', projectId, activeSprint?.id],
    queryFn: () =>
      backlogApi.getStories(projectId, activeSprint!.id, undefined, { includeTasks: true }),
    enabled: !!projectId && !!activeSprint?.id,
  })

  const readinessQueries = useQueries({
    queries: sprintStories.map((story) => ({
      queryKey: ['story-readiness', projectId, story.id],
      queryFn: () => aiApi.checkStoryReadiness(projectId, story.id),
      enabled: !!projectId && !!story.id,
      staleTime: 60 * 1000,
    })),
  })

  const readinessByStoryId = useMemo(() => {
    const map: Record<string, ReadinessEvaluation | undefined> = {}
    sprintStories.forEach((story, index) => {
      const result = readinessQueries[index]
      if (result?.data) {
        map[story.id] = result.data
      }
    })
    return map
  }, [readinessQueries, sprintStories])

  const {
    data: planningStories = [],
    isLoading: planningStoriesLoading,
    error: planningStoriesError,
  } = useQuery({
    queryKey: ['planning-stories', projectId],
    queryFn: () => backlogApi.getStories(projectId),
    enabled: !!projectId && (!activeSprint || extraStoryDialogOpen),
  })

  const updateStoryStatusMutation = useMutation({
    mutationFn: ({ storyId, status }: { storyId: string; status: StoryStatus }) =>
      backlogApi.updateStoryStatus(projectId, storyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-stories', projectId] })
      queryClient.invalidateQueries({ queryKey: ['planning-stories', projectId] })
      toast({
        title: 'Story updated',
        description: 'Story status has been updated successfully.',
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to update story',
        description: 'Unable to update story status. Please try again.',
        variant: 'destructive',
      })
      console.error('Update story status error:', error)
    },
  })

  const isLoading =
    projectLoading ||
    sprintLoading ||
    (activeSprint ? sprintStoriesLoading : planningStoriesLoading)
  const error = projectError || (activeSprint ? sprintStoriesError : planningStoriesError)
  const missingTeam = !project?.teamId

  const readyStories = useMemo(
    () => planningStories.filter((story) => story.status === 'ready'),
    [planningStories]
  )

  const needsRefinementStories = useMemo(
    () => planningStories.filter((story) => ['draft', 'needsrefinement'].includes(story.status)),
    [planningStories]
  )

  const executionMetrics = useMemo(() => buildExecutionMetrics(sprintStories), [sprintStories])

  const executionColumnsWithStories = useMemo(() => {
    return executionColumns.map((column) => {
      const columnStories = sprintStories
        .filter((story) => column.statuses.includes(story.status))
        .sort((a, b) => {
          const stageA = workflowOrder.indexOf(a.status)
          const stageB = workflowOrder.indexOf(b.status)
          if (stageA === stageB) {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          }
          return stageA - stageB
        })

      return {
        ...column,
        stories: columnStories,
      }
    })
  }, [sprintStories])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sprint Board</h1>
            <p className="mt-2 text-muted-foreground">Loading board data…</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {executionColumns.map((column) => (
              <Card key={column.id} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="h-24 rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href="/projects"
              className="mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
            <h1 className="text-3xl font-bold">Sprint Board</h1>
            <p className="mt-2 text-muted-foreground">Project not found or failed to load.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!activeSprint) {
    const totalReadyPoints = readyStories.reduce(
      (total, story) => total + (story.storyPoints ?? 0),
      0
    )

    return (
      <div className="bg-gradient-soft">
        <div className="container mx-auto py-8">
          <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href="/projects"
                className="group mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Projects
              </Link>
              <h1 className="text-4xl font-bold text-gradient-primary">
                {project.name} — Sprint Planning
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Line up ready backlog stories, then start a sprint with confidence.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge
                  variant={team ? 'secondary' : 'outline'}
                  className={
                    team
                      ? 'bg-primary/10 text-primary border-0'
                      : 'border-dashed border-amber-400 text-amber-700'
                  }
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {teamLoading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading team...
                      </span>
                    ) : team ? (
                      <>
                        <span className="font-medium">Team</span>
                        <span>{team.name}</span>
                      </>
                    ) : (
                      'No team assigned'
                    )}
                  </span>
                </Badge>
                {team && (
                  <Link
                    href={`/teams/${team.id}`}
                    className="text-primary transition-colors hover:text-primary/80"
                  >
                    View team workspace
                  </Link>
                )}
                {missingTeam && (
                  <Link
                    href={`/projects/${projectId}/settings`}
                    className="text-primary transition-colors hover:text-primary/80"
                  >
                    Assign team
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingTeam ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button disabled>
                        <Plus className="mr-2 h-4 w-4" />
                        Plan sprint
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Assign a team in project settings before planning a sprint.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Link href={`/projects/${projectId}/sprints/new`}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Plan sprint
                  </Button>
                </Link>
              )}
              <Link href={`/projects/${projectId}/backlog`}>
                <Button variant="outline">Open backlog</Button>
              </Link>
            </div>
          </div>

          {missingTeam && (
            <Alert className="mb-8 border-amber-200 bg-amber-50">
              <AlertTitle className="flex items-center gap-2 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                Assign a team before starting a sprint
              </AlertTitle>
              <AlertDescription className="mt-2 text-amber-900/90">
                Sprint commitments are tracked per team. Assign this project to a delivery team to
                unlock sprint planning.
              </AlertDescription>
            </Alert>
          )}

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl">{readyStories.length}</CardTitle>
                <CardDescription>Stories ready to commit</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl">{totalReadyPoints}</CardTitle>
                <CardDescription>Ready story points</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-2xl">{needsRefinementStories.length}</CardTitle>
                <CardDescription>Needs refinement</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="mb-8">
            <AIAssistant projectId={projectId} context="backlog" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ready for sprint</CardTitle>
                <CardDescription>
                  Stories that meet readiness criteria and can be selected for the next sprint.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {readyStories.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-center text-muted-foreground">
                    <Users className="mb-2 h-8 w-8 opacity-60" />
                    <p className="text-sm font-medium">No ready stories yet</p>
                    <p className="text-xs text-muted-foreground/80">
                      Flesh out acceptance criteria and effort to mark stories ready.
                    </p>
                  </div>
                ) : (
                  readyStories.map((story) => (
                    <StoryCard key={story.id} story={story} hideWorkflowActions />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Needs refinement</CardTitle>
                <CardDescription>
                  Draft and refinement stories that still need clarity before sprint commit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {needsRefinementStories.length === 0 ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-center text-muted-foreground">
                    <ClipboardList className="mb-2 h-8 w-8 opacity-60" />
                    <p className="text-sm font-medium">Nothing waiting on refinement</p>
                    <p className="text-xs text-muted-foreground/80">
                      Great! Collaborate with your team to keep backlog quality high.
                    </p>
                  </div>
                ) : (
                  needsRefinementStories.map((story) => (
                    <StoryCard key={story.id} story={story} hideWorkflowActions />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/projects"
              className="group mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Projects
            </Link>
            <h1 className="text-4xl font-bold text-gradient-primary">
              {project.name} — Sprint Execution
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Track in-flight work for {activeSprint.name}. Keep scope steady; escalate changes when
              needed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge
                variant={team ? 'secondary' : 'outline'}
                className={
                  team
                    ? 'bg-primary/10 text-primary border-0'
                    : 'border-dashed border-amber-400 text-amber-700'
                }
              >
                <span className="flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  {teamLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading team...
                    </span>
                  ) : team ? (
                    <>
                      <span className="font-medium">Team</span>
                      <span>{team.name}</span>
                    </>
                  ) : (
                    'No team assigned'
                  )}
                </span>
              </Badge>
              {team && (
                <Link
                  href={`/teams/${team.id}`}
                  className="text-primary transition-colors hover:text-primary/80"
                >
                  View team workspace
                </Link>
              )}
              {missingTeam && (
                <Link
                  href={`/projects/${projectId}/settings`}
                  className="text-primary transition-colors hover:text-primary/80"
                >
                  Assign team
                </Link>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatSprintDateRange(activeSprint)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddExtraStoryDialog
              projectId={projectId}
              readyStories={readyStories}
              open={extraStoryDialogOpen}
              onOpenChange={setExtraStoryDialogOpen}
              isLoading={planningStoriesLoading}
            />
            <Link href={`/projects/${projectId}/backlog`}>
              <Button variant="outline" size="sm">
                Backlog
              </Button>
            </Link>
          </div>
        </div>

        {missingTeam && (
          <Alert className="mb-8 border-amber-200 bg-amber-50">
            <AlertTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              Assign a team before continuing sprint execution
            </AlertTitle>
            <AlertDescription className="mt-2 text-amber-900/90">
              Sprint metrics rely on a team assignment. Link this project to a delivery team in
              project settings so progress rolls up correctly.
            </AlertDescription>
          </Alert>
        )}

        {!isContributorRole && (
          <SprintSpotlight
            projectId={projectId}
            sprint={activeSprint}
            team={team ? { name: team.name, velocityHistory: team.velocityHistory } : undefined}
            stories={sprintStories}
            readinessByStoryId={readinessByStoryId}
            toast={toast}
          />
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{executionMetrics.total}</CardTitle>
              <CardDescription>Total sprint stories</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{executionMetrics.committed}</CardTitle>
              <CardDescription>Committed backlog items</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{executionMetrics.inProgress}</CardTitle>
              <CardDescription>In progress</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{executionMetrics.accepted}</CardTitle>
              <CardDescription>Accepted stories</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-8">
          <AIAssistant projectId={projectId} context="general" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {executionColumnsWithStories.map((column) => (
            <Card key={column.id} data-testid="board-column">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{column.title}</CardTitle>
                    <CardDescription>{column.subtitle}</CardDescription>
                  </div>
                  <Badge variant="secondary">{column.stories.length}</Badge>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  {getStageRangeLabel(column.statuses)}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {column.stories.length > 0 ? (
                  column.stories.map((story) => {
                    const isUpdating =
                      updateStoryStatusMutation.isPending &&
                      updateStoryStatusMutation.variables?.storyId === story.id

                    return (
                      <StoryCard
                        key={story.id}
                        story={story}
                        isUpdating={isUpdating}
                        onAdvance={(targetStatus) =>
                          updateStoryStatusMutation.mutate({
                            storyId: story.id,
                            status: targetStatus,
                          })
                        }
                        onRevert={(targetStatus) =>
                          updateStoryStatusMutation.mutate({
                            storyId: story.id,
                            status: targetStatus,
                          })
                        }
                      />
                    )
                  })
                ) : (
                  <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 text-center text-muted-foreground">
                    <Users className="mb-2 h-8 w-8 opacity-60" />
                    <p className="text-sm font-medium">No stories yet</p>
                    <p className="text-xs text-muted-foreground/80">
                      Pull a ready story forward only after discussing scope with the team.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
