'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Users, TrendingUp, Calendar, Settings, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { teamsApi } from '@/lib/api/teams'
import { usePermissions, useRoles } from '@/components/providers/UserContextProvider'
import { ManagerOnly } from '@/components/guards/RoleGuard'

export default function TeamsPage() {
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')

  const { canManageTeam } = usePermissions()
  const { user, getRoleDisplayName } = useRoles()

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getTeams(),
  })

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return

    try {
      await teamsApi.createTeam({
        name: teamName,
        description: teamDescription || undefined,
        organizationId: 'org-1', // TODO: Get from user context when available
      })
      setCreateTeamOpen(false)
      setTeamName('')
      setTeamDescription('')
      // Query will refetch automatically
    } catch (error) {
      console.error('Failed to create team:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-muted-foreground mt-2">Loading teams...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground mt-2">
                Manage development teams and their velocity tracking
              </p>
              {user && (
                <div className="mt-2">
                  <span className="text-sm text-gray-600">
                    Viewing as: <Badge variant="outline">{getRoleDisplayName()}</Badge>
                  </span>
                </div>
              )}
            </div>

            <ManagerOnly fallback={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Team
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only Product Owners and Managing Contributors can create teams</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }>
              <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="create-team-btn">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="create-team-dialog">
                  <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>
                      Create a new development team with velocity tracking and member management.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="team-name">Team Name</Label>
                      <Input
                        id="team-name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g., Frontend Squad, Backend Core Team"
                        data-testid="team-name-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="team-description">Description (Optional)</Label>
                      <Input
                        id="team-description"
                        value={teamDescription}
                        onChange={(e) => setTeamDescription(e.target.value)}
                        placeholder="Brief description of team&apos;s focus or responsibilities"
                        data-testid="team-description-input"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateTeamOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTeam}
                      disabled={!teamName.trim()}
                      data-testid="confirm-create-team"
                    >
                      Create Team
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </ManagerOnly>
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first team to start organizing development work and tracking velocity.
            </p>
            {canManageTeam && (
              <Button onClick={() => setCreateTeamOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg" data-testid={`team-name-${team.id}`}>
                      {team.name}
                    </CardTitle>
                    <ManagerOnly fallback={null}>
                      <Link href={`/teams/${team.id}/settings`}>
                        <Button size="sm" variant="ghost">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </Link>
                    </ManagerOnly>
                  </div>
                  {team.description && (
                    <CardDescription>{team.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Team Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{team.members?.length || 0} members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-gray-500" />
                      <span>
                        {team.velocityHistory && team.velocityHistory.length > 0
                          ? Math.round(team.velocityHistory.reduce((sum, v) => sum + v, 0) / team.velocityHistory.length)
                          : 0
                        } pts/sprint
                      </span>
                    </div>
                  </div>

                  {/* Current Sprint Info */}
                  {team.activeSprintId ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Active Sprint</span>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        Sprint in progress
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">No active sprint</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/teams/${team.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        View Team
                      </Button>
                    </Link>
                    <Link href={`/teams/${team.id}/sprints`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        Sprints
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Team Management Guide */}
        {user && ['product_owner', 'managing_contributor'].includes(user.role) && (
          <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Users className="w-6 h-6 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 mb-2">Team Management Guide</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>Create teams</strong> to organize contributors by specialty or focus area</p>
                  <p>• <strong>Track velocity</strong> automatically based on completed story points per sprint</p>
                  <p>• <strong>Manage capacity</strong> by adjusting team member availability and sprint planning</p>
                  <p>• <strong>One active sprint</strong> per team - complete current sprint before starting next</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}