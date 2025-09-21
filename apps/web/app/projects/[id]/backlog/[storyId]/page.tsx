'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Plus, CheckCircle2, Circle, Clock, Zap, User, Timer } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { TaskOwnership } from '@/components/tasks/TaskOwnership'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { CanModifyBacklog, CanAcceptStories } from '@/components/guards/RoleGuard'

// Updated status config to match new 9-stage workflow
const statusConfig = {
  'draft': { icon: Circle, label: 'Draft', color: 'text-gray-500', stage: 1 },
  'needsrefinement': { icon: Circle, label: 'Needs Refinement', color: 'text-orange-500', stage: 2 },
  'ready': { icon: CheckCircle2, label: 'Ready', color: 'text-green-500', stage: 3 },
  'committed': { icon: Zap, label: 'Committed', color: 'text-blue-500', stage: 4 },
  'inprogress': { icon: Clock, label: 'In Progress', color: 'text-yellow-500', stage: 5 },
  'taskscomplete': { icon: CheckCircle2, label: 'Tasks Complete', color: 'text-purple-500', stage: 6 },
  'deployed': { icon: Zap, label: 'Deployed', color: 'text-indigo-500', stage: 7 },
  'awaitingacceptance': { icon: Clock, label: 'Awaiting Acceptance', color: 'text-pink-500', stage: 8 },
  'accepted': { icon: CheckCircle2, label: 'Accepted', color: 'text-green-600', stage: 9 },

  // Legacy mappings for compatibility
  'backlog': { icon: CheckCircle2, label: 'Ready', color: 'text-green-500', stage: 3 },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-yellow-500', stage: 5 },
  'in-review': { icon: Clock, label: 'In Review', color: 'text-orange-500', stage: 8 },
  'done': { icon: CheckCircle2, label: 'Done', color: 'text-green-600', stage: 9 },
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

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: story, isLoading: storyLoading, error: storyError } = useQuery({
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

  const isLoading = projectLoading || storyLoading || tasksLoading || acLoading

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
            <Link href={`/projects/${projectId}/backlog`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
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

  const statusInfo = statusConfig[story.status] || { icon: Circle, label: 'Unknown', color: 'text-gray-500', stage: 0 }
  const StatusIcon = statusInfo.icon

  // Calculate task completion progress
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href={`/projects/${projectId}/backlog`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
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
                        <Badge variant="outline" className={statusInfo.color.replace('text-', 'border-')}>
                          {statusInfo.label}
                        </Badge>
                        <span className="text-xs text-gray-500">({statusInfo.stage}/9)</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Stage {statusInfo.stage} of 9: {statusInfo.label}</p>
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
                    Viewing as: <Badge variant="outline" className="ml-1">{getRoleDisplayName()}</Badge>
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
                    <span>{completedTasks}/{totalTasks} completed</span>
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

            <CanModifyBacklog fallback={
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
            }>
              <Button>
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
                              variant={acceptanceCriteria.length >= 3 ? "default" : "destructive"}
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
                              ? "✅ This story meets the readiness requirement"
                              : `⚠️ Need ${3 - acceptanceCriteria.length} more criteria`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <CanModifyBacklog fallback={
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
                  }>
                    <Button size="sm" variant="outline" data-testid="add-acceptance-criteria">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Criterion
                    </Button>
                  </CanModifyBacklog>
                </div>
              </CardHeader>
              <CardContent>
                {acceptanceCriteria.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-2">No acceptance criteria defined yet</p>
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
                          <p><span className="font-medium text-green-700">Given:</span> {ac.given}</p>
                          <p><span className="font-medium text-blue-700">When:</span> {ac.whenClause}</p>
                          <p><span className="font-medium text-purple-700">Then:</span> {ac.thenClause}</p>
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
                              variant={taskProgress === 100 ? "default" : "secondary"}
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
                              ? "✅ All tasks complete - story can move to Tasks Complete stage"
                              : `⚠️ ${totalTasks - completedTasks} tasks remaining`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <CanModifyBacklog fallback={
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
                  }>
                    <Button size="sm" variant="outline" data-testid="add-task">
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
                              <h4 className="font-medium text-lg" data-testid={`task-title-${task.id}`}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {task.description}
                                </p>
                              )}
                              {task.id && (
                                <span className="text-xs text-gray-500">#{task.id.slice(-6)}</span>
                              )}
                            </div>
                          </div>

                          {/* Task Ownership Component */}
                          <TaskOwnership
                            task={task}
                            showEstimate={true}
                            showWorkflow={true}
                            compact={false}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Task Workflow Guide for Contributors */}
                    {user && (user.role === 'contributor' || user.role === 'managing_contributor') && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Timer className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <h5 className="font-medium text-blue-900 mb-2">Task Self-Selection Workflow</h5>
                            <div className="text-sm text-blue-800 space-y-1">
                              <p>• <strong>Available tasks:</strong> Click &quot;I&apos;m on it&quot; to take ownership</p>
                              <p>• <strong>Owned tasks:</strong> Add time estimate, then start work</p>
                              <p>• <strong>In Progress:</strong> Complete when finished</p>
                              <p>• <strong>One at a time:</strong> Complete current task before taking another</p>
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
                  <Badge variant="outline" className={priorityConfig[story.priority || 'medium'].color}>
                    {priorityConfig[story.priority || 'medium'].label}
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
  )
}