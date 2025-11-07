'use client'

import { Story, Task, TaskStatus } from '@/lib/types/story'
import { TaskCard } from './TaskCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Inbox } from 'lucide-react'
import type { GroupByOption } from './TaskFilters'

export interface TaskListProps {
  stories: Story[]
  selectedStatuses: TaskStatus[]
  groupBy: GroupByOption
  currentUserId: string
}

interface GroupedTasks {
  [key: string]: {
    label: string
    tasks: Array<{ task: Task; story: Story }>
  }
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  available: 'Available',
  owned: 'Owned',
  inprogress: 'In Progress',
  completed: 'Completed',
}

/**
 * TaskList component displays tasks grouped by story or status.
 * This component satisfies AC1 and AC2 of the Sprint Tasks View story.
 *
 * Features:
 * - Filters tasks by selected statuses
 * - Groups tasks by story or status
 * - Displays task counts for each group
 * - Shows empty state when no tasks match filters
 */
export function TaskList({
  stories,
  selectedStatuses,
  groupBy,
  currentUserId,
}: TaskListProps) {
  // Flatten all tasks with their parent story
  const allTasksWithStory = stories.flatMap((story) =>
    (story.tasks || []).map((task) => ({ task, story }))
  )

  // Filter tasks by selected statuses
  const filteredTasks =
    selectedStatuses.length === 0
      ? allTasksWithStory
      : allTasksWithStory.filter((item) => selectedStatuses.includes(item.task.status))

  // Group tasks
  const groupedTasks: GroupedTasks = {}

  if (groupBy === 'story') {
    // Group by story
    filteredTasks.forEach((item) => {
      const storyId = item.story.id
      if (!groupedTasks[storyId]) {
        groupedTasks[storyId] = {
          label: item.story.title,
          tasks: [],
        }
      }
      groupedTasks[storyId].tasks.push(item)
    })
  } else {
    // Group by status
    filteredTasks.forEach((item) => {
      const status = item.task.status
      if (!groupedTasks[status]) {
        groupedTasks[status] = {
          label: STATUS_LABELS[status],
          tasks: [],
        }
      }
      groupedTasks[status].tasks.push(item)
    })
  }

  // Remove empty groups
  const nonEmptyGroups = Object.entries(groupedTasks).filter(
    ([, group]) => group.tasks.length > 0
  )

  // Show empty state if no tasks match filters
  if (filteredTasks.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No tasks found</h3>
          <p className="text-sm text-muted-foreground">
            No tasks match your filters. Try adjusting your filter criteria.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalTasks = allTasksWithStory.length
  const visibleTasks = filteredTasks.length

  return (
    <div className="space-y-6" data-testid="task-list">
      <div className="text-sm text-muted-foreground" data-testid="task-count-display">
        Showing {visibleTasks} of {totalTasks} tasks
      </div>

      {nonEmptyGroups.map(([groupId, group]) => {
        const groupTestId =
          groupBy === 'story' ? `story-group-${groupId}` : `status-group-${groupId}`
        const legacyStatusGroupTestId = groupBy === 'status' ? `group-${groupId}` : undefined

        const card = (
          <Card data-testid={groupTestId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{group.label}</CardTitle>
                <Badge variant="secondary" data-testid={`group-count-${groupId}`}>
                  <span data-testid={`badge-group-${groupId}`}>
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {group.tasks.map(({ task, story }) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    story={story}
                    isMyTask={task.ownerUserId === currentUserId}
                    showStoryContext={groupBy !== 'story'}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )

        if (legacyStatusGroupTestId) {
          return (
            <div key={groupId} data-testid={legacyStatusGroupTestId}>
              {card}
            </div>
          )
        }

        return (
          <div key={groupId}>
            {card}
          </div>
        )
      })}
    </div>
  )
}
