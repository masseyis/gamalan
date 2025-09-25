'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, FolderOpen, Settings, Users, Sparkles, TrendingUp, Activity, Calendar } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { useApiClient } from '@/lib/api/client'
import { useEffect, useState } from 'react'
import { useConditionalAuth } from '@/app/auth-provider-wrapper'
import { useRoles } from '@/components/providers/UserContextProvider'
import { UserGuide } from '@/components/ui/user-guide'

export default function ProjectsPage() {
  const { isLoaded } = useConditionalAuth()
  const { setupClients } = useApiClient()
  const { user } = useRoles()

  // Setup authentication for API clients
  useEffect(() => {
    if (isLoaded) {
      setupClients()
    }
  }, [setupClients, isLoaded])

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getProjects,
    enabled: isLoaded, // Only run query after Clerk is loaded
  })

  // Show loading until Clerk is ready
  if (!isLoaded) {
    return (
      <div className="bg-gradient-soft">
        <div className="container mx-auto py-8">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-gradient-primary">Projects</h1>
            <p className="text-muted-foreground mt-2 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-soft">
        <div className="container mx-auto py-8">
          <div className="mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-gradient-primary">Projects</h1>
            <p className="text-muted-foreground mt-2 text-lg">Loading your projects...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="card-elevated animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded-lg w-3/4"></div>
                  <div className="h-4 bg-muted rounded-lg w-1/2 mt-2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded-lg w-full"></div>
                    <div className="h-4 bg-muted rounded-lg w-2/3"></div>
                    <div className="h-8 bg-muted rounded-lg w-full mt-4"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-soft">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-2">Error loading projects</p>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive">Failed to load projects. Please try again.</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">
              Projects
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your agile projects and track progress
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="shadow-soft hover:shadow-elevated transition-all duration-200">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <Card className="card-elevated animate-scale-in">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-6">
                  <FolderOpen className="h-16 w-16 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">No projects yet</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
                  Create your first project to start managing stories, tasks, and sprint workflows with Salunga
                </p>
                <Link href="/projects/new">
                  <Button className="shadow-soft hover:shadow-elevated transition-all duration-200">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Your First Project
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <Card 
                key={project.id} 
                className="group card-elevated hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up" 
                style={{animationDelay: `${index * 100}ms`}}
                data-testid="project-card"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                          <FolderOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                          Project
                        </div>
                      </div>
                      <CardTitle className="text-lg leading-tight mb-2 group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-sm">
                        {project.description || 'No description provided'}
                      </CardDescription>
                    </div>
                    <Link href={`/projects/${project.id}/settings`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/projects/${project.id}/backlog`}>
                      <Button variant="outline" size="sm" className="w-full justify-start hover:bg-primary hover:text-primary-foreground transition-colors">
                        <FolderOpen className="h-3 w-3 mr-2" />
                        Backlog
                      </Button>
                    </Link>
                    <Link href={`/projects/${project.id}/board`}>
                      <Button variant="outline" size="sm" className="w-full justify-start hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Activity className="h-3 w-3 mr-2" />
                        Board
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Active
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* User Guidance Section */}
        {user && (
          <div className="mt-12">
            <UserGuide userRole={user.role} context="projects" />
          </div>
        )}
      </div>
    </div>
  )
}

// Disable SSR for this page to avoid Clerk context issues
export const dynamic = 'force-dynamic'