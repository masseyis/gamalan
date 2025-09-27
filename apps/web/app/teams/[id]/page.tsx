'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ArrowLeft,
  Users,
  TrendingUp,
  Calendar,
  Settings,
  UserPlus,
  Play,
  Target,
  Clock,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { teamsApi } from '@/lib/api/teams'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { ManagerOnly, ContributorOnly } from '@/components/guards/RoleGuard'

export default function TeamDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const { canManageTeam } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    enabled: !!teamId,
  })

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => teamsApi.getTeamMembers(teamId),
    enabled: !!teamId,
  })

  // Mock sprint data for now until API is properly set up
  const activeSprint: any = null
  const completedSprints: any[] = []
  const sprintsLoading = false

  const isLoading = teamLoading || membersLoading || sprintsLoading

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Team Details</h1>
            <p className="text-muted-foreground mt-2">Loading team information...</p>
          </div>
        </div>
      </div>
    )
  }

  if (teamError || !team) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <Link href="/teams" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
            <h1 className="text-3xl font-bold">Team Details</h1>
            <p className="text-muted-foreground mt-2">Team not found or failed to load</p>
          </div>
        </div>
      </div>
    )
  }

  // activeSprint is already fetched above
  // completedSprints is mocked above
  const averageVelocity = completedSprints.length > 0
    ? Math.round(completedSprints.reduce((sum, s) => sum + (s.actualPoints || 0), 0) / completedSprints.length)
    : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <Link href="/teams" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold" data-testid={`team-name-${team.id}`}>
                {team.name}
              </h1>
              {team.description && (
                <p className="text-muted-foreground mt-2">{team.description}</p>
              )}
              {user && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">
                    Viewing as: <Badge variant="outline">{getRoleDisplayName()}</Badge>
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <ManagerOnly fallback={
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button disabled>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Only Product Owners and Managing Contributors can invite members</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              }>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </ManagerOnly>

              <ManagerOnly fallback={null}>
                <Link href={`/teams/${teamId}/settings`}>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </Link>
              </ManagerOnly>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Sprint */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Current Sprint</CardTitle>
                  {activeSprint ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">No Active Sprint</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {activeSprint ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{activeSprint.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(activeSprint.startDate).toLocaleDateString()} - {' '}
                          {new Date(activeSprint.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">
                          Capacity: {activeSprint.plannedPoints || 0} points
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm">
                          Progress: {activeSprint.actualPoints || 0}/{activeSprint.plannedPoints || 0} points
                        </span>
                      </div>
                    </div>

                    {activeSprint.plannedPoints && (
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-500 h-3 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, ((activeSprint.actualPoints || 0) / activeSprint.plannedPoints) * 100)}%`
                          }}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link href={`/teams/${teamId}/sprints/${activeSprint.id}`}>
                        <Button size="sm">View Sprint Details</Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Play className="h-8 w-8 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">No active sprint</h4>
                    <p className="text-gray-500 mb-4">
                      Start a new sprint to begin tracking team velocity and progress.
                    </p>
                    <ManagerOnly fallback={null}>
                      <Link href={`/teams/${teamId}/sprints/new`}>
                        <Button>
                          <Play className="h-4 w-4 mr-2" />
                          Start New Sprint
                        </Button>
                      </Link>
                    </ManagerOnly>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Team Members ({members.length})</CardTitle>
                  <ManagerOnly fallback={null}>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </ManagerOnly>
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No team members yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-700">
                              {(member as any).userName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{(member as any).userName || 'Unknown User'}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {member.role}
                              </Badge>
                              {member.specialty && (
                                <Badge variant="secondary" className="text-xs">
                                  {member.specialty}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Team Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Members</span>
                  <span className="font-medium">{members.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Average Velocity</span>
                  <span className="font-medium">{averageVelocity} pts/sprint</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Completed Sprints</span>
                  <span className="font-medium">{completedSprints.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-sm">
                    {new Date(team.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Sprints */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Sprints</CardTitle>
                  <Link href={`/teams/${teamId}/sprints`}>
                    <Button size="sm" variant="outline">View All</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {completedSprints.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No completed sprints yet</p>
                ) : (
                  <div className="space-y-3">
                    {completedSprints.slice(0, 3).map((sprint) => (
                      <div key={sprint.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium">{sprint.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {sprint.actualPoints || 0} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={`/teams/${teamId}/sprints`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Manage Sprints
                  </Button>
                </Link>
                <ManagerOnly fallback={null}>
                  <Link href={`/teams/${teamId}/settings`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Team Settings
                    </Button>
                  </Link>
                </ManagerOnly>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}