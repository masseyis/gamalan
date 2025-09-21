'use client'

import React from 'react'
import { useUserContext, usePermissions } from '../providers/UserContextProvider'
import { UserRole } from '@/lib/types'

interface RoleGuardProps {
  children: React.ReactNode

  // Role-based access
  allowedRoles?: UserRole[]
  forbiddenRoles?: UserRole[]

  // Permission-based access
  requiredPermissions?: string[]

  // Fallback content
  fallback?: React.ReactNode

  // Show loading state while checking permissions
  showLoading?: boolean

  // Custom permission check function
  customCheck?: (context: ReturnType<typeof useUserContext>) => boolean
}

export function RoleGuard({
  children,
  allowedRoles,
  forbiddenRoles,
  requiredPermissions,
  fallback = null,
  showLoading = true,
  customCheck
}: RoleGuardProps) {
  const userContext = useUserContext()
  const { hasPermission } = usePermissions()
  const { user, isLoading } = userContext

  // Show loading state while fetching user data
  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  // No user data available
  if (!user) {
    return <>{fallback}</>
  }

  // Custom permission check
  if (customCheck) {
    const hasAccess = customCheck(userContext)
    return hasAccess ? <>{children}</> : <>{fallback}</>
  }

  // Check forbidden roles first
  if (forbiddenRoles && forbiddenRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  // Check allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <>{fallback}</>
  }

  // Check required permissions
  if (requiredPermissions) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      hasPermission(permission)
    )
    if (!hasAllPermissions) {
      return <>{fallback}</>
    }
  }

  // All checks passed
  return <>{children}</>
}

// Specialized guards for common use cases

export function ContributorOnly({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      allowedRoles={['contributor', 'managing_contributor']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

export function ProductOwnerOnly({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      allowedRoles={['product_owner']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

export function ManagerOnly({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      allowedRoles={['product_owner', 'managing_contributor']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

export function ReadOnlyForSponsors({ children, readOnlyVersion }: {
  children: React.ReactNode
  readOnlyVersion: React.ReactNode
}) {
  const { user } = useUserContext()

  if (user?.role === 'sponsor') {
    return <>{readOnlyVersion}</>
  }

  return <>{children}</>
}

// Permission-based guards

export function CanModifyBacklog({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      requiredPermissions={['modify_backlog']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

export function CanTakeOwnership({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      requiredPermissions={['take_task_ownership']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

export function CanAcceptStories({ children, fallback }: {
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <RoleGuard
      requiredPermissions={['accept_stories']}
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}