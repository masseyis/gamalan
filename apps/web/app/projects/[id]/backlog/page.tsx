'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, FolderOpen, MoreVertical, CheckCircle2, Circle, Clock, Zap } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'
import { Story, StoryStatus } from '@/lib/types/story'
// StoryPriority type doesn't exist in the type definitions
import { AIAssistant } from '@/components/ai/ai-assistant'

const statusConfig = {
  'backlog': { icon: CheckCircle2, label: 'Ready', color: 'text-green-500' },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-yellow-500' },
  'in-review': { icon: Clock, label: 'In Review', color: 'text-orange-500' },
  'done': { icon: CheckCircle2, label: 'Done', color: 'text-green-600' },
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
}

export default function ProjectBacklogPage() {
  const params = useParams()
  const projectId = params.id as string

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: stories = [], isLoading: storiesLoading, error: storiesError } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => backlogApi.getStories(projectId),
    enabled: !!projectId,
  })

  const isLoading = projectLoading || storiesLoading
  const error = projectError || storiesError

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Backlog</h1>
            <p className="text-muted-foreground mt-2">Loading project backlog...</p>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-muted rounded w-full mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
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
            <Link href="/projects" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Link>
            <h1 className="text-3xl font-bold">Backlog</h1>
            <p className="text-muted-foreground mt-2">Project not found or failed to load</p>
          </div>
        </div>
      </div>
    )
  }

  const renderStoryCard = (story: Story) => {
    const StatusIcon = statusConfig[story.status]?.icon || Circle
    const statusColor = statusConfig[story.status]?.color || 'text-gray-500'
    const priorityStyle = priorityConfig.medium // Default since Story doesn't have priority

    return (
      <Link key={story.id} href={`/projects/${projectId}/backlog/${story.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="story-card">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                  <Badge variant="outline" className={priorityStyle.color}>
                    {priorityStyle.label}
                  </Badge>
                </div>
                <CardTitle className="text-lg line-clamp-2">{story.title}</CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {story.description || 'No description provided'}
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Story ID: {story.id.slice(-6)}</span>
                <span>Tasks: 0</span>
                <span>ACs: 0</span>
              </div>
              <span>#{story.id.slice(-6)}</span>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <Link href="/projects" className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors mb-4 group">
              <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
              Back to Projects
            </Link>
            <h1 className="text-4xl font-bold text-gradient-primary">
              {project.name} - Backlog
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your product backlog and user stories
            </p>
          </div>
          <Link href={`/projects/${projectId}/backlog/new`}>
            <Button className="shadow-soft hover:shadow-elevated transition-all duration-200">
              <Plus className="h-4 w-4 mr-2" />
              New Story
            </Button>
          </Link>
        </div>

        {/* Enhanced Stats */}
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
          <Card className="card-elevated animate-slide-up" style={{animationDelay: '100ms'}}>
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
                {stories.filter(s => s.status === 'backlog').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated animate-slide-up" style={{animationDelay: '200ms'}}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-info" />
                  In Progress
                </CardDescription>
                <div className="p-2 bg-info/10 rounded-lg">
                  <Clock className="h-4 w-4 text-info" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-info">
                {stories.filter(s => s.status === 'in-progress').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="card-elevated animate-slide-up" style={{animationDelay: '300ms'}}>
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
                {stories.filter(s => s.status === 'done').length}
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
          <div className="space-y-6">
            {/* Backlog Stories */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Backlog</h2>
              <div className="space-y-4">
                {stories
                  .filter(story => ['draft', 'backlog'].includes(story.status))
                  .map(renderStoryCard)}
              </div>
            </div>

            {/* Ready Stories */}
            {stories.some(story => story.status === 'backlog') && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                  Ready for Sprint
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter(story => story.status === 'backlog')
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* In Progress */}
            {stories.some(story => ['in-progress', 'in-review'].includes(story.status)) && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-yellow-500" />
                  In Progress
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter(story => ['in-progress', 'in-review'].includes(story.status))
                    .map(renderStoryCard)}
                </div>
              </div>
            )}

            {/* Done */}
            {stories.some(story => story.status === 'done') && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                  Done
                </h2>
                <div className="space-y-4">
                  {stories
                    .filter(story => story.status === 'done')
                    .map(renderStoryCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}