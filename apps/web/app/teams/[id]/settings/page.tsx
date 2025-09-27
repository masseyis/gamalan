'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { ArrowLeft, Save, Trash2, AlertTriangle, Users } from 'lucide-react'
import Link from 'next/link'
import { teamsApi } from '@/lib/api/teams'
import { useToast } from '@/hooks/use-toast'
import { ManagerOnly } from '@/components/guards/RoleGuard'

export default function TeamSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamDescription, setTeamDescription] = useState('')

  const { data: team, isLoading } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => teamsApi.getTeam(teamId),
    enabled: !!teamId,
  })

  // Update form state when team data loads
  useEffect(() => {
    if (team && !teamName && !teamDescription) {
      setTeamName(team.name)
      setTeamDescription(team.description || '')
    }
  }, [team, teamName, teamDescription])

  const { data: members = [] } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => teamsApi.getTeamMembers(teamId),
    enabled: !!teamId,
  })

  const updateTeamMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      teamsApi.updateTeam(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] })
      toast({
        title: "Team updated",
        description: "Team settings have been saved successfully",
      })
    },
    onError: (error) => {
      toast({
        title: "Failed to update team",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const deleteTeamMutation = useMutation({
    mutationFn: () => teamsApi.deleteTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      toast({
        title: "Team deleted",
        description: "Team has been permanently deleted",
      })
      router.push('/teams')
    },
    onError: (error) => {
      toast({
        title: "Failed to delete team",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    },
  })

  const handleUpdateTeam = () => {
    if (!teamName.trim()) {
      toast({
        title: "Validation error",
        description: "Team name is required",
        variant: "destructive",
      })
      return
    }

    updateTeamMutation.mutate({
      name: teamName.trim(),
      description: teamDescription.trim() || undefined,
    })
  }

  const handleDeleteTeam = () => {
    deleteTeamMutation.mutate()
    setDeleteDialogOpen(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Team Settings</h1>
            <p className="text-muted-foreground mt-2">Loading team settings...</p>
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
            <Link href="/teams" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Link>
            <h1 className="text-3xl font-bold">Team Settings</h1>
            <p className="text-muted-foreground mt-2">Team not found</p>
          </div>
        </div>
      </div>
    )
  }

  const hasMembers = members.length > 0
  const canDelete = !hasMembers // Can only delete if no members

  return (
    <ManagerOnly fallback={
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8">
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500 mb-4">
              Only Product Owners and Managing Contributors can manage team settings.
            </p>
            <Link href={`/teams/${teamId}`}>
              <Button>Back to Team</Button>
            </Link>
          </div>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 max-w-2xl">
          <div className="mb-8">
            <Link href={`/teams/${teamId}`} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {team.name}
            </Link>
            <h1 className="text-3xl font-bold">Team Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage team configuration and preferences
            </p>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Update team name and description
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    data-testid="team-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="team-description">Description</Label>
                  <Textarea
                    id="team-description"
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="Brief description of the team&apos;s focus or responsibilities"
                    rows={3}
                    data-testid="team-description-input"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleUpdateTeam}
                    disabled={updateTeamMutation.isPending || !teamName.trim()}
                    data-testid="save-team-settings"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateTeamMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Team Statistics</CardTitle>
                <CardDescription>
                  Current team metrics and information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Members:</span>
                    <span className="font-medium">{members.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium">
                      {new Date(team.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Velocity:</span>
                    <span className="font-medium">
                      {team.velocityHistory && team.velocityHistory.length > 0
                        ? Math.round(team.velocityHistory.reduce((sum, v) => sum + v, 0) / team.velocityHistory.length)
                        : 0
                      } pts/sprint
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium">
                      {team.activeSprintId ? 'Active Sprint' : 'No Active Sprint'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions that permanently affect this team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {hasMembers && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 text-orange-800 mb-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Cannot delete team</span>
                      </div>
                      <p className="text-sm text-orange-700">
                        This team has {members.length} member{members.length !== 1 ? 's' : ''}.
                        Remove all members before deleting the team.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-red-700">Delete Team</h4>
                      <p className="text-sm text-gray-600">
                        Permanently delete this team and all associated data
                      </p>
                    </div>

                    {canDelete ? (
                      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="destructive" data-testid="delete-team-btn">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Team
                          </Button>
                        </DialogTrigger>
                        <DialogContent data-testid="delete-team-dialog">
                          <DialogHeader>
                            <DialogTitle>Delete Team</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete &quot;{team.name}&quot;?
                              This action cannot be undone and will permanently remove:
                              <ul className="list-disc list-inside mt-2 text-sm">
                                <li>Team configuration and settings</li>
                                <li>Sprint history and velocity data</li>
                                <li>Team membership records</li>
                              </ul>
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleDeleteTeam}
                              disabled={deleteTeamMutation.isPending}
                              data-testid="confirm-delete-team"
                            >
                              {deleteTeamMutation.isPending ? 'Deleting...' : 'Delete Team'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="destructive" disabled>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Team
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remove all team members before deleting</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ManagerOnly>
  )
}