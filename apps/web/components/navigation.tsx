'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
// import Image from 'next/image' - using regular img for SVG logos
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  Bell,
  Plus,
  Sparkles,
  Zap,
  Kanban,
  Clock,
  ChevronDown,
  Building2,
  BarChart3,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'

import { useClerk, useUser, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useUserContext } from '@/components/providers/UserContextProvider'
import { OrganizationSwitcher } from '@/components/organization/organization-switcher'
import { formatUserDisplayName, getInitials } from '@/lib/utils/display-name'
import { teamsApi, sprintsApi } from '@/lib/api/teams'
import { projectsApi } from '@/lib/api/projects'

export function Navigation() {
  const pathname = usePathname()
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const { user: appUser, isLoading } = useUserContext()

  const loading = !isClerkLoaded || isLoading

  const resolvedEmail =
    appUser?.email ||
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    ''

  const resolvedName = formatUserDisplayName({
    name: clerkUser?.fullName || clerkUser?.firstName || null,
    email: resolvedEmail || null,
    role: appUser?.role ?? null,
    id: appUser?.id ?? clerkUser?.id ?? null,
  })

  const initials = getInitials(resolvedName)

  return (
    <NavigationContent
      pathname={pathname}
      isSignedIn={Boolean(isSignedIn)}
      user={{
        name: resolvedName,
        email: resolvedEmail,
        initials,
      }}
      signOut={() => signOut({ redirectUrl: '/sign-in' })}
      loading={loading}
    />
  )
}

interface NavigationContentProps {
  pathname: string
  isSignedIn: boolean
  user: {
    name: string
    email: string
    initials: string
  }
  signOut: () => void | Promise<void>
  loading: boolean
}

function NavigationContent({
  pathname,
  isSignedIn,
  user,
  signOut,
  loading,
}: NavigationContentProps) {
  // Extract project/team context from URL
  const projectMatch = pathname.match(/\/projects\/([^/]+)/)
  const teamMatch = pathname.match(/\/teams\/([^/]+)/)
  const currentProjectId = projectMatch?.[1]
  const currentTeamId = teamMatch?.[1]

  // Fetch user's teams to find active sprints
  const { data: userTeams, isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['user-teams'],
    queryFn: async () => {
      console.log('[Navigation] Fetching user teams')
      const result = await teamsApi.getTeams()
      console.log('[Navigation] User teams result:', result)
      return result
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus
  })

  // Log teams fetch errors
  if (teamsError) {
    console.error('[Navigation] Teams fetch error:', teamsError)
  }

  // Debug: Log raw teams data
  console.log('[Navigation Debug] Raw userTeams:', userTeams)

  // If teams have activeSprintId but no currentSprint, we need to fetch the sprint details
  // For now, let's use the first team with an activeSprintId and fetch its sprints
  const firstTeamWithActiveSprintId = userTeams?.find((team) => team.activeSprintId)

  // Fetch sprints for the team if it has an activeSprintId but no currentSprint
  const { data: teamSprints, isLoading: teamSprintsLoading } = useQuery({
    queryKey: ['team-sprints-for-nav', firstTeamWithActiveSprintId?.id],
    queryFn: async () => {
      if (!firstTeamWithActiveSprintId?.id) return []
      console.log('[Navigation] Fetching sprints for team with activeSprintId:', firstTeamWithActiveSprintId.id)
      const result = await sprintsApi.getTeamSprints(firstTeamWithActiveSprintId.id)
      console.log('[Navigation] Team sprints result:', result)
      return result
    },
    enabled: !!firstTeamWithActiveSprintId?.id && !firstTeamWithActiveSprintId?.currentSprint,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Fetch projects to find a project in this team (for URL construction)
  const { data: projects } = useQuery({
    queryKey: ['projects-for-team'],
    queryFn: async () => {
      console.log('[Navigation] Fetching projects for sprint link')
      const result = await projectsApi.getProjects()
      console.log('[Navigation] Projects result:', result)
      return result
    },
    enabled: !!firstTeamWithActiveSprintId?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Find a project that belongs to the team
  const projectInTeam = projects?.find((p) => p.teamId === firstTeamWithActiveSprintId?.id)

  // Find active sprint from fetched sprints or from team's currentSprint
  let activeSprint = null
  let activeTeam = null
  let effectiveTeamId = undefined
  let projectIdForLink = projectInTeam?.id || firstTeamWithActiveSprintId?.id // Fallback to teamId if no project

  if (firstTeamWithActiveSprintId?.currentSprint?.status === 'active') {
    // Team already has currentSprint populated
    activeTeam = firstTeamWithActiveSprintId
    activeSprint = firstTeamWithActiveSprintId.currentSprint
    effectiveTeamId = firstTeamWithActiveSprintId.id
  } else if (teamSprints && teamSprints.length > 0) {
    // Find active sprint from fetched sprints
    activeSprint = teamSprints.find((s) => s.status === 'active') || null
    if (activeSprint && firstTeamWithActiveSprintId) {
      activeTeam = firstTeamWithActiveSprintId
      effectiveTeamId = firstTeamWithActiveSprintId.id
    }
  }

  // Debug: Log sprint resolution
  console.log('[Navigation Debug] Sprint resolution:', {
    firstTeamWithActiveSprintId: firstTeamWithActiveSprintId ? {
      id: firstTeamWithActiveSprintId.id,
      name: firstTeamWithActiveSprintId.name,
      activeSprintId: firstTeamWithActiveSprintId.activeSprintId,
      hasCurrentSprint: !!firstTeamWithActiveSprintId.currentSprint,
    } : null,
    teamSprintsCount: teamSprints?.length ?? 0,
    activeSprint: activeSprint ? {
      id: activeSprint.id,
      name: activeSprint.name,
      status: activeSprint.status,
    } : null,
  })

  // Calculate days remaining for active sprint
  const daysRemaining = activeSprint
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeSprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : null

  // Check if currently on sprint task board
  const isOnSprintBoard = pathname.includes('/sprints/') && pathname.endsWith('/tasks')

  // Debug logging for sprint header button
  console.log('[Navigation Debug] Sprint Header Button Visibility:', {
    pathname,
    currentProjectId,
    currentTeamId,
    teamsLoading,
    teamSprintsLoading,
    userTeamsCount: userTeams?.length ?? 0,
    activeTeam: activeTeam ? { id: activeTeam.id, name: activeTeam.name } : null,
    effectiveTeamId,
    activeSprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name, status: activeSprint.status } : null,
    daysRemaining,
    isOnSprintBoard,
    shouldShowButton: (activeSprint && effectiveTeamId) || teamsLoading || teamSprintsLoading,
  })

  // Primary navigation (always visible)
  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: pathname === '/dashboard',
    },
    {
      name: 'Projects',
      href: '/projects',
      icon: FolderOpen,
      current: pathname.startsWith('/projects') && !isOnSprintBoard,
    },
    {
      name: 'Assistant',
      href: '/assistant',
      icon: Sparkles,
      current: pathname === '/assistant',
      isPrimary: true,
    },
  ]

  // Secondary navigation (in dropdown)
  const secondaryNavigation = [
    {
      name: 'Teams',
      href: '/teams',
      icon: Users,
      current: pathname.startsWith('/teams'),
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
      current: pathname === '/reports',
    },
  ]

  const displayName = user.name || 'User'
  const displayEmail = user.email || 'user@example.com'

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Logo */}
          <div className="flex items-center gap-4">
            <Link
              href="/assistant"
              className="flex items-center gap-3 group"
              prefetch={false}
              data-testid="battra-logo"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:glow-yellow transition-all duration-200">
                <Zap className="text-primary-foreground w-4 h-4" data-testid="zap-icon" />
              </div>
              <span className="text-xl font-bold text-primary">Battra AI</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href} prefetch={false}>
                  <Button
                    variant={item.current ? 'default' : 'ghost'}
                    className={`
                      gap-2 transition-all duration-200
                      ${
                        item.current
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'hover:bg-primary/10 hover:text-primary'
                      }
                      ${item.isPrimary ? 'font-semibold' : ''}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                    {item.isPrimary && <div className="h-1.5 w-1.5 bg-primary rounded-full ml-1" />}
                  </Button>
                </Link>
              )
            })}

            {/* Sprint Task Board (shows user's active sprint) */}
            {(activeSprint && effectiveTeamId) || teamsLoading || teamSprintsLoading ? (
              <>
                <div className="h-6 w-px bg-border/50 mx-1" />
                {activeSprint && effectiveTeamId ? (
                  <Link
                    href={`/projects/${projectIdForLink}/sprints/${activeSprint.id}/tasks`}
                    prefetch={false}
                  >
                    <Button
                      variant={isOnSprintBoard ? 'default' : 'ghost'}
                      size="sm"
                      className={`
                        gap-2 transition-all duration-200
                        ${
                          isOnSprintBoard
                            ? 'bg-primary text-primary-foreground shadow-soft'
                            : 'hover:bg-primary/10 hover:text-primary'
                        }
                      `}
                    >
                      <Kanban className="h-4 w-4" />
                      <span className="hidden xl:inline">{activeSprint.name}</span>
                      <span className="xl:hidden">Sprint</span>
                      {daysRemaining !== null && daysRemaining <= 7 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 px-1.5 py-0 text-xs font-normal"
                        >
                          <Clock className="h-3 w-3 mr-0.5" />
                          {daysRemaining}d
                        </Badge>
                      )}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="gap-2 opacity-50"
                  >
                    <Kanban className="h-4 w-4 animate-pulse" />
                    <span className="hidden xl:inline">Loading...</span>
                    <span className="xl:hidden">...</span>
                  </Button>
                )}
              </>
            ) : null}

            {/* More menu dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 hover:bg-primary/10 hover:text-primary"
                >
                  <Settings className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {secondaryNavigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link href={item.href} className="cursor-pointer">
                        <Icon className="h-4 w-4 mr-2" />
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organization
                </DropdownMenuLabel>
                <div className="px-2 py-2">
                  <SignedIn>
                    <OrganizationSwitcher />
                  </SignedIn>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10 hover:text-primary relative"
            >
              <Bell className="h-4 w-4" />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
              </div>
            </Button>

            {/* Quick create */}
            <Button
              size="sm"
              className="gap-2 shadow-soft hover:shadow-elevated transition-all duration-200"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>

            {/* User Avatar */}
            {isSignedIn ? (
              <div className="flex items-center gap-3 pl-3 border-l border-border/50">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium text-foreground">{displayName}</div>
                  <div className="text-xs text-muted-foreground">{displayEmail}</div>
                </div>
                <Avatar
                  className="h-8 w-8 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer"
                  onClick={() => signOut()}
                  title="Click to sign out"
                >
                  <AvatarFallback className="bg-gradient-primary text-white text-sm font-semibold">
                    {user.initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button size="sm">Sign In</Button>
                  </SignInButton>
                </SignedOut>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
