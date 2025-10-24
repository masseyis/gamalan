'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  FolderOpen,
  CheckCircle,
  Clock,
  TrendingUp,
  Target,
  Zap,
  Activity,
  ListChecks,
  Sparkles,
  User,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { UserGuide, RoleExplanation } from '@/components/ui/user-guide'
import { useRoles } from '@/components/providers/UserContextProvider'
import { Project } from '@/lib/types/project'
import { Story, Task } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'
import { backlogApi } from '@/lib/api/backlog'
import { sprintApi } from '@/lib/api/sprint'
import { RolePermissions, User as ContextUser } from '@/lib/types/user'

interface DashboardProps {
  projects: Project[]
  recentActivity: any[]
  userPerformance: any[]
}

type SprintTaskSuggestion = {
  task: Task
  story: Story
  project: Project
  sprintName: string
}

type SprintTaskBucket = {
  story: Story
  project: Project
  sprintName: string
  tasks: Task[]
}

type SprintTasksSnapshot = {
  suggestions: SprintTaskSuggestion[]
  buckets: SprintTaskBucket[]
}

const TASK_STATUS_BADGE: Record<Task['status'], string> = {
  available: 'bg-slate-100 text-slate-700 border-slate-200',
  owned: 'bg-blue-100 text-blue-700 border-blue-200',
  inprogress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const TASK_STATUS_LABEL: Record<Task['status'], string> = {
  available: 'Available',
  owned: 'Owned',
  inprogress: 'In Progress',
  completed: 'Completed',
}

const OWNED_STATUS_ORDER: Record<Task['status'], number> = {
  inprogress: 0,
  owned: 1,
  available: 2,
  completed: 3,
}

const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  backend: ['backend', 'api', 'service', 'database', 'endpoint', 'graphql'],
  frontend: ['frontend', 'ui', 'component', 'react', 'layout', 'css'],
  fullstack: ['backend', 'frontend', 'fullstack', 'api', 'component'],
  qa: ['test', 'qa', 'automation', 'coverage', 'playwright', 'vitest'],
  devops: ['deploy', 'pipeline', 'infrastructure', 'ci', 'cd', 'docker'],
  ux_designer: ['design', 'ux', 'wireframe', 'mock', 'prototype'],
}

async function fetchSprintTasks(
  projects: Project[],
  activeSprintMap?: Record<string, Sprint | null | undefined>
): Promise<SprintTasksSnapshot> {
  const suggestions: SprintTaskSuggestion[] = []
  const buckets: SprintTaskBucket[] = []
  const validStatuses: StoryStatus[] = [
    'committed',
    'inprogress',
    'taskscomplete',
    'awaitingacceptance',
    'accepted',
  ]

  await Promise.all(
    projects.map(async (project) => {
      try {
        const sprint =
          activeSprintMap && project.id in activeSprintMap
            ? (activeSprintMap[project.id] ?? null)
            : await sprintApi.getActiveSprint(project.id)
        if (!sprint) {
          return
        }

        const stories = await backlogApi.getStories(project.id, sprint.id)

        await Promise.all(
          stories.map(async (story) => {
            if (!validStatuses.includes(story.status)) {
              return
            }
            try {
              const tasks = await backlogApi.getTasks(project.id, story.id)
              buckets.push({ story, project, sprintName: sprint.name, tasks })

              tasks
                .filter((task) => !task.ownerUserId && task.status === 'available')
                .forEach((task) =>
                  suggestions.push({
                    task,
                    story,
                    project,
                    sprintName: sprint.name,
                  })
                )
            } catch (error) {
              console.warn('Failed to fetch tasks for story', story.id, error)
            }
          })
        )
      } catch (error) {
        console.warn('Failed to fetch sprint tasks for project', project.id, error)
      }
    })
  )

  return { suggestions, buckets }
}

function scoreTaskForSpecialty(entry: SprintTaskSuggestion, specialty?: string | null): number {
  if (!specialty) {
    return 0
  }

  const keywords = SPECIALTY_KEYWORDS[specialty] ?? []
  if (!keywords.length) {
    return specialty === 'fullstack' ? 1 : 0
  }

  const haystack =
    `${entry.task.title} ${entry.task.description ?? ''} ${entry.story.title}`.toLowerCase()

  let score = 1 // baseline so suggestions remain ordered consistently
  keywords.forEach((keyword) => {
    if (haystack.includes(keyword)) {
      score += 3
    }
  })

  return score
}

function sortOwnedTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => OWNED_STATUS_ORDER[a.status] - OWNED_STATUS_ORDER[b.status])
}

function buildStoryLookup(projects: Project[]) {
  const map = new Map<string, { project: Project; story?: Story }>()
  projects.forEach((project) => {
    project.stories?.forEach((story) => {
      map.set(story.id, { project, story })
    })
  })
  return map
}

export default function DashboardPage({
  projects,
  recentActivity,
  userPerformance,
}: DashboardProps) {
  const { isLoaded } = useAuth()
  const { user } = useUser()
  const { user: contextUser } = useRoles()

  if (!isLoaded) {
    return (
      <div className="container py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  const displayName =
    user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || 'User'
  const isContributorRole =
    contextUser?.role === 'contributor' || contextUser?.role === 'managing_contributor'

  if (isContributorRole) {
    return (
      <ContributorDashboard
        projects={projects}
        recentActivity={recentActivity}
        userPerformance={userPerformance}
        displayName={displayName}
        contextUser={contextUser}
      />
    )
  }

  return (
    <DefaultDashboard
      projects={projects}
      recentActivity={recentActivity}
      userPerformance={userPerformance}
      displayName={displayName}
    />
  )
}

function ContributorDashboard({
  projects,
  displayName,
  contextUser,
}: {
  projects: Project[]
  displayName: string
  contextUser: (ContextUser & { permissions?: RolePermissions }) | null
  recentActivity?: any[]
  userPerformance?: any[]
}) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const storyLookup = useMemo(() => buildStoryLookup(projects), [projects])

  const activeSprintQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ['dashboard', 'active-sprint', projectId],
      queryFn: () => sprintApi.getActiveSprint(projectId),
      staleTime: 30 * 1000,
    })),
  })

  const activeSprintByProjectId = useMemo(() => {
    const map: Record<string, Sprint | null | undefined> = {}
    projectIds.forEach((projectId, index) => {
      map[projectId] = activeSprintQueries[index]?.data ?? null
    })
    return map
  }, [activeSprintQueries, projectIds])

  const activeSprintKey = useMemo(
    () => activeSprintQueries.map((result) => result?.data?.id ?? null),
    [activeSprintQueries]
  )

  const activeSprintLoading = activeSprintQueries.some((result) => result.isLoading)
  const activeSprintFetching = activeSprintQueries.some((result) => result.isFetching)
  const activeSprintQueriesLoaded =
    projectIds.length === 0 ||
    activeSprintQueries.every((result) => result.isSuccess || result.isFetched)

  const sprintStoryQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: [
        'dashboard',
        'sprint-stories',
        projectId,
        activeSprintByProjectId[projectId]?.id ?? null,
      ],
      queryFn: () => {
        const sprint = activeSprintByProjectId[projectId]
        if (!sprint) {
          return [] as Story[]
        }
        return backlogApi.getStories(projectId, sprint.id)
      },
      enabled: Boolean(activeSprintByProjectId[projectId]?.id),
      staleTime: 30 * 1000,
    })),
  })

  const {
    data: ownedTasks = [],
    isLoading: ownedLoading,
    isFetching: ownedFetching,
  } = useQuery({
    queryKey: ['dashboard', 'owned-tasks'],
    queryFn: () => backlogApi.getUserOwnedTasks(),
    staleTime: 30 * 1000,
  })

  const {
    data: sprintTasksSnapshot,
    isLoading: sprintTasksLoading,
    isFetching: sprintTasksFetching,
  } = useQuery({
    queryKey: ['dashboard', 'sprint-tasks', projectIds, activeSprintKey],
    queryFn: () => fetchSprintTasks(projects, activeSprintByProjectId),
    enabled: projects.length > 0 && activeSprintQueriesLoaded,
    staleTime: 30 * 1000,
  })

  const availableEntries = sprintTasksSnapshot?.suggestions ?? []
  const sprintTaskBuckets = sprintTasksSnapshot?.buckets ?? []

  const sprintStoryIdSet = useMemo(() => {
    const set = new Set<string>()
    sprintTaskBuckets.forEach((bucket) => set.add(bucket.story.id))
    return set
  }, [sprintTaskBuckets])

  const filteredOwnedTasks = useMemo(() => {
    return ownedTasks.filter((task) => {
      const info = storyLookup.get(task.storyId)
      if (!info?.project || !info.story) {
        return false
      }
      const activeSprint = activeSprintByProjectId[info.project.id]
      if (!activeSprint) {
        return false
      }
      if (info.story.sprintId && info.story.sprintId === activeSprint.id) {
        return true
      }
      return sprintStoryIdSet.has(task.storyId)
    })
  }, [ownedTasks, storyLookup, activeSprintByProjectId, sprintStoryIdSet])

  const ownedQueue = useMemo(() => sortOwnedTasks(filteredOwnedTasks), [filteredOwnedTasks])
  const nextOwnedTask = ownedQueue.find((task) => task.status !== 'completed')
  const userSpecialty = contextUser?.specialty ?? null

  const suggestedTasks = useMemo(() => {
    const ranked = availableEntries
      .filter((entry) => !entry.task.ownerUserId && entry.task.status === 'available')
      .map((entry) => ({
        entry,
        score: scoreTaskForSpecialty(entry, userSpecialty),
      }))
      .sort((a, b) => b.score - a.score)

    return ranked.slice(0, 4).map((item) => item.entry)
  }, [availableEntries, userSpecialty])

  const recentlyCompleted = useMemo(() => {
    if (!contextUser?.id) {
      return [] as Array<{
        task: Task
        story: Story
        project: Project
        sprintName: string
      }>
    }

    const entries: Array<{
      task: Task
      story: Story
      project: Project
      sprintName: string
    }> = []

    sprintTaskBuckets.forEach((bucket) => {
      bucket.tasks.forEach((task) => {
        if (task.ownerUserId === contextUser.id && task.status === 'completed') {
          entries.push({
            task,
            story: bucket.story,
            project: bucket.project,
            sprintName: bucket.sprintName,
          })
        }
      })
    })

    return entries
      .sort((a, b) => {
        const aTime = a.task.completedAt ? new Date(a.task.completedAt).getTime() : 0
        const bTime = b.task.completedAt ? new Date(b.task.completedAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 4)
  }, [sprintTaskBuckets, contextUser?.id])

  const loading =
    ownedLoading ||
    ownedFetching ||
    sprintTasksLoading ||
    sprintTasksFetching ||
    activeSprintLoading ||
    activeSprintFetching

  const fallbackSuggestion = !nextOwnedTask && suggestedTasks.length > 0 ? suggestedTasks[0] : null

  const renderTaskLink = (storyId: string) => {
    const info = storyLookup.get(storyId)
    if (!info?.project) {
      return '#'
    }
    return `/projects/${info.project.id}/backlog/${storyId}`
  }

  const renderSuggestionLink = (entry: SprintTaskSuggestion) =>
    `/projects/${entry.project.id}/backlog/${entry.story.id}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex flex-col gap-4 border-b border-border/40 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold text-primary glow-yellow">
              Welcome back, {displayName}!
            </h1>
            <p className="text-muted-foreground text-lg">
              Here’s what’s on deck. Focus on the next action below and keep an eye on upcoming
              work.
            </p>
          </div>
          <div className="w-fit rounded-full border border-border px-4 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            Contributor workspace
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]"
          data-testid="contributor-next-actions"
        >
          <Card className="border-border bg-gradient-to-br from-background to-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                <Zap className="h-5 w-5 text-primary" />
                Your next action
              </CardTitle>
              <CardDescription>
                {nextOwnedTask
                  ? 'Stay focused on the task in front of you – open it below when you’re ready to dive in.'
                  : fallbackSuggestion
                    ? 'Nothing is currently assigned to you. Here’s a high-impact task you can pick up next.'
                    : 'No active tasks assigned yet. Take a look at the suggestions or grab a task from the backlog.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-3/4 rounded bg-muted" />
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-10 w-40 rounded bg-muted" />
                </div>
              ) : nextOwnedTask ? (
                (() => {
                  const info = storyLookup.get(nextOwnedTask.storyId)
                  const storyTitle = info?.story?.title ?? 'Story'
                  const projectName = info?.project?.name ?? 'Project'

                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm uppercase tracking-wide text-muted-foreground">
                          Current focus
                        </div>
                        <h2 className="text-2xl font-semibold text-foreground">
                          {nextOwnedTask.title}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {storyTitle} • {projectName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={TASK_STATUS_BADGE[nextOwnedTask.status]}
                        >
                          {TASK_STATUS_LABEL[nextOwnedTask.status]}
                        </Badge>
                        {nextOwnedTask.ownedAt && (
                          <span>
                            Owned{' '}
                            {formatDistanceToNow(new Date(nextOwnedTask.ownedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Link href={renderTaskLink(nextOwnedTask.storyId)}>
                          <Button>Open story</Button>
                        </Link>
                        <Link
                          href={`/projects/${storyLookup.get(nextOwnedTask.storyId)?.project.id ?? ''}/board`}
                        >
                          <Button variant="outline">View sprint board</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })()
              ) : fallbackSuggestion ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm uppercase tracking-wide text-muted-foreground">
                      Suggested next task
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">
                      {fallbackSuggestion.task.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {fallbackSuggestion.story.title} • {fallbackSuggestion.project.name}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-amber-600">Available</span> • Ready to be
                    claimed
                  </div>
                  <div className="flex gap-3">
                    <Link href={renderSuggestionLink(fallbackSuggestion)}>
                      <Button>I’ll take this</Button>
                    </Link>
                    <Link href={`/projects/${fallbackSuggestion.project.id}/board`}>
                      <Button variant="outline">Go to board</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 text-sm text-muted-foreground">
                  No work assigned yet. Check the suggestions panel to grab a task or coordinate
                  with your PO.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Quick stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active tasks</span>
                <span className="font-semibold text-foreground">{ownedQueue.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed today</span>
                <span className="font-semibold text-foreground">
                  {
                    recentlyCompleted.filter(
                      (entry) =>
                        entry.task.completedAt &&
                        new Date(entry.task.completedAt).toDateString() ===
                          new Date().toDateString()
                    ).length
                  }
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available suggestions</span>
                <span className="font-semibold text-foreground">{suggestedTasks.length}</span>
              </div>
              {contextUser?.specialty && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Specialty focus</span>
                  <span className="font-semibold uppercase text-foreground">
                    {contextUser.specialty.replace('_', ' ')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="contributor-queues">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <User className="h-4 w-4 text-primary" /> My task queue
              </CardTitle>
              <CardDescription>Everything assigned to you, ordered by urgency.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : ownedQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks assigned yet. Coordinate with your PO or grab an available task below.
                </p>
              ) : (
                <ul className="space-y-3">
                  {ownedQueue.map((task) => {
                    const info = storyLookup.get(task.storyId)
                    const storyTitle = info?.story?.title ?? 'Story'
                    const projectName = info?.project?.name ?? 'Project'

                    return (
                      <li
                        key={task.id}
                        className="rounded-lg border border-border/40 bg-card/60 p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {storyTitle} • {projectName}
                            </p>
                          </div>
                          <Badge variant="outline" className={TASK_STATUS_BADGE[task.status]}>
                            {TASK_STATUS_LABEL[task.status]}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {task.status === 'completed'
                              ? task.completedAt
                                ? `Completed ${formatDistanceToNow(new Date(task.completedAt), { addSuffix: true })}`
                                : 'Completed'
                              : task.ownedAt
                                ? `Owned ${formatDistanceToNow(new Date(task.ownedAt), { addSuffix: true })}`
                                : 'Owned task'}
                          </span>
                          <Link
                            href={renderTaskLink(task.storyId)}
                            className="text-primary hover:underline"
                          >
                            Open story
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Suggested available tasks
              </CardTitle>
              <CardDescription>
                High-affinity work ready to be picked up from the current sprint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : suggestedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unassigned tasks match your specialty right now. Check back later or sync with
                  your team lead.
                </p>
              ) : (
                <ul className="space-y-3">
                  {suggestedTasks.map((entry) => (
                    <li
                      key={entry.task.id}
                      className="rounded-lg border border-border/40 bg-card/60 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {entry.task.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {entry.story.title} • {entry.project.name}
                          </p>
                        </div>
                        <Badge variant="outline" className={TASK_STATUS_BADGE[entry.task.status]}>
                          {TASK_STATUS_LABEL[entry.task.status]}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{entry.sprintName}</span>
                        <Link
                          href={renderSuggestionLink(entry)}
                          className="text-primary hover:underline"
                        >
                          I’ll take this
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
          data-testid="contributor-recent-completed"
        >
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recently completed</CardTitle>
              <CardDescription>
                Great work! Capture any follow-up notes while it’s fresh.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : recentlyCompleted.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent completions yet. Knock out a task and it’ll land here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recentlyCompleted.map((entry) => (
                    <li
                      key={entry.task.id}
                      className="rounded-lg border border-border/40 bg-card/60 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-foreground">{entry.task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.story.title} • {entry.project.name}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.task.completedAt
                            ? formatDistanceToNow(new Date(entry.task.completedAt), {
                                addSuffix: true,
                              })
                            : 'Completed recently'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <RoleExplanation role={contextUser?.role ?? 'contributor'} />
        </div>

        <UserGuide />
      </div>
    </div>
  )
}

function DefaultDashboard({
  projects,
  recentActivity,
  userPerformance,
  displayName,
}: DashboardProps & { displayName: string }) {
  const activeProjects = projects?.length || 0
  let storiesInProgress = 0
  let storiesCompleted = 0

  const allStories = projects?.flatMap((p) => p.stories || []) || []

  if (allStories) {
    storiesInProgress = allStories.filter((s) => s.status === 'inprogress').length
    storiesCompleted = allStories.filter((s) => s.status === 'accepted').length
  }

  const recentProjects = projects?.slice(0, 3) || []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-primary glow-yellow">
                Welcome back, {displayName}!
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Here&apos;s an overview of your projects and recent activity.
              </p>
            </div>
            <div className="battra-gradient p-4 rounded-xl border border-border">
              <div className="text-sm text-muted-foreground">Today</div>
              <div className="text-2xl font-bold text-primary">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="battra-gradient border-border kaiju-pattern">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center text-primary">
                <Zap className="h-4 w-4 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <Link href="/projects/new">
                  <Button size="sm" className="w-full justify-start pulse-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </Link>
                <Link href="/projects">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start border-border hover:bg-secondary"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Browse Projects
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Stats Cards */}
          <Card className="battra-gradient border-border glow-yellow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center text-muted-foreground">
                  <Target className="h-4 w-4 mr-2 text-primary" />
                  Active Projects
                </CardDescription>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-4 w-4 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-primary">{activeProjects}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="battra-gradient border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center text-muted-foreground">
                  <Activity className="h-4 w-4 mr-2 text-primary" />
                  In Progress
                </CardDescription>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-primary">{storiesInProgress}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="battra-gradient border-border glow-red">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mr-2 text-accent" />
                  Completed
                </CardDescription>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-accent" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-accent">{storiesCompleted}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Projects and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="battra-gradient border-border kaiju-pattern">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-foreground">Recent Projects</CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    Your most recently accessed projects
                  </CardDescription>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentProjects.length > 0 ? (
                <div className="space-y-4">
                  {recentProjects.map((project, index) => (
                    <div key={project.id} className="group relative">
                      <div className="flex items-center space-x-3 p-4 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-200 hover:shadow-soft bg-gradient-surface">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                          <FolderOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/projects/${project.id}`}>
                            <h3 className="font-semibold hover:text-primary cursor-pointer transition-colors truncate">
                              {project.name}
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {project.description || 'No description'}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="absolute left-0 top-0 h-full w-[2px] rounded bg-primary/0 group-hover:bg-primary/80 transition-all" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  No recent projects yet. Create one to get started.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="battra-gradient border-border">
            <CardHeader>
              <CardTitle className="text-xl text-foreground">Recent Activity</CardTitle>
              <CardDescription className="text-muted-foreground">
                Latest updates across your workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mt-2">
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No recent activity yet. Keep shipping!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          <Card className="battra-gradient border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-foreground">Performance insights</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Velocity, predictions, and key metrics
                  </CardDescription>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {userPerformance.length > 0 ? (
                <div className="space-y-4">
                  {userPerformance.map((performance, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-border/30 p-4 bg-gradient-perf"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {performance.metric}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {performance.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-primary/10 text-primary">
                          {performance.value}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-muted-foreground">
                  Performance metrics coming soon. Stay tuned!
                </div>
              )}
            </CardContent>
          </Card>

          <RoleExplanation role="product_owner" />
        </div>

        <UserGuide />
      </div>
    </div>
  )
}
