'use client'

import { PropsWithChildren, useCallback, useEffect, useRef } from 'react'
import { useTaskWebSocket, TaskWebSocketEvent } from '@/lib/hooks/useTaskWebSocket'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { backlogApi } from '@/lib/api/backlog'
import { usersApi } from '@/lib/api/users'

type StoryCache = Map<string, { title: string }>
type UserCache = Map<string, string>

export function TaskNotificationProvider({ children }: PropsWithChildren) {
  const { toast } = useToast()
  const displayedEvents = useRef<Set<string>>(new Set())
  const storyCache = useRef<StoryCache>(new Map())
  const userCache = useRef<UserCache>(new Map())
  const hasPromptedForPermission = useRef(false)

  const maybePromptForPermission = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!('Notification' in window)) {
      return
    }

    if (Notification.permission === 'default' && !hasPromptedForPermission.current) {
      hasPromptedForPermission.current = true
      const prompt = toast({
        title: 'Enable desktop notifications?',
        description: 'Stay informed when teammates pick up or complete tasks.',
        action: (
          <ToastAction
            altText="Enable notifications"
            onClick={async () => {
              try {
                const result = await Notification.requestPermission()
                if (result === 'granted') {
                  toast({
                    title: 'Notifications enabled',
                    description: 'Great! We will notify you about sprint activity.',
                  })
                }
              } catch (error) {
                console.error('Failed to request notification permission', error)
              } finally {
                prompt.dismiss()
              }
            }}
          >
            Enable
          </ToastAction>
        ),
      })
    }
  }, [toast])

  useEffect(() => {
    maybePromptForPermission()
  }, [maybePromptForPermission])

  const resolveStoryTitle = useCallback(async (storyId: string) => {
    if (storyCache.current.has(storyId)) {
      return storyCache.current.get(storyId)!.title
    }

    try {
      const story = await backlogApi.getStory('', storyId)
      storyCache.current.set(storyId, { title: story.title })
      return story.title
    } catch (error) {
      console.warn('Failed to resolve story title', error)
      return `Story ${storyId.slice(-6)}`
    }
  }, [])

  const resolveUserLabel = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      return 'A teammate'
    }

    if (userCache.current.has(userId)) {
      return userCache.current.get(userId)!
    }

    try {
      const user = await usersApi.getUser(userId)
      const label = user.email || user.id || 'A teammate'
      userCache.current.set(userId, label)
      return label
    } catch (error) {
      console.warn('Failed to resolve user name', error)
      return 'A teammate'
    }
  }, [])

  const showSystemNotification = useCallback(
    (title: string, body: string, tag: string) => {
      if (typeof window === 'undefined') {
        return
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            tag,
            renotify: false,
          })
          return
        } catch (error) {
          console.warn('Unable to display Notification API message', error)
        }
      }

      toast({
        title,
        description: body,
      })
    },
    [toast]
  )

  const handleEvent = useCallback(
    async (event: TaskWebSocketEvent) => {
      if (typeof window === 'undefined') {
        return
      }

      const eventKey = `${event.type}-${event.task_id}-${event.timestamp}`
      if (displayedEvents.current.has(eventKey)) {
        return
      }
      displayedEvents.current.add(eventKey)

      // Prevent unbounded growth
      if (displayedEvents.current.size > 200) {
        const [firstKey] = displayedEvents.current
        displayedEvents.current.delete(firstKey)
      }

      // Ignore events originating from the current user
      if (event.type === 'ownership_taken') {
        const [storyTitle, ownerLabel] = await Promise.all([
          resolveStoryTitle(event.story_id),
          resolveUserLabel(event.owner_user_id),
        ])

        showSystemNotification(
          'Task claimed',
          `${ownerLabel} took a task in "${storyTitle}".`,
          eventKey
        )
      } else if (event.type === 'status_changed' && event.new_status === 'completed') {
        const [storyTitle, ownerLabel] = await Promise.all([
          resolveStoryTitle(event.story_id),
          resolveUserLabel(event.changed_by_user_id),
        ])

        showSystemNotification(
          'Task completed',
          `${ownerLabel} completed a task in "${storyTitle}".`,
          eventKey
        )
      }
    },
    [resolveStoryTitle, resolveUserLabel, showSystemNotification]
  )

  useTaskWebSocket({
    onEvent: (event) => {
      void handleEvent(event)
    },
  })

  return <>{children}</>
}
