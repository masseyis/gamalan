import type React from "react"
import { cn } from "@/lib/utils"

interface SalungaBadgeProps {
  children: React.ReactNode
  variant?: "info" | "success" | "warning" | "error" | "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  className?: string
}

export function SalungaBadge({ children, variant = "primary", size = "md", className }: SalungaBadgeProps) {
  const baseStyles = "inline-flex items-center font-medium rounded-full"

  const variants = {
    primary: "bg-salunga-primary-light text-salunga-primary-dark border border-salunga-primary/20",
    secondary: "bg-salunga-bg-muted text-salunga-fg-secondary border border-salunga-border",
    info: "bg-salunga-primary-light text-salunga-primary-dark border border-salunga-primary/20",
    success: "bg-salunga-success-light text-salunga-success border border-salunga-success/20",
    warning: "bg-salunga-warning-light text-salunga-warning border border-salunga-warning/20",
    error: "bg-salunga-danger-light text-salunga-danger border border-salunga-danger/20",
  }

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  }

  return <span className={cn(baseStyles, variants[variant], sizes[size], className)}>{children}</span>
}

// Example usage component
export function BadgeShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-salunga-heading font-semibold text-salunga-fg">Badge Variants</h3>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <SalungaBadge variant="primary">Primary</SalungaBadge>
          <SalungaBadge variant="secondary">Secondary</SalungaBadge>
          <SalungaBadge variant="info">Info</SalungaBadge>
          <SalungaBadge variant="success">Success</SalungaBadge>
          <SalungaBadge variant="warning">Warning</SalungaBadge>
          <SalungaBadge variant="error">Error</SalungaBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <SalungaBadge size="sm">Small</SalungaBadge>
          <SalungaBadge size="md">Medium</SalungaBadge>
          <SalungaBadge size="lg">Large</SalungaBadge>
        </div>
        <div className="flex flex-wrap gap-2">
          <SalungaBadge variant="success">✓ Completed</SalungaBadge>
          <SalungaBadge variant="warning">⚠ In Review</SalungaBadge>
          <SalungaBadge variant="info">📋 Planning</SalungaBadge>
          <SalungaBadge variant="error">✗ Blocked</SalungaBadge>
        </div>
      </div>
    </div>
  )
}
