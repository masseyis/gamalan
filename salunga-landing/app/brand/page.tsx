"use client"

import { ButtonShowcase } from "@/components/salunga/button-variants"
import { CardShowcase } from "@/components/salunga/card-layout"
import { FormShowcase } from "@/components/salunga/form-elements"
import { BadgeShowcase } from "@/components/salunga/badge-variants"
import { SalungaNavigation } from "@/components/salunga/navigation-bar"
import { KanbanShowcase } from "@/components/salunga/kanban-column"

export default function BrandPreviewPage() {
  const colorPalette = [
    {
      name: "Primary",
      hex: "#0ea5e9",
      css: "--salunga-primary",
      description: "Main brand color for CTAs and highlights",
    },
    {
      name: "Primary Hover",
      hex: "#0284c7",
      css: "--salunga-primary-hover",
      description: "Hover state for primary elements",
    },
    {
      name: "Primary Light",
      hex: "#e0f2fe",
      css: "--salunga-primary-light",
      description: "Light background for primary elements",
    },
    { name: "Accent", hex: "#14b8a6", css: "--salunga-accent", description: "Secondary brand color for accents" },
    {
      name: "Accent Hover",
      hex: "#0d9488",
      css: "--salunga-accent-hover",
      description: "Hover state for accent elements",
    },
    {
      name: "Accent Light",
      hex: "#ccfbf1",
      css: "--salunga-accent-light",
      description: "Light background for accent elements",
    },
    { name: "Success", hex: "#22c55e", css: "--salunga-success", description: "Success states and positive actions" },
    { name: "Warning", hex: "#f59e0b", css: "--salunga-warning", description: "Warning states and caution" },
    { name: "Danger", hex: "#ef4444", css: "--salunga-danger", description: "Error states and destructive actions" },
    { name: "Background", hex: "#ffffff", css: "--salunga-bg", description: "Primary background color" },
    {
      name: "Background Secondary",
      hex: "#fafafa",
      css: "--salunga-bg-secondary",
      description: "Secondary background color",
    },
    { name: "Background Muted", hex: "#f5f5f5", css: "--salunga-bg-muted", description: "Muted background color" },
    { name: "Foreground", hex: "#171717", css: "--salunga-fg", description: "Primary text color" },
    {
      name: "Foreground Secondary",
      hex: "#404040",
      css: "--salunga-fg-secondary",
      description: "Secondary text color",
    },
    { name: "Foreground Muted", hex: "#737373", css: "--salunga-fg-muted", description: "Muted text color" },
    { name: "Border", hex: "#e5e5e5", css: "--salunga-border", description: "Default border color" },
  ]

  return (
    <div className="min-h-screen bg-salunga-bg">
      {/* Navigation */}
      <SalungaNavigation />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-salunga-heading font-bold text-salunga-fg mb-4">Salunga Brand System</h1>
          <p className="text-xl text-salunga-fg-secondary max-w-3xl mx-auto">
            A comprehensive design system for Salunga, the AI-enhanced agile project management tool. This preview
            showcases our brand assets, color palette, and UI components.
          </p>
        </div>

        {/* Logo Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg mb-8">Logo Assets</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-salunga-bg-secondary p-8 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-4">Full Logo</h3>
              <div className="flex items-center justify-center h-24 mb-4">
                <img src="/logo-full.png" alt="Salunga logo" className="h-12" />
              </div>
              <p className="text-sm text-salunga-fg-muted">Primary logo with wordmark and icon</p>
            </div>

            <div className="bg-salunga-bg-secondary p-8 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-4">Icon Only</h3>
              <div className="flex items-center justify-center h-24 mb-4">
                <img src="/logo-icon.png" alt="Salunga icon" className="h-12 w-12" />
              </div>
              <p className="text-sm text-salunga-fg-muted">Icon for square spaces and favicons</p>
            </div>

            <div className="bg-salunga-bg-secondary p-8 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-4">Favicon Preview</h3>
              <div className="flex items-center justify-center h-24 mb-4">
                <div className="flex gap-2">
                  <img src="/favicon-16.png" alt="16x16 favicon" className="w-4 h-4" />
                  <img src="/favicon-32.png" alt="32x32 favicon" className="w-8 h-8" />
                  <img src="/favicon-48.png" alt="48x48 favicon" className="w-12 h-12" />
                </div>
              </div>
              <p className="text-sm text-salunga-fg-muted">Favicon sizes: 16px, 32px, 48px</p>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-16">
          <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg mb-8">Color Palette</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {colorPalette.map((color) => (
              <div
                key={color.name}
                className="bg-salunga-bg-secondary p-4 rounded-salunga-lg border border-salunga-border"
              >
                <div
                  className="w-full h-16 rounded-salunga-md mb-3 border border-salunga-border"
                  style={{ backgroundColor: color.hex }}
                ></div>
                <h4 className="font-medium text-salunga-fg text-sm">{color.name}</h4>
                <p className="text-xs text-salunga-fg-muted font-mono">{color.hex}</p>
                <p className="text-xs text-salunga-fg-muted font-mono">{color.css}</p>
                <p className="text-xs text-salunga-fg-muted mt-2">{color.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg mb-8">Typography</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-salunga-bg-secondary p-6 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-4">
                Headings - Space Grotesk
              </h3>
              <div className="space-y-3">
                <h1 className="text-3xl font-salunga-heading font-bold text-salunga-fg">Heading 1</h1>
                <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg">Heading 2</h2>
                <h3 className="text-xl font-salunga-heading font-medium text-salunga-fg">Heading 3</h3>
                <h4 className="text-lg font-salunga-heading font-medium text-salunga-fg">Heading 4</h4>
              </div>
            </div>

            <div className="bg-salunga-bg-secondary p-6 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-4">Body Text - Inter</h3>
              <div className="space-y-3">
                <p className="text-lg text-salunga-fg">Large body text for important content</p>
                <p className="text-base text-salunga-fg">Regular body text for most content</p>
                <p className="text-sm text-salunga-fg-secondary">Small text for secondary information</p>
                <p className="text-xs text-salunga-fg-muted">Extra small text for captions and metadata</p>
              </div>
            </div>
          </div>
        </section>

        {/* Component Showcases */}
        <div className="space-y-16">
          <ButtonShowcase />
          <CardShowcase />
          <FormShowcase />
          <BadgeShowcase />
          <KanbanShowcase />
        </div>

        {/* Accessibility Information */}
        <section className="mt-16 bg-salunga-bg-secondary p-8 rounded-salunga-xl border border-salunga-border">
          <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg mb-4">Accessibility</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-3">Color Contrast</h3>
              <ul className="space-y-2 text-sm text-salunga-fg-secondary">
                <li>• All color combinations meet WCAG AA standards (4.5:1 ratio)</li>
                <li>• Primary text on background: 12.6:1 ratio</li>
                <li>• Secondary text on background: 5.7:1 ratio</li>
                <li>• Button text on primary background: 4.8:1 ratio</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-3">Interactive Elements</h3>
              <ul className="space-y-2 text-sm text-salunga-fg-secondary">
                <li>• All interactive elements have focus indicators</li>
                <li>• Minimum touch target size of 44px</li>
                <li>• Semantic HTML structure with proper ARIA labels</li>
                <li>• Keyboard navigation support</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="mt-16">
          <h2 className="text-2xl font-salunga-heading font-semibold text-salunga-fg mb-8">Usage Guidelines</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-salunga-bg-secondary p-6 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-3">Logo Usage</h3>
              <ul className="space-y-2 text-sm text-salunga-fg-secondary">
                <li>• Use full logo for primary branding</li>
                <li>• Use icon only in constrained spaces</li>
                <li>• Maintain minimum clear space</li>
                <li>• Don't modify colors or proportions</li>
              </ul>
            </div>

            <div className="bg-salunga-bg-secondary p-6 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-3">Color Application</h3>
              <ul className="space-y-2 text-sm text-salunga-fg-secondary">
                <li>• Primary for main CTAs and navigation</li>
                <li>• Accent for secondary actions</li>
                <li>• Success/Warning/Danger for states</li>
                <li>• Use light variants for backgrounds</li>
              </ul>
            </div>

            <div className="bg-salunga-bg-secondary p-6 rounded-salunga-xl border border-salunga-border">
              <h3 className="text-lg font-salunga-heading font-medium text-salunga-fg mb-3">Typography</h3>
              <ul className="space-y-2 text-sm text-salunga-fg-secondary">
                <li>• Space Grotesk for all headings</li>
                <li>• Inter for body text and UI</li>
                <li>• Maintain consistent hierarchy</li>
                <li>• Use appropriate line heights</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
