import type React from "react"
import { cn } from "@/lib/utils"

interface SalungaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "accent"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

export function SalungaButton({ variant = "primary", size = "md", className, children, ...props }: SalungaButtonProps) {
  const baseStyles =
    "font-medium transition-all duration-200 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"

  const variants = {
    primary:
      "bg-salunga-primary hover:bg-salunga-primary-hover text-white focus:ring-salunga-primary shadow-salunga-sm hover:shadow-salunga-md",
    secondary:
      "bg-salunga-bg-secondary hover:bg-salunga-bg-muted text-salunga-fg border border-salunga-border hover:border-salunga-border-hover focus:ring-salunga-primary",
    destructive:
      "bg-salunga-danger hover:bg-salunga-danger-hover text-white focus:ring-salunga-danger shadow-salunga-sm hover:shadow-salunga-md",
    ghost: "hover:bg-salunga-bg-muted text-salunga-fg-secondary hover:text-salunga-fg focus:ring-salunga-primary",
    accent:
      "bg-salunga-accent hover:bg-salunga-accent-hover text-white focus:ring-salunga-accent shadow-salunga-sm hover:shadow-salunga-md",
  }

  const sizes = {
    sm: "px-3 py-1.5 text-sm rounded-salunga-sm",
    md: "px-4 py-2 text-base rounded-salunga-md",
    lg: "px-6 py-3 text-lg rounded-salunga-lg",
  }

  return (
    <button className={cn(baseStyles, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}

// Example usage component
export function ButtonShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-salunga-heading font-semibold text-salunga-fg">Button Variants</h3>
      <div className="flex flex-wrap gap-3">
        <SalungaButton variant="primary">Primary</SalungaButton>
        <SalungaButton variant="secondary">Secondary</SalungaButton>
        <SalungaButton variant="accent">Accent</SalungaButton>
        <SalungaButton variant="destructive">Destructive</SalungaButton>
        <SalungaButton variant="ghost">Ghost</SalungaButton>
      </div>
      <div className="flex flex-wrap gap-3">
        <SalungaButton size="sm">Small</SalungaButton>
        <SalungaButton size="md">Medium</SalungaButton>
        <SalungaButton size="lg">Large</SalungaButton>
      </div>
    </div>
  )
}
