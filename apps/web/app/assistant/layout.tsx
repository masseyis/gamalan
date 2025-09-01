'use client'

import { AssistantBar } from '@/components/assistant/assistant-bar'
import { CandidatePickerDialog } from '@/components/assistant/candidate-picker-dialog'
import { ActionPreviewDialog } from '@/components/assistant/action-preview-dialog'
import { ConfirmActionDialog } from '@/components/assistant/confirm-action-dialog'

interface AssistantLayoutProps {
  children: React.ReactNode
}

export default function AssistantLayout({ children }: AssistantLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* Sticky Assistant Bar at top */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-4">
          <AssistantBar />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Global dialogs */}
      <CandidatePickerDialog />
      <ActionPreviewDialog />
      <ConfirmActionDialog />
    </div>
  )
}