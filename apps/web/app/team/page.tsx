'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Settings, Mail, Calendar } from 'lucide-react'

const mockTeamMembers = [
  {
    id: '1',
    name: 'Demo User',
    email: 'demo@salunga.com',
    role: 'Product Owner',
    avatar: 'DU',
    status: 'active',
    joinedAt: '2025-08-01'
  },
  {
    id: '2',
    name: 'AI Assistant',
    email: 'ai@salunga.com',
    role: 'AI Assistant',
    avatar: 'AI',
    status: 'active',
    joinedAt: '2025-08-01'
  }
]

export default function TeamPage() {
  return (
    <div className="bg-gradient-soft">
      <div className="container mx-auto py-8">
        <div className="mb-8 flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-4xl font-bold text-gradient-primary">Team</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your team members and their roles
            </p>
          </div>
          <Button className="shadow-soft hover:shadow-elevated transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Stats */}
          <div className="lg:col-span-1">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Members</span>
                  <span className="font-semibold">{mockTeamMembers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-semibold text-green-600">
                    {mockTeamMembers.filter(m => m.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Roles</span>
                  <span className="font-semibold">2</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Members List */}
          <div className="lg:col-span-2">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage roles and permissions for your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTeamMembers.map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold">{member.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{member.role}</Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </div>
                        <Button variant="ghost" size="icon">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {mockTeamMembers.length === 0 && (
                  <div className="text-center py-8">
                    <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                      <Users className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No team members yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Invite your first team member to get started
                    </p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}