'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FolderOpen, CheckCircle, Clock, TrendingUp, Target, Zap, Activity } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/lib/api/projects'
import { backlogApi } from '@/lib/api/backlog'

// Hook to check if Clerk is available
function useUserSafe() {
  try {
    // Only import and use useUser if Clerk is configured
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      const { useUser } = require('@clerk/nextjs')
      return useUser()
    }
    return { user: { firstName: 'Demo User' } }
  } catch {
    return { user: { firstName: 'Demo User' } }
  }
}

export default function DashboardPage() {
  const { user } = useUserSafe()

  // Load projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getProjects(),
  })

  // Calculate stats
  const activeProjects = projects?.length || 0
  let storiesInProgress = 0
  let storiesCompleted = 0

  // Load stories for each project to calculate stats
  const { data: allStories } = useQuery({
    queryKey: ['dashboard-stories', projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects) return []
      const storyPromises = projects.map(project => backlogApi.getStories(project.id))
      const storiesArrays = await Promise.all(storyPromises)
      return storiesArrays.flat()
    },
    enabled: !!projects && projects.length > 0,
  })

  if (allStories) {
    storiesInProgress = allStories.filter(s => s.status === 'in-progress').length
    storiesCompleted = allStories.filter(s => s.status === 'done').length
  }

  const recentProjects = projects?.slice(0, 3) || []

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gradient-primary">
                Welcome back, {user?.firstName || 'User'}! 
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Here's an overview of your projects and recent activity.
              </p>
            </div>
            <div className="glass p-4 rounded-xl animate-scale-in">
              <div className="text-sm text-muted-foreground">Today</div>
              <div className="text-2xl font-bold">
                {new Date().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="card-premium animate-slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <Link href="/projects/new">
                  <Button size="sm" className="w-full justify-start bg-white/20 hover:bg-white/30 text-white border-white/20">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </Link>
                <Link href="/projects">
                  <Button variant="outline" size="sm" className="w-full justify-start border-white/20 text-white hover:bg-white/10">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Browse Projects
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Stats Cards */}
          <Card className="card-elevated animate-slide-up" style={{animationDelay: '100ms'}}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <Target className="h-4 w-4 mr-2 text-primary" />
                  Active Projects
                </CardDescription>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-4 w-4 text-primary" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-primary">
                {projectsLoading ? '-' : activeProjects}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="card-elevated animate-slide-up" style={{animationDelay: '200ms'}}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <Activity className="h-4 w-4 mr-2 text-info" />
                  In Progress
                </CardDescription>
                <div className="p-2 bg-info/10 rounded-lg">
                  <Activity className="h-4 w-4 text-info" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-info">
                {storiesInProgress}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="card-elevated animate-slide-up" style={{animationDelay: '300ms'}}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2 text-success" />
                  Completed
                </CardDescription>
                <div className="p-2 bg-success/10 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-success" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-success">
                {storiesCompleted}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Projects and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="card-elevated animate-slide-up" style={{animationDelay: '400ms'}}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Recent Projects</CardTitle>
                  <CardDescription className="mt-1">
                    Your most recently accessed projects
                  </CardDescription>
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                    <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              ) : recentProjects.length > 0 ? (
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
                    </div>
                  ))}
                  <Link href="/projects">
                    <Button variant="outline" className="w-full mt-4 hover:bg-primary hover:text-primary-foreground transition-colors">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      View All Projects
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-muted/20 rounded-full w-fit mx-auto mb-4">
                    <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-semibold mb-2">No projects yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Create your first project to get started with agile development</p>
                  <Link href="/projects/new">
                    <Button className="shadow-soft">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="card-elevated animate-slide-up" style={{animationDelay: '500ms'}}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Team Velocity</CardTitle>
                  <CardDescription className="mt-1">
                    Your team's performance overview
                  </CardDescription>
                </div>
                <div className="p-2 bg-success/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sprint Velocity</span>
                    <span className="text-2xl font-bold text-success">32 pts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-success to-success/80 h-2 rounded-full transition-all duration-500" style={{width: '75%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">75% of capacity</div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="text-2xl font-bold text-info">87%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-info to-info/80 h-2 rounded-full transition-all duration-500" style={{width: '87%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">Above team average</div>
                </div>
                
                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground transition-colors">
                    <Activity className="h-4 w-4 mr-2" />
                    View Detailed Analytics
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}