'use client'

import { Task, Story } from '@/lib/types/story'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TaskCardProps {
  task: Task
  story?: Story
  isMyTask: boolean
  showStoryContext?: boolean
}

const OWNER_DISPLAY_THRESHOLD = 16
const OWNER_DISPLAY_LENGTH = 8
const TASK_ID_DISPLAY_LENGTH = 8

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  owned: {
    label: 'Owned',
    icon: User,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  inprogress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
}

/**
 * TaskCard component displays a single task with its details.
 * This component satisfies AC1 and AC3 of the Sprint Tasks View story.
 *
 * Features:
 * - Displays task ID, title, status, owner, and AC references
 * - Highlights tasks owned by current user
 * - Shows owner name for tasks owned by others
 * - Visual distinction for available tasks
 */
export function TaskCard({ task, story, isMyTask, showStoryContext = true }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status]
  const StatusIcon = statusConfig.icon
  const isAvailable = task.status === 'available' && !task.ownerUserId
  const ownerLabel = task.ownerUserId
    ? task.ownerUserId.length > OWNER_DISPLAY_THRESHOLD
      ? task.ownerUserId.slice(0, OWNER_DISPLAY_LENGTH)
      : task.ownerUserId
    : null
  const taskIdDisplay =
    task.id.length > TASK_ID_DISPLAY_LENGTH ? task.id.slice(0, TASK_ID_DISPLAY_LENGTH) : task.id
  const acCount = task.acceptanceCriteriaRefs.length
  const acLabel = acCount === 1 ? '1 AC' : `${acCount} ACs`

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md',
        isMyTask && 'ring-2 ring-blue-500 ring-offset-2',
        isAvailable && 'border-dashed',
        statusConfig.borderColor
      )}
      data-testid={`task-card-${task.id}`}
      data-my-task={isMyTask}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Status + Task ID */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <StatusIcon className={cn('h-4 w-4 flex-shrink-0', statusConfig.color)} />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs font-mono"
                    data-testid="task-id"
                    title={task.id}
                  >
                    {taskIdDisplay}
                  </Badge>
                  <Badge
                    className={cn('text-xs', statusConfig.bgColor, statusConfig.color)}
                    variant="secondary"
                    data-testid="task-status-badge"
                  >
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </div>

            {isMyTask && (
              <Badge variant="default" className="bg-blue-500 text-white text-xs">
                My Task
              </Badge>
            )}
          </div>

          {/* Story Title */}
          {story && showStoryContext && (
            <div className="text-xs text-muted-foreground" data-testid="task-story">
              <span className="font-medium">{`Story: ${story.title}`}</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <h4 className="font-semibold text-foreground leading-tight">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Footer: Owner + AC Count */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {task.ownerUserId ? (
                <div className="flex items-center gap-1" data-testid="task-owner">
                  <User className="h-3 w-3" />
                  <span title={isMyTask ? undefined : task.ownerUserId}>
                    {isMyTask ? 'You' : `Owned by ${ownerLabel}`}
                  </span>
                </div>
              ) : (
                <span className="text-green-600 font-medium">Available to claim</span>
              )}
            </div>

            {acCount > 0 && (
              <div className="flex items-center gap-1" data-testid="task-ac-refs">
                <span className="font-medium" title={task.acceptanceCriteriaRefs.join(', ')}>
                  {acLabel}
                </span>
              </div>
            )}
          </div>

          {/* Estimated Hours */}
          {task.estimatedHours && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{task.estimatedHours}h estimated</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
