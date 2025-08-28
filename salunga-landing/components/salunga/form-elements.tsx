import type React from "react"
import { cn } from "@/lib/utils"

interface SalungaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

interface SalungaTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

interface SalungaSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: { value: string; label: string }[]
}

export function SalungaInput({ label, error, helperText, className, ...props }: SalungaInputProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-salunga-fg">{label}</label>}
      <input
        className={cn(
          "w-full px-3 py-2 bg-salunga-input border border-salunga-input-border rounded-salunga-md",
          "text-salunga-fg placeholder:text-salunga-fg-muted",
          "focus:outline-none focus:ring-2 focus:ring-salunga-primary focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-salunga-danger focus:ring-salunga-danger",
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-salunga-danger">{error}</p>}
      {helperText && !error && <p className="text-sm text-salunga-fg-muted">{helperText}</p>}
    </div>
  )
}

export function SalungaTextarea({ label, error, helperText, className, ...props }: SalungaTextareaProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-salunga-fg">{label}</label>}
      <textarea
        className={cn(
          "w-full px-3 py-2 bg-salunga-input border border-salunga-input-border rounded-salunga-md",
          "text-salunga-fg placeholder:text-salunga-fg-muted resize-vertical",
          "focus:outline-none focus:ring-2 focus:ring-salunga-primary focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-salunga-danger focus:ring-salunga-danger",
          className,
        )}
        rows={4}
        {...props}
      />
      {error && <p className="text-sm text-salunga-danger">{error}</p>}
      {helperText && !error && <p className="text-sm text-salunga-fg-muted">{helperText}</p>}
    </div>
  )
}

export function SalungaSelect({ label, error, helperText, options, className, ...props }: SalungaSelectProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-salunga-fg">{label}</label>}
      <select
        className={cn(
          "w-full px-3 py-2 bg-salunga-input border border-salunga-input-border rounded-salunga-md",
          "text-salunga-fg",
          "focus:outline-none focus:ring-2 focus:ring-salunga-primary focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-salunga-danger focus:ring-salunga-danger",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-salunga-danger">{error}</p>}
      {helperText && !error && <p className="text-sm text-salunga-fg-muted">{helperText}</p>}
    </div>
  )
}

// Example usage component
export function FormShowcase() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-salunga-heading font-semibold text-salunga-fg">Form Elements</h3>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <div className="space-y-4">
          <SalungaInput
            label="Project Name"
            placeholder="Enter project name"
            helperText="Choose a descriptive name for your project"
          />
          <SalungaInput
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            error="Please enter a valid email address"
          />
          <SalungaSelect
            label="Project Status"
            options={[
              { value: "", label: "Select status" },
              { value: "planning", label: "Planning" },
              { value: "in-progress", label: "In Progress" },
              { value: "review", label: "Under Review" },
              { value: "completed", label: "Completed" },
            ]}
            helperText="Current status of the project"
          />
        </div>
        <div className="space-y-4">
          <SalungaTextarea
            label="Project Description"
            placeholder="Describe your project goals and requirements..."
            helperText="Provide a detailed description to help team members understand the project scope"
          />
        </div>
      </div>
    </div>
  )
}
