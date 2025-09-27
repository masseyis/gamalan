'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Kanban, List, Settings, Plus, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getProject(projectId),
  })

  const { data: stories, isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', projectId],
    queryFn: () => backlogApi.getStories(projectId),
    enabled: !!projectId,
  })

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-16">
            <p className="text-muted-foreground">Loading project...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-16">
            <p className="text-muted-foreground">Project not found</p>
            <Link href="/projects">
              <Button className="mt-4">Back to Projects</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const storyStats = {
    total: stories?.length || 0,
    draft: stories?.filter(s => ['draft', 'needsrefinement'].includes(s.status)).length || 0,
    ready: stories?.filter(s => s.status === 'ready').length || 0,
    inProgress: stories?.filter(s => ['committed', 'inprogress', 'taskscomplete', 'deployed'].includes(s.status)).length || 0,
    done: stories?.filter(s => ['awaitingacceptance', 'accepted'].includes(s.status)).length || 0,
  }

  const totalPoints = stories?.reduce((sum, story) => sum + (story.storyPoints || 0), 0) || 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{project.name}</h1>
          <p className="text-muted-foreground">{project.description}</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link href={`/projects/${projectId}/backlog`}>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <List className="h-4 w-4 mr-2" />
                  Backlog
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{storyStats.total}</div>
                <div className="text-xs text-muted-foreground">
                  {totalPoints} story points
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/projects/${projectId}/board`}>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Kanban className="h-4 w-4 mr-2" />
                  Sprint Board
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{storyStats.inProgress}</div>
                <div className="text-xs text-muted-foreground">in progress</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/projects/${projectId}/settings`}>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground">
                  Configure project
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/projects/${projectId}/backlog/new`}>
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-salunga-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center text-salunga-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  New Story
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground">
                  Add to backlog
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Story Status Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Story Status Overview</CardTitle>
              <CardDescription>Current distribution of stories by status</CardDescription>
            </CardHeader>
            <CardContent>
              {storiesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading stories...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-gray-400 mr-3"></div>
                      <span>Draft</span>
                    </div>
                    <Badge variant="secondary">{storyStats.draft}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
                      <span>Ready</span>
                    </div>
                    <Badge variant="secondary">{storyStats.ready}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-salunga-accent mr-3"></div>
                      <span>In Progress</span>
                    </div>
                    <Badge variant="secondary">{storyStats.inProgress}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 mr-3"></div>
                      <span>Done</span>
                    </div>
                    <Badge variant="secondary">{storyStats.done}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Stories</CardTitle>
              <CardDescription>Latest updated stories in this project</CardDescription>
            </CardHeader>
            <CardContent>
              {storiesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading stories...</p>
                </div>
              ) : stories && stories.length > 0 ? (
                <div className="space-y-4">
                  {stories.slice(0, 5).map((story) => (
                    <div key={story.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0 mt-1">
                        {story.status === 'accepted' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : ['committed', 'inprogress', 'taskscomplete', 'deployed'].includes(story.status) ? (
                          <Clock className="h-4 w-4 text-salunga-accent" />
                        ) : story.status === 'ready' ? (
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Link href={`/projects/${projectId}/backlog/${story.id}`}>
                          <h3 className="font-medium hover:text-salunga-primary cursor-pointer text-sm">
                            {story.title}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {story.storyPoints} pts
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              story.priority === 'critical' ? 'border-red-500 text-red-500' :
                              story.priority === 'high' ? 'border-orange-500 text-orange-500' :
                              story.priority === 'medium' ? 'border-blue-500 text-blue-500' :
                              'border-gray-500 text-gray-500'
                            }`}
                          >
                            {story.priority}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Link href={`/projects/${projectId}/backlog`}>
                    <Button variant="outline" className="w-full">
                      View All Stories
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No stories yet</p>
                  <p className="text-sm">Create your first story to get started</p>
                  <Link href={`/projects/${projectId}/backlog/new`}>
                    <Button className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Story
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}