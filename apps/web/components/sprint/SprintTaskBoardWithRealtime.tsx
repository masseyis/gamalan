'use client'

import { useEffect, useState } from 'react'
import { useTaskWebSocket, type TaskWebSocketEvent } from '@/lib/hooks/useTaskWebSocket'
import { useToast } from '@/hooks/use-toast'

interface Task {
  id: string
  title: string
  status: string
  ownerUserId?: string
}

interface Story {
  id: string
  title: string
  tasks: Task[]
}

/**
 * Example component showing how to integrate WebSocket real-time updates
 * with the Sprint Task Board.
 *
 * This demonstrates AC4: Real-time updates without page refresh with subtle notifications
 */
export function SprintTaskBoardWithRealtime() {
  const { toast } = useToast()
  const [stories, setStories] = useState<Story[]>([])

  // Connect to WebSocket for real-time task updates
  const { isConnected } = useTaskWebSocket({
    onEvent: (event: TaskWebSocketEvent) => {
      console.log('Task event received:', event)

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
    },
    onConnect: () => {
      console.log('Connected to real-time updates')
    },
    onDisconnect: () => {
      console.log('Disconnected from real-time updates')
    },
    onError: (error) => {
      console.error('WebSocket error:', error)
    },
  })

  const handleOwnershipTaken = (event: any) => {
    // Update task owner in local state
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks.map((task) =>
              task.id === event.task_id
                ? { ...task, ownerUserId: event.owner_user_id }
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
    // Update task owner in local state
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks.map((task) =>
              task.id === event.task_id ? { ...task, ownerUserId: undefined } : task
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
    // Update task status in local state
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id === event.story_id) {
          return {
            ...story,
            tasks: story.tasks.map((task) =>
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
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected to real-time updates' : 'Connecting...'}
        </span>
      </div>

      {/* Your Sprint Task Board components here */}
      <div>
        {stories.map((story) => (
          <div key={story.id}>
            <h3>{story.title}</h3>
            {story.tasks.map((task) => (
              <div key={task.id}>
                {task.title} - {task.status}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
