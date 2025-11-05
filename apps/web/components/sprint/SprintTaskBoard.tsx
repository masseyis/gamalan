'use client'

import { useState, useMemo } from 'react'
import { SprintTaskFilters, type GroupByOption } from './SprintTaskFilters'
import { SprintTaskList } from './SprintTaskList'
import { SprintHeader } from './SprintHeader'
import { useTaskWebSocket, type TaskWebSocketEvent } from '@/lib/hooks/useTaskWebSocket'
import { useToast } from '@/hooks/use-toast'
import { Story, TaskStatus } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'
import { backlogApi } from '@/lib/api/backlog'

export interface SprintTaskBoardProps {
  sprint: Sprint
  stories: Story[]
  currentUserId?: string
  onRefresh?: () => void
}

/**
 * SprintTaskBoard - Complete sprint task board with filtering, grouping, and real-time updates
 *
 * This component integrates:
 * - SprintHeader: Sprint metadata and progress
 * - SprintTaskFilters: Filter by status and group by story/status
 * - SprintTaskList: Display tasks with applied filters and grouping
 * - Real-time WebSocket updates for task changes
 *
 * Satisfies all acceptance criteria from the Sprint Tasks View story:
 * - AC1: Display all task information
 * - AC2: Filter by status and group by story/status with counts
 * - AC3: Visual distinction for available tasks and current user's tasks
 * - AC4: Real-time updates without page refresh
 * - AC5: Sprint header with name, dates, progress
 */
export function SprintTaskBoard({
  sprint,
  stories: initialStories,
  currentUserId,
  onRefresh,
}: SprintTaskBoardProps) {
  const { toast } = useToast()
  const [stories, setStories] = useState<Story[]>(initialStories)
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
  const [groupBy, setGroupBy] = useState<GroupByOption>('story')
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null)

  // Connect to WebSocket for real-time updates
  const { isConnected } = useTaskWebSocket({
    onEvent: (event: TaskWebSocketEvent) => {
      handleWebSocketEvent(event)
    },
    onConnect: () => {
      console.log('[SprintTaskBoard] Connected to real-time updates')
    },
    onDisconnect: () => {
      console.log('[SprintTaskBoard] Disconnected from real-time updates')
    },
    onError: (error) => {
      console.error('[SprintTaskBoard] WebSocket error:', error)
    },
  })

  // Calculate task counts for filters
  const taskCounts = useMemo(() => {
    const counts = {
      available: 0,
      owned: 0,
      inprogress: 0,
      completed: 0,
    }

    stories.forEach((story) => {
      story.tasks?.forEach((task) => {
        counts[task.status]++
      })
    })

    return counts
  }, [stories])

  // Calculate total tasks and completed tasks for progress
  const progressStats = useMemo(() => {
    let total = 0
    let completed = 0

    stories.forEach((story) => {
      if (story.tasks) {
        total += story.tasks.length
        completed += story.tasks.filter((t) => t.status === 'completed').length
      }
    })

    return {
      totalTasks: total,
      completedTasks: completed,
      progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [stories])

  const handleTakeOwnership = async (taskId: string, storyId: string) => {
    setClaimingTaskId(taskId)

    try {
      await backlogApi.takeTaskOwnership(taskId)

      if (currentUserId) {
        setStories((prevStories) =>
          prevStories.map((story) =>
            story.id === storyId
              ? {
                  ...story,
                  tasks: story.tasks?.map((task) =>
                    task.id === taskId
                      ? { ...task, ownerUserId: currentUserId, status: 'owned' as TaskStatus }
                      : task
                  ),
                }
              : story
          )
        )
      }

      toast({
        title: 'Task claimed',
        description: 'You are now responsible for this task',
      })

      onRefresh?.()
    } catch (error) {
      toast({
        title: 'Unable to claim task',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setClaimingTaskId(null)
    }
  }

  const handleWebSocketEvent = (event: TaskWebSocketEvent) => {
    console.log('[SprintTaskBoard] Task event received:', event)

    // Update local state based on event type
    switch (event.type) {
      case 'ownership_taken':
        handleOwnershipTaken(event)
        break
      case 'ownership_released':
        handleOwnershipReleased(event)
        break
      case 'status_changed':
        handleStatusChanged(event)
        break
    }

    // Refresh data from server if callback provided
    onRefresh?.()
  }

  const handleOwnershipTaken = (event: any) => {
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks?.map((task) =>
              task.id === event.task_id
                ? { ...task, ownerUserId: event.owner_user_id, status: 'owned' as TaskStatus }
                : task
            ),
          }
        }
        return story
      })
    )

    // Show subtle notification
    toast({
      title: 'Task claimed',
      description: `A team member has taken ownership of a task`,
      duration: 3000,
    })
  }

  const handleOwnershipReleased = (event: any) => {
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks?.map((task) =>
              task.id === event.task_id
                ? { ...task, ownerUserId: undefined, status: 'available' as TaskStatus }
                : task
            ),
          }
        }
        return story
      })
    )

    // Show subtle notification
    toast({
      title: 'Task released',
      description: `A task has been released back to available`,
      duration: 3000,
    })
  }

  const handleStatusChanged = (event: any) => {
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks?.map((task) =>
              task.id === event.task_id ? { ...task, status: event.new_status } : task
            ),
          }
        }
        return story
      })
    )

    // Show subtle notification
    toast({
      title: 'Task updated',
      description: `Task status changed from ${event.old_status} to ${event.new_status}`,
      duration: 3000,
    })
  }

  return (
    <div className="space-y-6" data-testid="sprint-task-board">
      {/* Real-time connection indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
          data-testid="connection-indicator"
        />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected to real-time updates' : 'Connecting...'}
        </span>
      </div>

      {/* Sprint Header with progress */}
      <SprintHeader sprint={sprint} stories={stories} />

      {/* Filters and Grouping Controls */}
      <SprintTaskFilters
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        onFilterChange={setSelectedStatuses}
        onGroupChange={setGroupBy}
        taskCounts={taskCounts}
      />

      {/* Task List with applied filters and grouping */}
      <SprintTaskList
        stories={stories}
        selectedStatuses={selectedStatuses}
        groupBy={groupBy}
        currentUserId={currentUserId}
        onTakeOwnership={handleTakeOwnership}
        claimingTaskId={claimingTaskId}
      />
    </div>
  )
}
