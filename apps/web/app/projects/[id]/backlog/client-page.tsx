'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Plus,
  FolderOpen,
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { Story, StoryStatus } from '@/lib/types/story'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { CanModifyBacklog } from '@/components/guards/RoleGuard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Project } from '@/lib/types/project'

// Updated to match new 9-stage story workflow
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

  // Legacy status mapping for compatibility
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

export default function ProjectBacklogPage({
  project,
  stories,
}: {
  project: Project
  stories: Story[]
}) {
  const params = useParams()
  const projectId = params.id as string
  const { canModifyBacklog } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()

  const renderStoryCard = (story: Story) => {
    const statusInfo = statusConfig[story.status] || {
      icon: Circle,
      label: 'Unknown',
      color: 'text-gray-500',
      stage: 0,
    }
    const StatusIcon = statusInfo.icon

    // Calculate task completion if tasks are available
    const totalTasks = story.tasks?.length || 0
    const completedTasks = story.tasks?.filter((t) => t.status === 'completed').length || 0
    const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    // Count acceptance criteria
    const acCount = story.acceptanceCriteria?.length || 0

    return (
      <Link key={story.id} href={`/projects/${projectId}/backlog/${story.id}`}>
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer group"
          data-testid={`story-card-${story.id}`}
        >
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                          <Badge
                            variant="outline"
                            className={statusInfo.color
                              .replace('text-', 'border-')
                              .replace('text-', 'text-')}
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
                        <p className="text-xs text-gray-300">
                          {getStatusDescription(story.status)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {story.storyPoints && (
                    <Badge variant="outline" className="text-blue-700 border-blue-200">
                      {story.storyPoints} pts
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-lg line-clamp-2" data-testid={`story-title-${story.id}`}>
                  {story.title}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {story.description || 'No description provided'}
                </CardDescription>

                {/* Task Progress Bar */}
                {totalTasks > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Task Progress</span>
                      <span>
                        {completedTasks}/{totalTasks}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${taskProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <CanModifyBacklog fallback={<div />}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                  data-testid={`story-menu-${story.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CanModifyBacklog>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>#{story.id.slice(-6)}</span>
                <span className={acCount >= 3 ? 'text-green-600' : 'text-orange-600'}>
                  ACs: {acCount}
                  {acCount < 3 ? ' (needs 3+)' : ''}
                </span>
                {totalTasks > 0 && <span>Tasks: {totalTasks}</span>}
                {story.assignedToUserId && <span className="text-blue-600">Assigned</span>}
              </div>
              <div className="flex items-center gap-2">
                {story.sprintId && (
                  <Badge variant="outline" className="text-purple-700 border-purple-200">
                    In Sprint
                  </Badge>
                )}
                <span className="text-xs">
                  Updated {new Date(story.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Helper function to get status descriptions
  const getStatusDescription = (status: StoryStatus): string => {
    const descriptions = {
      draft: 'Initial story creation, needs refinement',
      needsrefinement: 'Story needs more detail or clarification',
      ready: 'Has 3+ acceptance criteria, ready for sprint',
      committed: 'Committed to current sprint',
      inprogress: 'Development work has started',
      taskscomplete: 'All tasks completed, ready for deployment',
      deployed: 'Changes deployed to environment',
      awaitingacceptance: 'Waiting for Product Owner acceptance',
      accepted: 'Story accepted and complete',
    }
    return descriptions[status] || 'Unknown status'
  }

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <Link
              href="/projects"
              className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-4 group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to Projects
            </Link>
            <h1 className="text-4xl font-bold text-gradient-primary">{project.name} - Backlog</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your product backlog and user stories
            </p>
            {user && (
              <div className="mt-2 text-sm text-gray-600">
                <span>Viewing as: </span>
                <Badge variant="outline" className="ml-1">
                  {getRoleDisplayName()}
                </Badge>
                {!canModifyBacklog && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-amber-600 cursor-help">👁️ Read-only</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Your role provides read-only access to view progress and metrics</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )}
          </div>
          <CanModifyBacklog
            fallback={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled className="shadow-soft">
                      <Plus className="h-4 w-4 mr-2" />
                      New Story
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only Product Owners can create new stories</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }
          >
            <Link href={`/projects/${projectId}/backlog/new`}>
              <Button className="shadow-soft hover:shadow-elevated transition-all duration-200">
                <Plus className="h-4 w-4 mr-2" />
                New Story
              </Button>
            </Link>
          </CanModifyBacklog>
        </div>

        {/* Enhanced Stats for 9-Stage Workflow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="card-elevated animate-slide-up">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <FolderOpen className="h-4 w-4 mr-2 text-primary" />
                  Total Stories
                </CardDescription>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-primary">{stories.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                  Ready for Sprint
                </CardDescription>
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-success">
                {stories.filter((s) => ['ready', 'backlog'].includes(s.status)).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated animate-slide-up" style={{ animationDelay: '200ms' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-info" />
                  In Development
                </CardDescription>
                <div className="p-2 bg-info/10 rounded-lg">
                  <Clock className="h-4 w-4 text-info" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-info">
                {
                  stories.filter((s) =>
                    ['committed', 'inprogress', 'taskscomplete', 'in-progress'].includes(s.status)
                  ).length
                }
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated animate-slide-up" style={{ animationDelay: '300ms' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-warning" />
                  Completed
                </CardDescription>
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Zap className="h-4 w-4 text-warning" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-warning">
                {stories.filter((s) => ['accepted', 'done'].includes(s.status)).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-8">
          <AIAssistant projectId={projectId} context="backlog" />
        </div>

        {stories.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <div className="text-center">
                <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">No stories yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Start building your product backlog by creating your first user story
                </p>
                <Link href={`/projects/${projectId}/backlog/new`}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Story
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Draft & Refinement Section */}
            {stories.some((story) => ['draft', 'needsrefinement'].includes(story.status)) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Circle className="h-5 w-5 mr-2 text-gray-500" />
                  Needs Work
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-gray-400 cursor-help">ℹ️</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stories in draft or needing refinement</p>
                        <p className="text-xs text-gray-300">Add acceptance criteria and details</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter((story) =>
                      ['draft', 'needsrefinement', 'backlog'].includes(story.status)
                    )
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Ready for Sprint */}
            {stories.some((story) => ['ready'].includes(story.status)) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                  Ready for Sprint
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-green-400 cursor-help">✅</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stories with 3+ acceptance criteria</p>
                        <p className="text-xs text-gray-300">Ready to be committed to a sprint</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h2>
                <div className="space-y-4">
                  {stories.filter((story) => ['ready'].includes(story.status)).map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Sprint Work */}
            {stories.some((story) =>
              ['committed', 'inprogress', 'taskscomplete', 'in-progress'].includes(story.status)
            ) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-yellow-500" />
                  Sprint Work
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-yellow-400 cursor-help">⚡</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stories committed to current sprint</p>
                        <p className="text-xs text-gray-300">In various stages of development</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter((story) =>
                      ['committed', 'inprogress', 'taskscomplete', 'in-progress'].includes(
                        story.status
                      )
                    )
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Deployed & Awaiting Acceptance */}
            {stories.some((story) =>
              ['deployed', 'awaitingacceptance', 'in-review'].includes(story.status)
            ) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-purple-500" />
                  Review & Acceptance
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-purple-400 cursor-help">👁️</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stories deployed and waiting for Product Owner acceptance</p>
                        <p className="text-xs text-gray-300">Ready for final review</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter((story) =>
                      ['deployed', 'awaitingacceptance', 'in-review'].includes(story.status)
                    )
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Completed Stories */}
            {stories.some((story) => ['accepted', 'done'].includes(story.status)) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                  Completed
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-2 text-green-400 cursor-help">🎉</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Stories accepted by Product Owner</p>
                        <p className="text-xs text-gray-300">Value delivered to users</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter((story) => ['accepted', 'done'].includes(story.status))
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Workflow Guide */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-blue-600" />
                  Story Workflow Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-700 space-y-2">
                  <p>
                    <strong>9-Stage Process:</strong>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="font-medium text-gray-900">Planning (1-3):</p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-1">
                        <li>• Draft → Needs Refinement → Ready</li>
                        <li>• Add 3+ acceptance criteria</li>
                        <li>• Maximum 8 story points</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Development (4-6):</p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-1">
                        <li>• Committed → In Progress → Tasks Complete</li>
                        <li>• Contributors take task ownership</li>
                        <li>• Self-organize work</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Delivery (7-9):</p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-1">
                        <li>• Deployed → Awaiting Acceptance → Accepted</li>
                        <li>• Product Owner acceptance required</li>
                        <li>• Value delivered to users</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
