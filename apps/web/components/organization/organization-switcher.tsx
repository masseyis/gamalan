'use client'

import { useState } from 'react'
import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  Building2,
  Plus,
  Users,
  Settings,
  Check
} from 'lucide-react'
import { CreateOrganizationModal } from './create-organization-modal'

export function OrganizationSwitcher() {
  const { user } = useUser()
  const { organization } = useOrganization()
  const { userMemberships, setActive } = useOrganizationList()
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (!user) return null

  const handleOrganizationSwitch = (organizationId: string) => {
    setActive?.({ organization: organizationId })
  }

  const currentOrg = organization || userMemberships?.data?.[0]?.organization

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 justify-between min-w-[200px] bg-white/95 backdrop-blur-sm border-gray-200 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-6 w-6">
                <AvatarImage src={currentOrg?.imageUrl} alt={currentOrg?.name} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {currentOrg?.name?.slice(0, 2)?.toUpperCase() || 'OR'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-32">
                  {currentOrg?.name || 'Personal'}
                </span>
                {currentOrg && (
                  <span className="text-xs text-muted-foreground">
                    {currentOrg.membersCount} member{currentOrg.membersCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[280px] p-2">
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Organizations
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Personal Account */}
          <DropdownMenuItem
            onClick={() => setActive?.({ organization: null })}
            className="h-12 px-3 py-2 cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.imageUrl} alt={user.fullName || 'User'} />
                <AvatarFallback className="text-xs">
                  {user.firstName?.slice(0, 1)}{user.lastName?.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    Personal Account
                  </span>
                  {!organization && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {user.primaryEmailAddress?.emailAddress}
                </span>
              </div>
            </div>
          </DropdownMenuItem>

          {/* Organizations */}
          {userMemberships?.data?.map(({ organization: org }: { organization: any }) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleOrganizationSwitch(org.id)}
              className="h-12 px-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={org.imageUrl} alt={org.name} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {org.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {org.name}
                    </span>
                    {organization?.id === org.id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {org.membersCount} member{org.membersCount !== 1 ? 's' : ''}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5 h-auto"
                    >
                      {/* TODO: Get actual role from org membership */}
                      Admin
                    </Badge>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          {/* Create Organization */}
          <DropdownMenuItem
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-3 py-2 cursor-pointer text-primary"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Create Organization</span>
            </div>
          </DropdownMenuItem>

          {/* Organization Settings */}
          {currentOrg && (
            <DropdownMenuItem className="h-10 px-3 py-2 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Settings className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Organization Settings</span>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  )
}