import type React from 'react'
import { cn } from '@/lib/utils'

interface SalungaCardProps {
  children: React.ReactNode
  className?: string
}

interface SalungaCardHeaderProps {
  children: React.ReactNode
  className?: string
}

interface SalungaCardBodyProps {
  children: React.ReactNode
  className?: string
}

interface SalungaCardFooterProps {
  children: React.ReactNode
  className?: string
}

export function SalungaCard({ children, className }: SalungaCardProps) {
  return (
    <div
      className={cn(
        'bg-salunga-bg border border-salunga-border rounded-salunga-xl shadow-salunga-sm hover:shadow-salunga-md transition-shadow duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}

export function SalungaCardHeader({ children, className }: SalungaCardHeaderProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-salunga-border bg-salunga-bg-secondary rounded-t-salunga-xl',
        className
      )}
    >
      {children}
    </div>
  )
}

export function SalungaCardBody({ children, className }: SalungaCardBodyProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

export function SalungaCardFooter({ children, className }: SalungaCardFooterProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-salunga-border bg-salunga-bg-secondary rounded-b-salunga-xl',
        className
      )}
    >
      {children}
    </div>
  )
}

// Example usage component
export function CardShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-salunga-heading font-semibold text-salunga-fg">Card Layout</h3>
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <SalungaCard>
          <SalungaCardHeader>
            <h4 className="text-lg font-salunga-heading font-semibold text-salunga-fg">
              Project Overview
            </h4>
            <p className="text-sm text-salunga-fg-muted mt-1">Track your project progress</p>
          </SalungaCardHeader>
          <SalungaCardBody>
            <p className="text-salunga-fg-secondary">
              This card demonstrates the Salunga design system with proper spacing, typography, and
              color usage.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-salunga-fg-muted">Progress</span>
                <span className="text-salunga-primary font-medium">75%</span>
              </div>
              <div className="w-full bg-salunga-bg-muted rounded-full h-2">
                <div className="bg-salunga-primary h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
          </SalungaCardBody>
          <SalungaCardFooter>
            <div className="flex justify-between items-center">
              <span className="text-sm text-salunga-fg-muted">Last updated: 2 hours ago</span>
              <button className="text-salunga-primary hover:text-salunga-primary-hover text-sm font-medium">
                View Details
              </button>
            </div>
          </SalungaCardFooter>
        </SalungaCard>

        <SalungaCard>
          <SalungaCardHeader>
            <h4 className="text-lg font-salunga-heading font-semibold text-salunga-fg">
              Team Activity
            </h4>
          </SalungaCardHeader>
          <SalungaCardBody>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-salunga-accent rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JD
                </div>
                <div>
                  <p className="text-sm font-medium text-salunga-fg">John Doe completed a task</p>
                  <p className="text-xs text-salunga-fg-muted">5 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-salunga-primary rounded-full flex items-center justify-center text-white text-sm font-medium">
                  SM
                </div>
                <div>
                  <p className="text-sm font-medium text-salunga-fg">
                    Sarah Miller added a comment
                  </p>
                  <p className="text-xs text-salunga-fg-muted">12 minutes ago</p>
                </div>
              </div>
            </div>
          </SalungaCardBody>
        </SalungaCard>
      </div>
    </div>
  )
}
