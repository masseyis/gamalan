'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
// import Image from 'next/image' - using regular img for SVG logos
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Settings,
  Bell,
  Search,
  Plus,
  Sparkles,
  Command,
  Zap
} from 'lucide-react'

// Conditional imports for Clerk - only import when not in test mode
let useUser: any = () => ({ user: null, isSignedIn: false, isLoaded: true })
let useClerk: any = () => ({ signOut: () => {} })
let OrganizationSwitcher: any = () => null

// Only import Clerk in non-test environments to avoid validation errors
if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH !== 'true') {
  try {
    const clerkNextjs = require('@clerk/nextjs')
    useUser = clerkNextjs.useUser
    useClerk = clerkNextjs.useClerk

    const orgSwitcher = require('@/components/organization/organization-switcher')
    OrganizationSwitcher = orgSwitcher.OrganizationSwitcher
  } catch (error) {
    console.warn('Clerk not available, using mock authentication')
  }
}

function ClerkAuthWrapper({ children }: { children: (authData: any) => React.ReactNode }) {
  const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

  // Always call hooks at the top level, but use conditional logic after
  const { user, isSignedIn, isLoaded } = useUser()
  const { signOut } = useClerk()

  // In test mode, return mock user data
  if (isTestMode) {
    const mockUser = {
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }]
    }
    return children({ isSignedIn: true, user: mockUser, signOut: () => {}, loading: false })
  }

  try {
    // Wait for Clerk to load
    if (!isLoaded) {
      return children({ isSignedIn: false, user: null, signOut: () => {}, loading: true })
    }

    return children({ isSignedIn, user, signOut, loading: false })
  } catch (error) {
    // Fallback for when Clerk is not available
    return children({ isSignedIn: false, user: null, signOut: () => {}, loading: false })
  }
}

export function Navigation() {
  const pathname = usePathname()

  return (
    <ClerkAuthWrapper>
      {({ isSignedIn, user, signOut, loading }) => (
        <NavigationContent 
          pathname={pathname}
          isSignedIn={isSignedIn}
          user={user}
          signOut={signOut}
          loading={loading}
        />
      )}
    </ClerkAuthWrapper>
  )
}

function NavigationContent({ pathname, isSignedIn, user, signOut, loading }: any) {
  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: pathname === '/dashboard'
    },
    {
      name: 'Projects',
      href: '/projects',
      icon: FolderOpen,
      current: pathname.startsWith('/projects')
    },
    {
      name: 'Team',
      href: '/team',
      icon: Users,
      current: pathname === '/team'
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: Settings,
      current: pathname === '/reports'
    },
    {
      name: 'Assistant',
      href: '/assistant',
      icon: Sparkles,
      current: pathname === '/assistant',
      isPrimary: true
    }
  ]

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || 'U'

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Logo + Organization Switcher */}
          <div className="flex items-center gap-6">
            <Link href="/assistant" className="flex items-center gap-3 group" prefetch={false} data-testid="battra-logo">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:glow-yellow transition-all duration-200">
                <Zap className="text-primary-foreground w-4 h-4" data-testid="zap-icon" />
              </div>
              <span className="text-xl font-bold text-primary">
                Battra AI
              </span>
            </Link>

            {/* Organization Switcher (only show when signed in) */}
            {isSignedIn && !loading && (
              <OrganizationSwitcher />
            )}
          </div>

          {/* Navigation Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href} prefetch={false}>
                  <Button
                    variant={item.current ? "default" : "ghost"}
                    className={`
                      gap-2 transition-all duration-200
                      ${item.current 
                        ? "bg-primary text-primary-foreground shadow-soft" 
                        : "hover:bg-primary/10 hover:text-primary"
                      }
                      ${item.isPrimary ? "font-semibold" : ""}
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                    {item.isPrimary && (
                      <div className="h-1.5 w-1.5 bg-primary rounded-full ml-1" />
                    )}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Assistant Trigger - replaces search */}
            <Button 
              variant="ghost" 
              className="hidden sm:flex hover:bg-primary/10 hover:text-primary gap-2 text-sm"
              onClick={() => {
                if (pathname !== '/assistant') {
                  window.location.href = '/assistant'
                } else {
                  document.querySelector('textarea')?.focus()
                }
              }}
            >
              <Command className="h-4 w-4" />
              <span>Ask AI</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary relative">
              <Bell className="h-4 w-4" />
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                <div className="h-1.5 w-1.5 bg-white rounded-full"></div>
              </div>
            </Button>

            {/* Quick create */}
            <Button size="sm" className="gap-2 shadow-soft hover:shadow-elevated transition-all duration-200">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>

            {/* User Avatar */}
            {isSignedIn ? (
              <div className="flex items-center gap-3 pl-3 border-l border-border/50">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium text-foreground">
                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user?.emailAddresses?.[0]?.emailAddress || 'user@example.com'}
                  </div>
                </div>
                <Avatar 
                  className="h-8 w-8 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer"
                  onClick={() => signOut()}
                  title="Click to sign out"
                >
                  <AvatarFallback className="bg-gradient-primary text-white text-sm font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/sign-in" prefetch={false}>
                  <Button size="sm">Sign In</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}