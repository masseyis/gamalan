'use client'

import { TaskStatus } from '@/lib/types/story'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Filter, Layers } from 'lucide-react'

export type GroupByOption = 'story' | 'status'

export interface TaskFilterProps {
  selectedStatuses: TaskStatus[]
  groupBy: GroupByOption
  onFilterChange: (statuses: TaskStatus[]) => void
  onGroupByChange: (groupBy: GroupByOption) => void
  taskCounts: Record<TaskStatus, number>
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  available: 'Available',
  owned: 'Owned',
  inprogress: 'In Progress',
  completed: 'Completed',
}

const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  available: 'Tasks ready to be claimed',
  owned: 'Tasks claimed by contributors',
  inprogress: 'Tasks being worked on',
  completed: 'Finished tasks',
}

/**
 * TaskFilters component provides filtering and grouping controls for sprint tasks.
 * This component satisfies AC2 of the Sprint Tasks View story.
 *
 * Features:
 * - Filter tasks by status (multiple selection)
 * - Group tasks by story or status
 * - Display task counts for each filter option
 */
export function TaskFilters({
  selectedStatuses,
  groupBy,
  onFilterChange,
  onGroupByChange,
  taskCounts,
}: TaskFilterProps) {
  const handleStatusToggle = (status: TaskStatus) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status]

    onFilterChange(newStatuses)
  }

  const allStatuses: TaskStatus[] = ['available', 'owned', 'inprogress', 'completed']

  return (
    <Card className="mb-6" data-testid="task-filters">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status Filters */}
          <div className="space-y-4" data-testid="filter-status">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Filter by Status</h3>
            </div>

            <div className="space-y-3">
              {allStatuses.map((status) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => handleStatusToggle(status)}
                      aria-label={STATUS_LABELS[status]}
                      data-testid={`status-option-${status}`}
                    />
                    <div className="flex flex-col">
                      <Label
                        htmlFor={`status-${status}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {STATUS_LABELS[status]}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {STATUS_DESCRIPTIONS[status]}
                      </span>
                    </div>
                  </div>
                  <span
                    className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded"
                    data-testid={`count-${status}`}
                  >
                    <span data-testid={`filter-badge-${status}`}>{taskCounts[status]}</span>
                  </span>
                </div>
              ))}
            </div>

            {selectedStatuses.length > 0 && (
              <button
                onClick={() => onFilterChange([])}
                className="text-xs text-muted-foreground hover:text-foreground underline"
                data-testid="clear-filters"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Group By */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Group By</h3>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="group-by-select" className="text-sm text-muted-foreground mb-2">
                  Organize tasks by
                </Label>
                <Select value={groupBy} onValueChange={onGroupByChange}>
                  <SelectTrigger
                    id="group-by-select"
                    aria-label="Group By"
                    data-testid="group-by-select"
                  >
                    <SelectValue placeholder="Select grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story" data-testid="group-option-story">
                      Story
                    </SelectItem>
                    <SelectItem value="status" data-testid="group-option-status">
                      Status
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {groupBy === 'story'
                    ? 'Tasks grouped by their parent story'
                    : 'Tasks grouped by current status'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
