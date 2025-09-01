'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
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
  Command
} from 'lucide-react'

function useUserSafe() {
  // For now, always return demo data to avoid React Hooks violations
  // In a real app, this would use React Context or a different state management approach
  return { user: { firstName: 'Demo', lastName: 'User' } }
}

export function Navigation() {
  const pathname = usePathname()
  const { user } = useUserSafe()
  
  const navigation = [
    {
      name: 'Assistant',
      href: '/assistant',
      icon: Sparkles,
      current: pathname === '/assistant',
      isPrimary: true
    },
    {
      name: 'Projects',
      href: '/projects',
      icon: FolderOpen,
      current: pathname.startsWith('/projects')
    },
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: pathname === '/dashboard'
    }
  ]

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`
    : 'DU'

  return (
    <nav className="glass border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/assistant" className="flex items-center gap-3 group">
            <div className="relative">
              <Image 
                src="/logo-icon.png" 
                alt="Salunga" 
                width={32} 
                height={32}
                className="transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-20 rounded-full transition-opacity"></div>
            </div>
            <span className="text-2xl font-bold text-gradient-primary">
              Salunga
            </span>
          </Link>

          {/* Navigation Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href}>
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
            <div className="flex items-center gap-3 pl-3 border-l border-border/50">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-foreground">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Demo Mode
                </div>
              </div>
              <Avatar className="h-8 w-8 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer">
                <AvatarFallback className="bg-gradient-primary text-white text-sm font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}