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
  Plus,
  Sparkles,
  Command,
  Zap
} from 'lucide-react'

import { useClerk, useUser, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useUserContext } from '@/components/providers/UserContextProvider'
import { OrganizationSwitcher } from '@/components/organization/organization-switcher'

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

  const resolvedName =
    clerkUser?.fullName ||
    clerkUser?.firstName ||
    resolvedEmail.split('@')[0] ||
    'User'

  const initials = resolvedName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
    <NavigationContent
      pathname={pathname}
      isSignedIn={isSignedIn}
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

function NavigationContent({ pathname, isSignedIn, user, signOut, loading }: NavigationContentProps) {
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

  const displayName = user.name || 'User'
  const displayEmail = user.email || 'user@example.com'

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
            {!loading && (
              <SignedIn>
                <OrganizationSwitcher />
              </SignedIn>
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
                    {displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {displayEmail}
                  </div>
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
