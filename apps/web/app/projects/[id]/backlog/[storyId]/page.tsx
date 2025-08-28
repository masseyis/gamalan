'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Plus, CheckCircle2, Circle, Clock } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { AIAssistant } from '@/components/ai/ai-assistant'

const statusConfig = {
  draft: { icon: Circle, label: 'Draft', color: 'text-gray-500' },
  backlog: { icon: Circle, label: 'Backlog', color: 'text-blue-500' },
  ready: { icon: CheckCircle2, label: 'Ready', color: 'text-green-500' },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-yellow-500' },
  'in-review': { icon: Clock, label: 'In Review', color: 'text-orange-500' },
  done: { icon: CheckCircle2, label: 'Done', color: 'text-green-600' },
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

  const StatusIcon = statusConfig[story.status]?.icon || Circle
  const statusColor = statusConfig[story.status]?.color || 'text-gray-500'
  const priorityStyle = priorityConfig[story.priority] || priorityConfig.medium

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href={`/projects/${projectId}/backlog`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Backlog
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusIcon className={`h-6 w-6 ${statusColor}`} />
                <Badge variant="outline" className={priorityStyle.color}>
                  {priorityStyle.label}
                </Badge>
                {story.storyPoints && (
                  <Badge variant="secondary">{story.storyPoints} points</Badge>
                )}
                <span className="text-muted-foreground text-sm">#{story.id.slice(-6)}</span>
              </div>
              <h1 className="text-3xl font-bold">{story.title}</h1>
              <p className="text-muted-foreground mt-2">{project.name}</p>
            </div>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Story
            </Button>
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
                  <CardTitle>Acceptance Criteria</CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Criterion
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {acceptanceCriteria.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No acceptance criteria defined yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {acceptanceCriteria.map((ac, index) => (
                      <div key={ac.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Criterion {index + 1}</h4>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Given:</span> {ac.given}</p>
                          <p><span className="font-medium">When:</span> {ac.when}</p>
                          <p><span className="font-medium">Then:</span> {ac.then}</p>
                        </div>
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
                  <CardTitle>Tasks</CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No tasks created yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 border rounded">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <h4 className="font-medium">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          )}
                        </div>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    ))}
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
                  <Badge variant="outline" className={priorityStyle.color}>
                    {priorityStyle.label}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Story Points</span>
                  <span>{story.storyPoints || 'Not estimated'}</span>
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