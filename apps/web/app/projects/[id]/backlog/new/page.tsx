'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import Link from 'next/link'
import { backlogApi } from '@/lib/api/backlog'
import { projectsApi } from '@/lib/api/projects'
import { useToast } from '@/hooks/use-toast'
// Story priority type since it's not in the main types
type StoryPriority = 'low' | 'medium' | 'high' | 'critical'

interface CreateStoryForm {
  title: string
  description: string
  priority: StoryPriority
  storyPoints: number | null
  acceptanceCriteria: Array<{
    given: string
    when: string
    then: string
  }>
}

export default function NewStoryPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string

  const [form, setForm] = useState<CreateStoryForm>({
    title: '',
    description: '',
    priority: 'medium',
    storyPoints: null,
    acceptanceCriteria: [{ given: '', when: '', then: '' }],
  })

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const createStoryMutation = useMutation({
    mutationFn: () =>
      backlogApi.createStory(projectId, {
        projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        // Note: priority and storyPoints are not part of CreateStoryRequest type
      }),
    onSuccess: (story) => {
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] })
      toast({
        title: 'Story created',
        description: `${story.title} has been created successfully.`,
      })
      router.push(`/projects/${projectId}/backlog`)
    },
    onError: (error) => {
      toast({
        title: 'Failed to create story',
        description: 'Please check your input and try again.',
        variant: 'destructive',
      })
      console.error('Create story error:', error)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      toast({
        title: 'Story title required',
        description: 'Please enter a title for your story.',
        variant: 'destructive',
      })
      return
    }

    createStoryMutation.mutate()
  }

  const handleInputChange = (
    field: keyof Omit<CreateStoryForm, 'acceptanceCriteria'>,
    value: any
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const addAcceptanceCriterion = () => {
    setForm((prev) => ({
      ...prev,
      acceptanceCriteria: [...prev.acceptanceCriteria, { given: '', when: '', then: '' }],
    }))
  }

  const removeAcceptanceCriterion = (index: number) => {
    setForm((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index),
    }))
  }

  const updateAcceptanceCriterion = (
    index: number,
    field: 'given' | 'when' | 'then',
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map((ac, i) =>
        i === index ? { ...ac, [field]: value } : ac
      ),
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}/backlog`}
            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Backlog
          </Link>
          <h1 className="text-3xl font-bold">Create New Story</h1>
          <p className="text-muted-foreground mt-2">
            Add a new user story to {project?.name || 'your project'}
          </p>
        </div>

        <div className="max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Story Details</CardTitle>
                <CardDescription>
                  Provide the essential information about this user story
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="As a user, I want..."
                    value={form.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    disabled={createStoryMutation.isPending}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Write a clear, concise story title that describes the user need
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide additional context, background, or detailed requirements..."
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    disabled={createStoryMutation.isPending}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(value) =>
                        handleInputChange('priority', value as StoryPriority)
                      }
                      disabled={createStoryMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storyPoints">Story Points</Label>
                    <Select
                      value={form.storyPoints?.toString() || ''}
                      onValueChange={(value) =>
                        handleInputChange('storyPoints', value ? parseInt(value) : null)
                      }
                      disabled={createStoryMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not estimated" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="8">8</SelectItem>
                        <SelectItem value="13">13</SelectItem>
                        <SelectItem value="21">21</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Acceptance Criteria */}
            <Card>
              <CardHeader>
                <CardTitle>Acceptance Criteria</CardTitle>
                <CardDescription>
                  Define what needs to be true for this story to be considered complete
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.acceptanceCriteria.map((ac, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Criterion {index + 1}</h4>
                      {form.acceptanceCriteria.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAcceptanceCriterion(index)}
                          disabled={createStoryMutation.isPending}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Given</Label>
                        <Input
                          placeholder="Given that..."
                          value={ac.given}
                          onChange={(e) =>
                            updateAcceptanceCriterion(index, 'given', e.target.value)
                          }
                          disabled={createStoryMutation.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>When</Label>
                        <Input
                          placeholder="When I..."
                          value={ac.when}
                          onChange={(e) => updateAcceptanceCriterion(index, 'when', e.target.value)}
                          disabled={createStoryMutation.isPending}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Then</Label>
                        <Input
                          placeholder="Then I should..."
                          value={ac.then}
                          onChange={(e) => updateAcceptanceCriterion(index, 'then', e.target.value)}
                          disabled={createStoryMutation.isPending}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addAcceptanceCriterion}
                  disabled={createStoryMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Acceptance Criterion
                </Button>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={createStoryMutation.isPending || !form.title.trim()}
                className="min-w-32"
              >
                {createStoryMutation.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Story
                  </>
                )}
              </Button>
              <Link href={`/projects/${projectId}/backlog`}>
                <Button type="button" variant="outline" disabled={createStoryMutation.isPending}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
