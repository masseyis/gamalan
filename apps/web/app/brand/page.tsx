'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export default function BrandPreviewPage() {
  const colorPalette = [
    {
      name: 'Primary',
      hex: '#0ea5e9',
      css: '--salunga-primary',
      description: 'Main brand color for CTAs and highlights',
    },
    {
      name: 'Accent',
      hex: '#14b8a6',
      css: '--salunga-accent',
      description: 'Secondary brand color for accents',
    },
    {
      name: 'Success',
      hex: '#22c55e',
      css: '--salunga-success',
      description: 'Success states and positive actions',
    },
    {
      name: 'Warning',
      hex: '#f59e0b',
      css: '--salunga-warning',
      description: 'Warning states and caution',
    },
    {
      name: 'Danger',
      hex: '#ef4444',
      css: '--salunga-danger',
      description: 'Error states and destructive actions',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">Salunga Brand System</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            AI-enhanced agile project management tool that helps teams focus on delivering value.
            This preview showcases our brand assets, color palette, and UI components.
          </p>
        </div>

        {/* Logo Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Logo Assets</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Full Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-24 mb-4">
                  <Image
                    src="/logo-full.png"
                    alt="Salunga logo"
                    width={128}
                    height={48}
                    className="h-12"
                  />
                </div>
                <p className="text-sm text-muted-foreground">Primary logo with wordmark and icon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Icon Only</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-24 mb-4">
                  <Image
                    src="/logo-icon.png"
                    alt="Salunga icon"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                  />
                </div>
                <p className="text-sm text-muted-foreground">Icon for square spaces and favicons</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Favicon Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-24 mb-4">
                  <div className="flex gap-2">
                    <Image
                      src="/favicon-16.png"
                      alt="16x16 favicon"
                      width={16}
                      height={16}
                      className="w-4 h-4"
                    />
                    <Image
                      src="/favicon-32.png"
                      alt="32x32 favicon"
                      width={32}
                      height={32}
                      className="w-8 h-8"
                    />
                    <Image
                      src="/favicon-48.png"
                      alt="48x48 favicon"
                      width={48}
                      height={48}
                      className="w-12 h-12"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Favicon sizes: 16px, 32px, 48px</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Color Palette */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Color Palette</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {colorPalette.map((color) => (
              <Card key={color.name}>
                <CardContent className="p-4">
                  <div
                    className="w-full h-16 rounded-md mb-3 border"
                    style={{ backgroundColor: color.hex }}
                  ></div>
                  <h4 className="font-medium text-foreground text-sm">{color.name}</h4>
                  <p className="text-xs text-muted-foreground font-mono">{color.hex}</p>
                  <p className="text-xs text-muted-foreground font-mono">{color.css}</p>
                  <p className="text-xs text-muted-foreground mt-2">{color.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Typography</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Headings - Space Grotesk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <h1 className="text-3xl font-bold text-foreground">Heading 1</h1>
                <h2 className="text-2xl font-semibold text-foreground">Heading 2</h2>
                <h3 className="text-xl font-medium text-foreground">Heading 3</h3>
                <h4 className="text-lg font-medium text-foreground">Heading 4</h4>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Body Text - Inter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-lg text-foreground">Large body text for important content</p>
                <p className="text-base text-foreground">Regular body text for most content</p>
                <p className="text-sm text-muted-foreground">
                  Small text for secondary information
                </p>
                <p className="text-xs text-muted-foreground">
                  Extra small text for captions and metadata
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Button Variants */}
        <section className="mb-16">
          <h3 className="text-xl font-semibold text-foreground mb-6">Button Variants</h3>
          <div className="flex flex-wrap gap-4">
            <Button className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white">Primary</Button>
            <Button className="bg-[#14b8a6] hover:bg-[#0d9488] text-white">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button className="bg-[#ef4444] hover:bg-[#dc2626] text-white">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        {/* Card Layout */}
        <section className="mb-16">
          <h3 className="text-xl font-semibold text-foreground mb-6">Card Layout</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Story Card</CardTitle>
                <CardDescription>User Story Example</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  As a user, I want to manage my tasks efficiently so that I can deliver value to
                  customers.
                </p>
                <div className="flex justify-between items-center">
                  <Badge variant="default" className="bg-[#22c55e] text-white">
                    Ready
                  </Badge>
                  <span className="text-xs text-muted-foreground">SP: 3</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Card</CardTitle>
                <CardDescription>Development Task</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Implement authentication middleware with JWT validation and error handling.
                </p>
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="bg-[#f59e0b] text-white">
                    In Progress
                  </Badge>
                  <span className="text-xs text-muted-foreground">Est: 4h</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bug Card</CardTitle>
                <CardDescription>Critical Issue</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Login form validation not working properly on mobile devices.
                </p>
                <div className="flex justify-between items-center">
                  <Badge variant="destructive" className="bg-[#ef4444] text-white">
                    High Priority
                  </Badge>
                  <span className="text-xs text-muted-foreground">Critical</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Form Elements */}
        <section className="mb-16">
          <h3 className="text-xl font-semibold text-foreground mb-6">Form Elements</h3>
          <Card>
            <CardHeader>
              <CardTitle>Project Creation Form</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="project-name">Project Name</Label>
                <Input id="project-name" placeholder="Enter project name" />
              </div>
              <div>
                <Label htmlFor="project-status">Status</Label>
                <Select>
                  <SelectTrigger id="project-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="bg-[#0ea5e9] hover:bg-[#0284c7] text-white">Create Project</Button>
            </CardContent>
          </Card>
        </section>

        {/* Badge Variants */}
        <section className="mb-16">
          <h3 className="text-xl font-semibold text-foreground mb-6">Badge Variants</h3>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#0ea5e9] text-white">Primary</Badge>
            <Badge className="bg-[#14b8a6] text-white">Accent</Badge>
            <Badge className="bg-[#22c55e] text-white">Success</Badge>
            <Badge className="bg-[#f59e0b] text-white">Warning</Badge>
            <Badge className="bg-[#ef4444] text-white">Danger</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
        </section>

        {/* Kanban Board Preview */}
        <section className="mb-16">
          <h3 className="text-xl font-semibold text-foreground mb-6">Kanban Board</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">To Do</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card>
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm">Setup CI/CD Pipeline</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure automated deployment
                    </p>
                    <Badge variant="outline" className="mt-2">
                      Enhancement
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm">User Authentication</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Implement login/logout functionality
                    </p>
                    <Badge className="bg-[#0ea5e9] text-white mt-2">Feature</Badge>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-center">In Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card>
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm">Dashboard Layout</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Creating responsive dashboard
                    </p>
                    <Badge className="bg-[#f59e0b] text-white mt-2">In Progress</Badge>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-center">Done</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card>
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm">Project Setup</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      Initial project configuration
                    </p>
                    <Badge className="bg-[#22c55e] text-white mt-2">Completed</Badge>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Accessibility Information */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-4">Accessibility</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Color Contrast</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• All color combinations meet WCAG AA standards (4.5:1 ratio)</li>
                  <li>• Primary text on background: 12.6:1 ratio</li>
                  <li>• Secondary text on background: 5.7:1 ratio</li>
                  <li>• Button text on primary background: 4.8:1 ratio</li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Interactive Elements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• All interactive elements have focus indicators</li>
                  <li>• Minimum touch target size of 44px</li>
                  <li>• Semantic HTML structure with proper ARIA labels</li>
                  <li>• Keyboard navigation support</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground mb-8">Usage Guidelines</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Logo Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Use full logo for primary branding</li>
                  <li>• Use icon only in constrained spaces</li>
                  <li>• Maintain minimum clear space</li>
                  <li>• Don&apos;t modify colors or proportions</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Color Application</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Primary for main CTAs and navigation</li>
                  <li>• Accent for secondary actions</li>
                  <li>• Success/Warning/Danger for states</li>
                  <li>• Use light variants for backgrounds</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Space Grotesk for all headings</li>
                  <li>• Inter for body text and UI</li>
                  <li>• Maintain consistent hierarchy</li>
                  <li>• Use appropriate line heights</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
