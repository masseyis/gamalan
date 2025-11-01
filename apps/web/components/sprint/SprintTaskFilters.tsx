'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { TaskStatus } from '@/lib/types/story'
import { Badge } from '@/components/ui/badge'
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
  const handleStatusToggle = (status: TaskStatus) => {
    if (selectedStatuses.includes(status)) {
      onFilterChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onFilterChange([...selectedStatuses, status])
    }
  }

  const handleClearFilters = () => {
    onFilterChange([])
  }

  const hasActiveFilters = selectedStatuses.length > 0

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
            <Label className="text-sm font-medium mb-3 block">Filter by Status</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STATUS_OPTIONS.map((option) => {
                const isChecked = selectedStatuses.includes(option.value)
                const count = taskCounts[option.value]

                return (
                  <div
                    key={option.value}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={() => handleStatusToggle(option.value)}
                      aria-label={`${option.label} (${count})`}
                    />
                    <label
                      htmlFor={`status-${option.value}`}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${option.color}`} />
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {count}
                      </Badge>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Group By Controls */}
          <div data-testid="group-by-controls">
            <Label className="text-sm font-medium mb-3 block">Group By</Label>
            <RadioGroup value={groupBy} onValueChange={(value) => onGroupChange(value as GroupByOption)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="story" id="group-story" />
                  <label
                    htmlFor="group-story"
                    className="flex-1 text-sm font-medium cursor-pointer"
                    aria-label="Group by story"
                  >
                    Group by Story
                  </label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="status" id="group-status" />
                  <label
                    htmlFor="group-status"
                    className="flex-1 text-sm font-medium cursor-pointer"
                    aria-label="Group by status"
                  >
                    Group by Status
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
