'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAssistantStore } from '@/lib/stores/assistant'
import { EntityMatch, EvidenceChip } from '@/lib/types/assistant'
import {
  FileText,
  CheckSquare,
  Calendar,
  GitPullRequest,
  GitCommit,
  User,
  Clock,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const EVIDENCE_ICONS = {
  pr: GitPullRequest,
  commit: GitCommit,
  assignment: User,
  time: Clock,
  mention: MessageSquare,
} as const

const ENTITY_ICONS = {
  story: FileText,
  task: CheckSquare,
  sprint: Calendar,
  project: FileText,
} as const

function EvidenceChipComponent({ evidence }: { evidence: EvidenceChip }) {
  const Icon = EVIDENCE_ICONS[evidence.type] || MessageSquare

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span className="font-medium">{evidence.label}:</span>
      <span>{evidence.value}</span>
    </div>
  )
}

function CandidateCard({
  candidate,
  isSelected,
  onClick,
  showConfidence = true,
}: {
  candidate: EntityMatch
  isSelected: boolean
  onClick: () => void
  showConfidence?: boolean
}) {
  const Icon = ENTITY_ICONS[candidate.type] || FileText

  const confidenceColor =
    candidate.confidence >= 0.8
      ? 'text-green-600'
      : candidate.confidence >= 0.6
        ? 'text-yellow-600'
        : 'text-red-600'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={onClick}
      data-testid="candidate-card"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm leading-tight">{candidate.title}</h3>
                <Badge variant="outline" className="mt-1 text-xs capitalize">
                  {candidate.type}
                </Badge>
              </div>

              {showConfidence && (
                <div className="text-right flex-shrink-0">
                  <div className={cn('text-sm font-medium', confidenceColor)}>
                    {Math.round(candidate.confidence * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">match</div>
                </div>
              )}
            </div>

            {candidate.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{candidate.description}</p>
            )}

            {candidate.evidence.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Evidence:</div>
                <div className="space-y-1">
                  {candidate.evidence.slice(0, 3).map((evidence, i) => (
                    <EvidenceChipComponent key={i} evidence={evidence} />
                  ))}
                  {candidate.evidence.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{candidate.evidence.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isSelected && 'rotate-90 text-primary'
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export function CandidatePickerDialog() {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { lastIntentResult, selectedCandidate, selectCandidate, cancelAction } = useAssistantStore()

  const isOpen = lastIntentResult?.ambiguous && !selectedCandidate
  const candidates = useMemo(() => lastIntentResult?.entities || [], [lastIntentResult?.entities])

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, candidates.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        if (candidates[selectedIndex]) {
          selectCandidate(candidates[selectedIndex])
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelAction()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, candidates, selectCandidate, cancelAction])

  if (!isOpen || candidates.length === 0) return null

  const handleCandidateSelect = (candidate: EntityMatch, index: number) => {
    setSelectedIndex(index)
    selectCandidate(candidate)
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => cancelAction()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        data-testid="candidate-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Which one did you mean?
          </DialogTitle>
          <DialogDescription>
            I found {candidates.length} possible matches for your request. Please select the one you
            meant.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {candidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              isSelected={selectedIndex === index}
              onClick={() => handleCandidateSelect(candidate, index)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Use ↑↓ arrows and Enter to select, Esc to cancel
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelAction}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (candidates[selectedIndex]) {
                  selectCandidate(candidates[selectedIndex])
                }
              }}
              disabled={selectedIndex < 0 || !candidates[selectedIndex]}
            >
              Select This One
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
