'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Story, Task, TaskStatus } from '@/lib/types/story'
import { GroupByOption } from './SprintTaskFilters'
import { CheckCircle2, Circle, Clock, User as UserIcon } from 'lucide-react'
import { formatUserDisplayName } from '@/lib/utils/display-name'
import type { User } from '@/lib/types'

export interface SprintTaskListProps {
  stories: Story[]
  selectedStatuses: TaskStatus[]
  groupBy: GroupByOption
  currentUserId?: string
  onTakeOwnership?: (taskId: string, storyId: string) => void
  onCompleteTask?: (taskId: string, storyId: string) => void
  onReleaseOwnership?: (taskId: string, storyId: string) => void
  claimingTaskId?: string | null
  userLookup?: Map<string, User>
}

interface TaskWithStory extends Task {
  story: Story
}

interface GroupedTasks {
  [key: string]: TaskWithStory[]
}

const OWNER_DISPLAY_THRESHOLD = 16
const OWNER_DISPLAY_LENGTH = 8
const TASK_ID_DISPLAY_LENGTH = 8

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  available: {
    label: 'Available',
    icon: <Circle className="h-4 w-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  owned: {
    label: 'Owned',
    icon: <UserIcon className="h-4 w-4" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
  },
  inprogress: {
    label: 'In Progress',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
}

const STATUS_ORDER: TaskStatus[] = ['available', 'owned', 'inprogress', 'completed']

/**
 * SprintTaskList component displays sprint tasks grouped and filtered according to user preferences.
 *
 * Features:
 * - Filter tasks by status
 * - Group tasks by story or status
 * - Display task counts for each group
 * - Highlight current user's tasks
 * - Show all required task information (ID, title, status, owner, parent story, AC refs)
 *
 * This component satisfies AC1 and AC2 of the Sprint Tasks View story.
 */
export function SprintTaskList({
  stories,
  selectedStatuses,
  groupBy,
  currentUserId,
  onTakeOwnership,
  onCompleteTask,
  onReleaseOwnership,
  claimingTaskId,
  userLookup,
}: SprintTaskListProps) {
  // Flatten tasks and attach story information
  const tasksWithStories = useMemo((): TaskWithStory[] => {
    return stories.flatMap((story) =>
      (story.tasks || []).map((task) => ({
        ...task,
        story,
      }))
    )
  }, [stories])

  // Apply status filters
  const filteredTasks = useMemo(() => {
    if (selectedStatuses.length === 0) {
      return tasksWithStories
    }
    return tasksWithStories.filter((task) => selectedStatuses.includes(task.status))
  }, [tasksWithStories, selectedStatuses])

  // Group tasks based on groupBy option
  const groupedTasks = useMemo((): GroupedTasks => {
    if (groupBy === 'story') {
      // Group by story
      const groups: GroupedTasks = {}
      filteredTasks.forEach((task) => {
        const key = task.story.id
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(task)
      })
      return groups
    } else {
      // Group by status
      const groups: GroupedTasks = {}
      filteredTasks.forEach((task) => {
        const key = task.status
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(task)
      })
      return groups
    }
  }, [filteredTasks, groupBy])

  // Get ordered group keys
  const orderedGroupKeys = useMemo(() => {
    if (groupBy === 'story') {
      // Maintain story order from input
      return stories.map((s) => s.id).filter((id) => groupedTasks[id]?.length > 0)
    } else {
      // Use status order
      return STATUS_ORDER.filter((status) => groupedTasks[status]?.length > 0)
    }
  }, [groupBy, groupedTasks, stories])

  const renderTaskCard = (task: TaskWithStory) => {
    const config = STATUS_CONFIG[task.status]
    const isMyTask = currentUserId && task.ownerUserId === currentUserId
    const isAvailable = task.status === 'available' && !task.ownerUserId
    const isClaiming = claimingTaskId === task.id

    // Get owner display name from userLookup if available
    let ownerLabel: string | null = null
    if (task.ownerUserId) {
      const ownerUser = userLookup?.get(task.ownerUserId)
      if (ownerUser) {
        ownerLabel = formatUserDisplayName({
          name: null,
          email: ownerUser.email,
          role: ownerUser.role,
          id: ownerUser.id,
        })
      } else {
        // Fallback: Show "Unknown User" with truncated ID
        const shortId = task.ownerUserId.slice(0, OWNER_DISPLAY_LENGTH)
        ownerLabel = `Unknown · ${shortId}`
      }
    }

    const taskIdDisplay =
      task.id.length > TASK_ID_DISPLAY_LENGTH
        ? task.id.slice(0, TASK_ID_DISPLAY_LENGTH)
        : task.id
    const acCount = task.acceptanceCriteriaRefs.length
    const acLabel = acCount === 1 ? '1 AC' : `${acCount} ACs`
    const shouldShowStoryContext = groupBy !== 'story'

    // Determine border styling based on task status
    let borderClasses = ''
    if (task.status === 'completed') {
      borderClasses = 'border-green-200'
    } else if (task.status === 'inprogress') {
      borderClasses = 'border-yellow-200'
    } else if (task.status === 'owned') {
      borderClasses = 'border-blue-200'
    } else {
      borderClasses = 'border-gray-200'
    }

    return (
      <Card
        key={task.id}
        data-testid={`task-card-${task.id}`}
        data-my-task={isMyTask ? 'true' : 'false'}
        className={`transition-all hover:shadow-md ${borderClasses} ${
          isMyTask ? 'ring-2 ring-blue-500 ring-offset-2' : isAvailable ? 'border-dashed' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Task Title and Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground break-words">{task.title}</h4>
                {shouldShowStoryContext && (
                  <p className="text-xs text-muted-foreground mt-1" data-testid="task-story">
                    {`Story: ${task.story.title}`}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={`${config.color} flex items-center gap-1 shrink-0`}
                data-testid="task-status-badge"
              >
                {config.icon}
                <span className="text-xs">{config.label}</span>
              </Badge>
            </div>

            {/* Task Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {/* Task ID */}
              <div className="flex items-center gap-1">
                  <span className="font-mono" data-testid="task-id" title={task.id}>
                    {taskIdDisplay}
                  </span>
              </div>

              {/* Owner */}
              {task.ownerUserId && (
                <div className="flex items-center gap-1" data-testid="task-owner">
                  <UserIcon className="h-3 w-3" />
                  <span title={isMyTask ? undefined : task.ownerUserId}>
                    {isMyTask ? 'You' : ownerLabel}
                  </span>
                </div>
              )}

              {/* AC References */}
              {acCount > 0 && (
                <div className="flex items-center gap-1" data-testid="task-ac-refs">
                  <span className="font-medium" title={task.acceptanceCriteriaRefs.join(', ')}>
                    {acLabel}
                  </span>
                </div>
              )}

              {/* Available indicator */}
              {isAvailable && (
                <span className="text-green-600 font-medium">Available to claim</span>
              )}

              {/* My task indicator */}
              {isMyTask && <Badge className="bg-blue-500 text-white">My Task</Badge>}
            </div>

            {isAvailable && onTakeOwnership && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Ready for pickup</span>
                <Button
                  size="sm"
                  onClick={() => onTakeOwnership(task.id, task.story.id)}
                  disabled={isClaiming}
                  data-testid={`take-ownership-${task.id}`}
                >
                  {isClaiming ? 'Claiming...' : "I'm on it"}
                </Button>
              </div>
            )}

            {isMyTask && task.status !== 'completed' && (onCompleteTask || onReleaseOwnership) && (
              <div className="flex items-center justify-end gap-2 text-sm">
                {onReleaseOwnership && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReleaseOwnership(task.id, task.story.id)}
                    disabled={isClaiming}
                    data-testid={`release-ownership-${task.id}`}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {isClaiming ? 'Releasing...' : 'Give up'}
                  </Button>
                )}
                {onCompleteTask && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onCompleteTask(task.id, task.story.id)}
                    disabled={isClaiming}
                    data-testid={`complete-task-${task.id}`}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isClaiming ? 'Completing...' : 'Done it'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderGroup = (groupKey: string) => {
    const tasks = groupedTasks[groupKey]
    if (!tasks || tasks.length === 0) return null

    let groupTitle: string
    let groupTestId: string

    if (groupBy === 'story') {
      const story = stories.find((s) => s.id === groupKey)
      groupTitle = story?.title || 'Unknown Story'
      groupTestId = `story-group-${groupKey}`
    } else {
      const status = groupKey as TaskStatus
      groupTitle = STATUS_CONFIG[status].label
      groupTestId = `status-group-${status}`
    }

    const taskCount = tasks.length
    const taskLabel = taskCount === 1 ? 'task' : 'tasks'

    return (
      <div key={groupKey} data-testid={groupTestId} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{groupTitle}</h3>
          <Badge variant="secondary" data-testid={`group-count-${groupKey}`}>
            <span data-testid={`badge-${groupKey}`}>
              {taskCount} {taskLabel}
            </span>
          </Badge>
        </div>
        <div className="space-y-2">{tasks.map(renderTaskCard)}</div>
      </div>
    )
  }

  // Handle empty state
  if (filteredTasks.length === 0) {
    return (
      <Card data-testid="sprint-task-list">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">
            {selectedStatuses.length > 0
              ? 'No tasks match the selected filters'
              : 'No tasks found'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalTasks = tasksWithStories.length
  const visibleTasks = filteredTasks.length

  return (
    <div data-testid="sprint-task-list" className="space-y-6">
      {/* Task count summary */}
      <div className="text-sm text-muted-foreground" data-testid="task-count-display">
        Showing {visibleTasks} of {totalTasks} tasks
      </div>

      {orderedGroupKeys.map(renderGroup)}
    </div>
  )
}
