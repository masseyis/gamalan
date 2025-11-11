'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { SprintTaskFilters, type GroupByOption } from './SprintTaskFilters'
import { SprintTaskList } from './SprintTaskList'
import { SprintHeader } from './SprintHeader'
import { useTaskWebSocket, type TaskWebSocketEvent } from '@/lib/hooks/useTaskWebSocket'
import { useToast } from '@/hooks/use-toast'
import { Story, TaskStatus } from '@/lib/types/story'
import { Sprint } from '@/lib/types/team'
import { backlogApi } from '@/lib/api/backlog'
import { usersApi } from '@/lib/api/users'
import { useQuery } from '@tanstack/react-query'
import type { User } from '@/lib/types'

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
  const hasOptimisticUpdate = useRef(false)

  // Collect unique owner IDs from all tasks
  const ownerIds = useMemo(() => {
    const ids = new Set<string>()
    stories.forEach((story) => {
      story.tasks?.forEach((task) => {
        if (task.ownerUserId) {
          ids.add(task.ownerUserId)
        }
      })
    })
    return Array.from(ids)
  }, [stories])

  // Fetch individual users by ID (fallback when team users endpoint doesn't exist)
  const { data: individualUsers } = useQuery({
    queryKey: ['task-owner-users', ownerIds],
    queryFn: async () => {
      if (ownerIds.length === 0) return []
      console.log('[SprintTaskBoard] Fetching individual users for task owners:', ownerIds)
      const users = await Promise.all(
        ownerIds.map(async (id) => {
          try {
            return await usersApi.getUser(id)
          } catch (error) {
            console.warn(`[SprintTaskBoard] Failed to fetch user ${id}:`, error)
            return null
          }
        })
      )
      const validUsers = users.filter((u): u is User => u !== null)
      console.log('[SprintTaskBoard] Fetched individual users:', validUsers)
      return validUsers
    },
    enabled: ownerIds.length > 0,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false,
  })

  // Create user lookup map (id -> user)
  const userLookup = useMemo(() => {
    const map = new Map<string, User>()
    // Add individually fetched users
    individualUsers?.forEach((user) => {
      map.set(user.id, user)
    })
    return map
  }, [individualUsers])

  // Sync local state when initialStories prop changes (from refetch)
  // Only sync if we don't have a pending optimistic update
  useEffect(() => {
    if (!hasOptimisticUpdate.current) {
      console.log('[SprintTaskBoard] Syncing stories from prop update')
      setStories(initialStories)
    }
  }, [initialStories])

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
    hasOptimisticUpdate.current = true

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

      // Refetch to sync with server
      onRefresh?.()

      // Allow prop updates again after refetch completes
      setTimeout(() => {
        hasOptimisticUpdate.current = false
      }, 1000)
    } catch (error) {
      hasOptimisticUpdate.current = false
      toast({
        title: 'Unable to claim task',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setClaimingTaskId(null)
    }
  }

  const handleCompleteTask = async (taskId: string, storyId: string) => {
    setClaimingTaskId(taskId)
    hasOptimisticUpdate.current = true

    try {
      // Try to start work first if needed, backend will handle state transitions
      // If task is already in progress, startTaskWork will fail gracefully
      try {
        await backlogApi.startTaskWork(taskId)
      } catch (startError) {
        // Ignore errors from startTaskWork - task may already be in progress
        // The completeTaskWork call will fail if the state is invalid
      }

      // Now complete the task work
      await backlogApi.completeTaskWork(taskId)

      setStories((prevStories) =>
        prevStories.map((story) =>
          story.id === storyId
            ? {
                ...story,
                tasks: story.tasks?.map((task) =>
                  task.id === taskId ? { ...task, status: 'completed' as TaskStatus } : task
                ),
              }
            : story
        )
      )

      toast({
        title: 'Task completed',
        description: 'Great work! The task has been marked as complete',
      })

      // Refetch to sync with server
      onRefresh?.()

      // Allow prop updates again after refetch completes
      setTimeout(() => {
        hasOptimisticUpdate.current = false
      }, 1000)
    } catch (error) {
      hasOptimisticUpdate.current = false
      toast({
        title: 'Unable to complete task',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setClaimingTaskId(null)
    }
  }

  const handleReleaseOwnership = async (taskId: string, storyId: string) => {
    setClaimingTaskId(taskId)
    hasOptimisticUpdate.current = true

    try {
      await backlogApi.releaseTaskOwnership(taskId)

      setStories((prevStories) =>
        prevStories.map((story) =>
          story.id === storyId
            ? {
                ...story,
                tasks: story.tasks?.map((task) =>
                  task.id === taskId
                    ? { ...task, ownerUserId: undefined, status: 'available' as TaskStatus }
                    : task
                ),
              }
            : story
        )
      )

      toast({
        title: 'Task released',
        description: 'The task is now available for others to claim',
      })

      // Refetch to sync with server
      onRefresh?.()

      // Allow prop updates again after refetch completes
      setTimeout(() => {
        hasOptimisticUpdate.current = false
      }, 1000)
    } catch (error) {
      hasOptimisticUpdate.current = false
      toast({
        title: 'Unable to release task',
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
    // Skip WebSocket updates during optimistic updates to prevent race conditions
    if (hasOptimisticUpdate.current) {
      console.log('[SprintTaskBoard] Skipping WebSocket update during optimistic update')
      return
    }

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
    // Skip WebSocket updates during optimistic updates to prevent race conditions
    if (hasOptimisticUpdate.current) {
      console.log('[SprintTaskBoard] Skipping WebSocket update during optimistic update')
      return
    }

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
    // Skip WebSocket updates during optimistic updates to prevent race conditions
    if (hasOptimisticUpdate.current) {
      console.log('[SprintTaskBoard] Skipping WebSocket update during optimistic update')
      return
    }

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
        onCompleteTask={handleCompleteTask}
        onReleaseOwnership={handleReleaseOwnership}
        claimingTaskId={claimingTaskId}
        userLookup={userLookup}
      />
    </div>
  )
}
