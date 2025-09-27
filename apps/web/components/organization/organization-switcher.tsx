'use client'

import { useState } from 'react'
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
  return <ClerkOrganizationSwitcher />
}

function MockOrganizationSwitcher() {
  const mockUser = {
    firstName: 'Test',
    lastName: 'User',
    fullName: 'Test User',
    primaryEmailAddress: { emailAddress: 'test@example.com' },
    imageUrl: null
  }
  const mockOrg = {
    id: 'mock-org',
    name: 'Test Organization',
    membersCount: 5,
    imageUrl: null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 justify-between min-w-[200px] bg-white/95 backdrop-blur-sm border-gray-200 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                TO
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium truncate max-w-32">
                {mockOrg.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {mockOrg.membersCount} members
              </span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-2">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          Organizations (Test Mode)
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ClerkOrganizationSwitcher() {
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Dynamic import to avoid SSR issues
  const [ClerkHooks, setClerkHooks] = useState<{
    useUser: () => any,
    useOrganization: () => any,
    useOrganizationList: () => any
  } | null>(null)

  // Load Clerk hooks dynamically
  useState(() => {
    import('@clerk/nextjs').then((clerk) => {
      setClerkHooks({
        useUser: clerk.useUser,
        useOrganization: clerk.useOrganization,
        useOrganizationList: clerk.useOrganizationList
      })
    }).catch(() => {
      // Fallback if Clerk is not available
      console.warn('Clerk not available')
    })
  })

  if (!ClerkHooks) {
    return (
      <Button variant="outline" disabled className="h-10 min-w-[200px]">
        Loading...
      </Button>
    )
  }

  return <ClerkOrganizationSwitcherContent showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} />
}

function ClerkOrganizationSwitcherContent({ showCreateModal, setShowCreateModal }: { showCreateModal: boolean, setShowCreateModal: (show: boolean) => void }) {
  // This needs to be fixed - we need to properly handle the dynamic imports
  // For now, return a placeholder
  return (
    <Button variant="outline" className="h-10 min-w-[200px]">
      Organizations
    </Button>
  )
}