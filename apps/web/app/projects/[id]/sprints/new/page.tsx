'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Users, AlertCircle, Loader2 } from 'lucide-react'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { backlogApi } from '@/lib/api/backlog'
import { sprintApi } from '@/lib/api/sprint'
import { projectsApi } from '@/lib/api/projects'
import { teamsApi } from '@/lib/api/teams'
import { useToast } from '@/hooks/use-toast'
import { Story } from '@/lib/types/story'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function NewSprintPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const projectId = params.id as string

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [selectedStories, setSelectedStories] = useState<string[]>([])

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.getProject(projectId),
    enabled: !!projectId,
  })

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', project?.teamId],
    queryFn: () => teamsApi.getTeam(project!.teamId!),
    enabled: !!project?.teamId,
  })

  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ['stories', projectId, 'ready'],
    queryFn: () => backlogApi.getStories(projectId, undefined, 'ready'),
    enabled: !!projectId,
  })

  const createSprintMutation = useMutation({
    mutationFn: (data: { name: string; goal: string; stories: string[] }) =>
      sprintApi.createSprint(projectId, data.name, data.goal, data.stories),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] })
      queryClient.invalidateQueries({ queryKey: ['stories', projectId] })
      toast({
        title: 'Sprint started',
        description: 'The new sprint has been started successfully.',
      })
      router.push(`/projects/${projectId}/board`)
    },
    onError: (error) => {
      let description = 'Unable to start a new sprint. Please try again.'

      if (isAxiosError(error)) {
        const apiError = (error.response?.data as { error?: { message?: string } } | undefined)
          ?.error?.message
        if (apiError) {
          const lowered = apiError.toLowerCase()
          if (lowered.includes('team already has an active sprint')) {
            description =
              'This team already has an active sprint. Complete or close it before starting a new one.'
          } else {
            description = apiError
          }
        }
      } else if (error instanceof Error && error.message) {
        description = error.message
      }

      toast({
        title: 'Failed to start sprint',
        description,
        variant: 'destructive',
      })
      console.error('Create sprint error:', error)
    },
  })

  const handleToggleStory = (storyId: string) => {
    setSelectedStories((prev) =>
      prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]
    )
  }

  const isLoading = projectLoading || storiesLoading
  const missingTeam = !project?.teamId

  const handleSubmit = () => {
    if (missingTeam) {
      toast({
        title: 'Assign a team before planning',
        description: 'Link this project to a delivery team in settings, then start a sprint.',
        variant: 'destructive',
      })
      return
    }
    createSprintMutation.mutate({ name, goal, stories: selectedStories })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}/backlog`}
            className="mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Backlog
          </Link>
          <h1 className="text-3xl font-bold">Start New Sprint</h1>
          <p className="mt-2 text-muted-foreground">Loading project context...</p>
        </div>
      </div>
    )
  }

  if (projectError || !project) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link
            href="/projects"
            className="mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
          <h1 className="text-3xl font-bold">Start New Sprint</h1>
          <p className="mt-2 text-muted-foreground">
            Project not found or failed to load. Please return to the backlog.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}/backlog`}
          className="mb-4 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Backlog
        </Link>
        <h1 className="text-3xl font-bold">Plan Sprint for {project.name}</h1>
        <p className="mt-2 text-muted-foreground">
          Select the ready stories you want this team to commit to.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge
            variant={team ? 'secondary' : 'outline'}
            className={
              team
                ? 'bg-primary/10 text-primary border-0'
                : 'border-dashed border-amber-400 text-amber-700'
            }
          >
            <span className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              {teamLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading team...
                </span>
              ) : team ? (
                <>
                  <span className="font-medium">Team</span>
                  <span>{team.name}</span>
                </>
              ) : (
                'No team assigned'
              )}
            </span>
          </Badge>
          {team && (
            <Link
              href={`/teams/${team.id}`}
              className="text-primary transition-colors hover:text-primary/80"
            >
              View team workspace
            </Link>
          )}
          {missingTeam && (
            <Link
              href={`/projects/${projectId}/settings`}
              className="text-primary transition-colors hover:text-primary/80"
            >
              Assign team
            </Link>
          )}
        </div>
      </div>

      {missingTeam && (
        <Alert className="mb-8 border-amber-200 bg-amber-50">
          <AlertTitle className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            Assign a team before starting a sprint
          </AlertTitle>
          <AlertDescription className="mt-2 text-amber-900/90">
            Sprint commitments are tracked per team. Link this project to a delivery team in
            settings, then return here to plan the sprint.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Sprint Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sprint-name">Sprint Name</Label>
                <Input
                  id="sprint-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sprint 1: The Foundation"
                />
              </div>
              <div>
                <Label htmlFor="sprint-goal">Sprint Goal</Label>
                <Textarea
                  id="sprint-goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Launch the MVP for user authentication and project creation."
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Ready Stories</CardTitle>
              <CardDescription>Select the stories to include in this sprint.</CardDescription>
            </CardHeader>
            <CardContent>
              {missingTeam && (
                <p className="mb-4 text-sm text-amber-700">
                  Assign a team to this project to enable sprint planning. Story selection is
                  disabled until then.
                </p>
              )}
              {storiesLoading ? (
                <p>Loading stories...</p>
              ) : stories.length === 0 ? (
                <p>No stories are ready for a sprint.</p>
              ) : (
                <ul className="space-y-2">
                  {stories.map((story) => (
                    <li key={story.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`story-${story.id}`}
                        checked={selectedStories.includes(story.id)}
                        onCheckedChange={() => handleToggleStory(story.id)}
                        disabled={missingTeam}
                      />
                      <label htmlFor={`story-${story.id}`} className="flex-1 cursor-pointer">
                        {story.title}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={createSprintMutation.isPending || missingTeam || selectedStories.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Start Sprint
        </Button>
      </div>
    </div>
  )
}
