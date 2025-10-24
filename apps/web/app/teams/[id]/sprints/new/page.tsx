'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, Target, AlertTriangle, Save } from 'lucide-react'
import Link from 'next/link'
import { teamsApi, sprintsApi, sprintHelpers } from '@/lib/api/teams'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { ManagerOnly } from '@/components/guards/RoleGuard'
import { useToast } from '@/hooks/use-toast'
import { SPRINT_CONSTRAINTS } from '@/lib/types/team'

export default function NewSprintPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, getRoleDisplayName } = useRoles()

  const [sprintName, setSprintName] = useState('')
  const [sprintGoal, setSprintGoal] = useState('')
  const [capacityPoints, setCapacityPoints] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    enabled: !!teamId,
  })

  const { data: activeSprint } = useQuery({
    queryKey: ['active-sprint', teamId],
    queryFn: () => sprintsApi.getActiveSprint(teamId),
    enabled: !!teamId,
  })

  const createSprintMutation = useMutation({
    mutationFn: sprintsApi.createSprint,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['team-sprints', teamId] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      toast({
        title: 'Sprint created',
        description: 'Sprint has been created successfully',
      })
      router.push(`/teams/${teamId}/sprints/${response.sprintId}`)
    },
    onError: (error) => {
      toast({
        title: 'Failed to create sprint',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const handleCreateSprint = () => {
    // Validation
    if (!sprintName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Sprint name is required',
        variant: 'destructive',
      })
      return
    }

    if (!sprintGoal.trim()) {
      toast({
        title: 'Validation error',
        description: 'Sprint goal is required',
        variant: 'destructive',
      })
      return
    }

    if (!startDate || !endDate) {
      toast({
        title: 'Validation error',
        description: 'Start and end dates are required',
        variant: 'destructive',
      })
      return
    }

    if (!capacityPoints || isNaN(Number(capacityPoints)) || Number(capacityPoints) <= 0) {
      toast({
        title: 'Validation error',
        description: 'Capacity points must be a positive number',
        variant: 'destructive',
      })
      return
    }

    // Validate dates
    const dateValidation = sprintHelpers.validateSprintDates(startDate, endDate)
    if (!dateValidation.isValid) {
      toast({
        title: 'Date validation error',
        description: dateValidation.errors[0],
        variant: 'destructive',
      })
      return
    }

    createSprintMutation.mutate({
      teamId,
      name: sprintName.trim(),
      goal: sprintGoal.trim(),
      capacityPoints: Number(capacityPoints),
      startDate,
      endDate,
    })
  }

  // Calculate suggested capacity based on team velocity
  const getSuggestedCapacity = () => {
    if (!team?.velocityHistory || team.velocityHistory.length === 0) {
      return 'No velocity history available'
    }

    const avgVelocity = Math.round(
      team.velocityHistory.reduce((sum, v) => sum + v, 0) / team.velocityHistory.length
    )

    return `${avgVelocity} points (based on team average)`
  }

  // Calculate sprint duration
  const getSprintDuration = () => {
    if (!startDate || !endDate) return null

    const start = new Date(startDate)
    const end = new Date(endDate)
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    return duration
  }

  if (teamLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">New Sprint</h1>
            <p className="text-muted-foreground mt-2">Loading team information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link
              href="/teams"
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
            <h1 className="text-3xl font-bold">New Sprint</h1>
            <p className="text-muted-foreground mt-2">Team not found</p>
          </div>
        </div>
      </div>
    )
  }

  const sprintDuration = getSprintDuration()

  return (
    <ManagerOnly
      fallback={
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-8">
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
              <p className="text-gray-500 mb-4">
                Only Product Owners and Managing Contributors can create sprints.
              </p>
              <Link href={`/teams/${teamId}/sprints`}>
                <Button>Back to Sprints</Button>
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 max-w-2xl">
          <div className="mb-8">
            <Link
              href={`/teams/${teamId}/sprints`}
              className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sprints
            </Link>
            <h1 className="text-3xl font-bold">Create New Sprint</h1>
            <p className="text-muted-foreground mt-2">
              Plan and configure a new sprint for {team.name}
            </p>
            {user && (
              <div className="mt-2">
                <span className="text-sm text-gray-600">
                  Creating as: <Badge variant="outline">{getRoleDisplayName()}</Badge>
                </span>
              </div>
            )}
          </div>

          {/* Active Sprint Warning */}
          {activeSprint && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Active Sprint Detected</span>
              </div>
              <p className="text-sm text-orange-700">
                Team already has an active sprint: &quot;{activeSprint.name}&quot;. Consider
                completing the current sprint before starting a new one.
              </p>
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Information</CardTitle>
                <CardDescription>Define the sprint goals and timeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="sprint-name">Sprint Name</Label>
                  <Input
                    id="sprint-name"
                    value={sprintName}
                    onChange={(e) => setSprintName(e.target.value)}
                    placeholder="e.g., Sprint 24, February Sprint, User Onboarding Sprint"
                    data-testid="sprint-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="sprint-goal">Sprint Goal</Label>
                  <Textarea
                    id="sprint-goal"
                    value={sprintGoal}
                    onChange={(e) => setSprintGoal(e.target.value)}
                    placeholder="Describe what the team aims to achieve in this sprint"
                    rows={3}
                    data-testid="sprint-goal-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Capacity Planning */}
            <Card>
              <CardHeader>
                <CardTitle>Capacity Planning</CardTitle>
                <CardDescription>Set the team&apos;s capacity for this sprint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="capacity-points">Capacity (Story Points)</Label>
                  <Input
                    id="capacity-points"
                    type="number"
                    value={capacityPoints}
                    onChange={(e) => setCapacityPoints(e.target.value)}
                    placeholder="20"
                    min="1"
                    data-testid="capacity-input"
                  />
                  <p className="text-sm text-gray-600 mt-1">Suggested: {getSuggestedCapacity()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Sprint Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Sprint Timeline</CardTitle>
                <CardDescription>Define when the sprint starts and ends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="start-date-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="end-date-input"
                    />
                  </div>
                </div>

                {sprintDuration && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span>
                        Sprint Duration: {sprintDuration} day{sprintDuration !== 1 ? 's' : ''}
                      </span>
                      {sprintDuration > SPRINT_CONSTRAINTS.MAX_DURATION_DAYS && (
                        <Badge variant="destructive" className="ml-2">
                          Too Long
                        </Badge>
                      )}
                      {sprintDuration < SPRINT_CONSTRAINTS.MIN_DURATION_DAYS && (
                        <Badge variant="destructive" className="ml-2">
                          Too Short
                        </Badge>
                      )}
                    </div>
                    {(sprintDuration > SPRINT_CONSTRAINTS.MAX_DURATION_DAYS ||
                      sprintDuration < SPRINT_CONSTRAINTS.MIN_DURATION_DAYS) && (
                      <p className="text-xs text-gray-600 mt-1">
                        Recommended: {SPRINT_CONSTRAINTS.MIN_DURATION_DAYS}-
                        {SPRINT_CONSTRAINTS.MAX_DURATION_DAYS} days
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Link href={`/teams/${teamId}/sprints`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleCreateSprint}
                disabled={createSprintMutation.isPending}
                className="flex-1"
                data-testid="create-sprint-btn"
              >
                <Save className="h-4 w-4 mr-2" />
                {createSprintMutation.isPending ? 'Creating...' : 'Create Sprint'}
              </Button>
            </div>
          </div>

          {/* Sprint Planning Tips */}
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="w-6 h-6 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">Sprint Planning Tips</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    • <strong>Capacity:</strong> Consider team availability, holidays, and other
                    commitments
                  </p>
                  <p>
                    • <strong>Goal:</strong> Keep it specific and achievable - what value will be
                    delivered?
                  </p>
                  <p>
                    • <strong>Duration:</strong> 1-4 weeks is recommended, with 2 weeks being most
                    common
                  </p>
                  <p>
                    • <strong>Stories:</strong> Add and estimate stories after creating the sprint
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ManagerOnly>
  )
}
