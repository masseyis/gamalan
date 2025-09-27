'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { useApiClient } from '@/lib/api/client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@clerk/nextjs'

interface CreateProjectForm {
  name: string
  description: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { isLoaded } = useAuth()
  const { setupClients } = useApiClient()

  const [form, setForm] = useState<CreateProjectForm>({
    name: '',
    description: ''
  })

  // Setup authentication for API clients
  useEffect(() => {
    if (isLoaded) {
      setupClients()
    }
  }, [setupClients, isLoaded])

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({
        title: 'Project created',
        description: `${project.name} has been created successfully.`
      })
      router.push(`/projects/${project.id}/backlog`)
    },
    onError: (error) => {
      toast({
        title: 'Failed to create project',
        description: 'Please check your input and try again.',
        variant: 'destructive'
      })
      console.error('Create project error:', error)
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      toast({
        title: 'Project name required',
        description: 'Please enter a name for your project.',
        variant: 'destructive'
      })
      return
    }

    createProjectMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim()
    })
  }

  const handleInputChange = (field: keyof CreateProjectForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Show loading until auth is ready
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Create New Project</h1>
            <p className="text-muted-foreground mt-2">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href="/projects" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
          <h1 className="text-3xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground mt-2">
            Set up a new agile project to start managing stories and sprints
          </p>
        </div>

        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Provide basic information about your new project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter project name"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={createProjectMutation.isPending}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Choose a clear, descriptive name for your project
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe your project's goals and scope..."
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={createProjectMutation.isPending}
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional: Provide context about what this project aims to achieve
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={createProjectMutation.isPending || !form.name.trim()}
                    className="min-w-32"
                  >
                    {createProjectMutation.isPending ? (
                      'Creating...'
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Project
                      </>
                    )}
                  </Button>
                  <Link href="/projects">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={createProjectMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}