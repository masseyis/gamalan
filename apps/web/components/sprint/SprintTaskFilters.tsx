'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { TaskStatus } from '@/lib/types/story'
import { Filter, X } from 'lucide-react'

export type GroupByOption = 'story' | 'status'

export interface TaskCounts {
  available: number
  owned: number
  inprogress: number
  completed: number
}

export interface SprintTaskFiltersProps {
  selectedStatuses: TaskStatus[]
  groupBy: GroupByOption
  onFilterChange: (statuses: TaskStatus[]) => void
  onGroupChange: (groupBy: GroupByOption) => void
  taskCounts: TaskCounts
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'available', label: 'Available', color: 'bg-blue-500' },
  { value: 'owned', label: 'Owned', color: 'bg-yellow-500' },
  { value: 'inprogress', label: 'In Progress', color: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500' },
]

/**
 * SprintTaskFilters component provides filtering and grouping controls for sprint tasks.
 *
 * Features:
 * - Filter tasks by status (multiple selection)
 * - Group tasks by story or status
 * - Display task counts for each status
 * - Clear filters functionality
 *
 * This component satisfies AC2 of the Sprint Tasks View story.
 */
export function SprintTaskFilters({
  selectedStatuses,
  groupBy,
  onFilterChange,
  onGroupChange,
  taskCounts,
}: SprintTaskFiltersProps) {
  const handleStatusSelect = (status: string) => {
    if (status === 'all') {
      onFilterChange([])
    } else {
      onFilterChange([status as TaskStatus])
    }
  }

  const handleClearFilters = () => {
    onFilterChange([])
  }

  const hasActiveFilters = selectedStatuses.length > 0
  const currentFilterValue = selectedStatuses.length === 0 ? 'all' : selectedStatuses[0]

  return (
    <Card data-testid="sprint-task-filters">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header with Clear Filters */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Filters & Grouping</h3>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Status Filters */}
          <div data-testid="status-filters">
            <Label htmlFor="status-filter" className="text-sm font-medium mb-3 block">
              Filter by status
            </Label>
            <select
              id="status-filter"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={currentFilterValue}
              onChange={(e) => handleStatusSelect(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All tasks</option>
              <option value="available" aria-label="Available">Status: not started ({taskCounts.available})</option>
              <option value="owned" aria-label="Owned">Status: claimed ({taskCounts.owned})</option>
              <option value="inprogress" aria-label="In Progress">Status: in progress ({taskCounts.inprogress})</option>
              <option value="completed" aria-label="Completed">Status: done ({taskCounts.completed})</option>
            </select>
          </div>

          {/* Group By Controls */}
          <div data-testid="group-by-controls">
            <Label className="text-sm font-medium mb-3 block">Group by</Label>
            <RadioGroup value={groupBy} onValueChange={(value) => onGroupChange(value as GroupByOption)} aria-label="Group by">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="story" id="group-story" aria-label="By Story" />
                  <label
                    htmlFor="group-story"
                    className="flex-1 text-sm font-medium cursor-pointer"
                  >
                    By Story
                  </label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="status" id="group-status" aria-label="By Status" />
                  <label
                    htmlFor="group-status"
                    className="flex-1 text-sm font-medium cursor-pointer"
                  >
                    By Status
                  </label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
