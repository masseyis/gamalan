'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { projectsApi } from '@/lib/api/projects'
import { useToast } from '@/hooks/use-toast'
import { Project } from '@/lib/types/project'

interface ProjectSettingsForm {
  name: string
  description: string
}

export default function ProjectSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string
  
  const [form, setForm] = useState<ProjectSettingsForm>({
    name: '',
    description: ''
  })

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description || ''
      })
    }
  }, [project])

  const updateProjectMutation = useMutation({
    mutationFn: () => projectsApi.updateProject(projectId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      toast({
        title: 'Project updated',
        description: 'Your project settings have been saved successfully.'
      })
    },
    onError: (error) => {
      toast({
        title: 'Failed to update project',
        description: 'Please check your input and try again.',
        variant: 'destructive'
      })
      console.error('Update project error:', error)
    }
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({
        title: 'Project deleted',
        description: 'The project has been permanently deleted.'
      })
      router.push('/projects')
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete project',
        description: 'Unable to delete the project. Please try again.',
        variant: 'destructive'
      })
      console.error('Delete project error:', error)
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

    updateProjectMutation.mutate()
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`)) {
      deleteProjectMutation.mutate()
    }
  }

  const handleInputChange = (field: keyof ProjectSettingsForm, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Project Settings</h1>
            <p className="text-muted-foreground mt-2">Loading project settings...</p>
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
            <h1 className="text-3xl font-bold">Project Settings</h1>
            <p className="text-muted-foreground mt-2">Project not found or failed to load</p>
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
          <h1 className="text-3xl font-bold">Project Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage settings for {project.name}
          </p>
        </div>

        <div className="max-w-2xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Update your project's basic information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter project name"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={updateProjectMutation.isPending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your project's goals and scope..."
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={updateProjectMutation.isPending}
                    rows={4}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={updateProjectMutation.isPending || !form.name.trim()}
                    className="min-w-32"
                  >
                    {updateProjectMutation.isPending ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Delete Project</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this project and all associated data. This action cannot be undone.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteProjectMutation.isPending}
                  >
                    {deleteProjectMutation.isPending ? (
                      'Deleting...'
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Project
                      </>
                    )}
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