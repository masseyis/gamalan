'use client'

import { useState } from 'react'
import { useOrganizationList } from '@clerk/nextjs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Building2, Loader2 } from 'lucide-react'

interface CreateOrganizationModalProps {
  open: boolean
  onClose: () => void
}

export function CreateOrganizationModal({ open, onClose }: CreateOrganizationModalProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { createOrganization } = useOrganizationList()
  const { toast } = useToast()

  const handleNameChange = (value: string) => {
    setName(value)
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    setSlug(generatedSlug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        title: 'Organization name required',
        description: 'Please enter a name for your organization.',
        variant: 'destructive',
      })
      return
    }

    if (!slug.trim()) {
      toast({
        title: 'Organization slug required',
        description: 'Please enter a URL-friendly slug for your organization.',
        variant: 'destructive',
      })
      return
    }

    setIsCreating(true)

    try {
      const organization = await createOrganization?.({
        name: name.trim(),
        slug: slug.trim(),
        // Note: Clerk doesn't support custom descriptions in basic plan
        // We'll store this in our own database later
      })

      if (organization) {
        toast({
          title: 'Organization created',
          description: `${organization.name} has been created successfully.`,
        })

        // Reset form
        setName('')
        setSlug('')
        setDescription('')
        onClose()
      }
    } catch (error: any) {
      toast({
        title: 'Failed to create organization',
        description: error?.errors?.[0]?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
      setSlug('')
      setDescription('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Set up a new organization to collaborate with your team.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                type="text"
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-slug">URL Slug *</Label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-2">battra.ai/</span>
                <Input
                  id="org-slug"
                  type="text"
                  placeholder="acme-inc"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isCreating}
                  required
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens are allowed"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will be your organization&apos;s unique URL. Only lowercase letters, numbers,
                and hyphens.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-description">Description (optional)</Label>
              <Textarea
                id="org-description"
                placeholder="Brief description of your organization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will help team members understand what your organization does.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim() || !slug.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

