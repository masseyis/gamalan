'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, FolderOpen, CheckCircle, Clock, TrendingUp, Target, Zap, Activity } from 'lucide-react'
import { useAuth, useUser } from '@clerk/nextjs'
import { UserGuide, RoleExplanation } from '@/components/ui/user-guide'
import { useRoles } from '@/components/providers/UserContextProvider'
import { Project } from '@/lib/types/project'

export default function DashboardPage({ projects, recentActivity, userPerformance }: { projects: Project[], recentActivity: any[], userPerformance: any[] }) {
  const { isLoaded } = useAuth()
  const { user } = useUser()
  const { user: contextUser } = useRoles()

  // Show loading until Clerk is ready
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

  // Calculate stats
  const activeProjects = projects?.length || 0
  let storiesInProgress = 0
  let storiesCompleted = 0

  const allStories = projects?.flatMap(p => p.stories || []) || []

  if (allStories) {
    storiesInProgress = allStories.filter(s => s.status === 'inprogress').length
    storiesCompleted = allStories.filter(s => s.status === 'accepted').length
  }

  const recentProjects = projects?.slice(0, 3) || []

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-primary glow-yellow">
                Welcome back, {user?.firstName || 'User'}!
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
                  year: 'numeric'
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
                  <Button variant="outline" size="sm" className="w-full justify-start border-border hover:bg-secondary">
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
              <CardTitle className="text-3xl font-bold text-primary">
                {activeProjects}
              </CardTitle>
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
              <CardTitle className="text-3xl font-bold text-primary">
                {storiesInProgress}
              </CardTitle>
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
              <CardTitle className="text-3xl font-bold text-accent">
                {storiesCompleted}
              </CardTitle>
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

          <Card className="battra-gradient border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-foreground">Team Velocity</CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    Your team&apos;s performance overview
                  </CardDescription>
                </div>
                <div className="p-2 bg-accent/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Sprint Velocity</span>
                    <span className="text-2xl font-bold text-primary">32 pts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500 glow-yellow" style={{width: '75%'}}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">75% of capacity</div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Completion Rate</span>
                    <span className="text-2xl font-bold text-accent">87%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-gradient-to-r from-accent to-accent/80 h-2 rounded-full transition-all duration-500 glow-red" style={{width: '87%'}}></div>
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

        {/* User Guidance Section */}
        {contextUser && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <RoleExplanation role={contextUser.role} />
            <UserGuide userRole={contextUser.role} context="dashboard" />
          </div>
        )}
      </div>
    </div>
  )
}
