import { useAuth } from '@clerk/nextjs'
import { useEffect, useRef, useState } from 'react'

export interface TaskEvent {
  type: 'ownership_taken' | 'ownership_released' | 'status_changed'
  task_id: string
  story_id: string
  timestamp: string
}

export interface OwnershipTakenEvent extends TaskEvent {
  type: 'ownership_taken'
  owner_user_id: string
}

export interface OwnershipReleasedEvent extends TaskEvent {
  type: 'ownership_released'
  previous_owner_user_id: string
}

export interface StatusChangedEvent extends TaskEvent {
  type: 'status_changed'
  old_status: string
  new_status: string
  changed_by_user_id: string
}

export type TaskWebSocketEvent = OwnershipTakenEvent | OwnershipReleasedEvent | StatusChangedEvent

interface UseTaskWebSocketOptions {
  onEvent?: (event: TaskWebSocketEvent) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useTaskWebSocket(options: UseTaskWebSocketOptions = {}) {
  const { getToken } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    let isMounted = true

    const connect = async () => {
      try {
        // Get auth token from Clerk
        const token = await getToken()
        if (!token || !isMounted) return

        // Determine WebSocket URL based on environment
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
        const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/v1/ws/tasks'

        // Create WebSocket connection
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          if (!isMounted) {
            ws.close()
            return
          }

          console.log('[WebSocket] Connected to task updates')
          setIsConnected(true)
          reconnectAttempts.current = 0
          options.onConnect?.()
        }

        ws.onmessage = (event) => {
          if (!isMounted) return

          try {
            const data: TaskWebSocketEvent = JSON.parse(event.data)
            console.log('[WebSocket] Received event:', data)
            options.onEvent?.(data)
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error)
          }
        }

        ws.onerror = (error) => {
          // Only log on first attempt to reduce console noise
          if (reconnectAttempts.current === 0) {
            console.warn('[WebSocket] Connection failed - backend may not be running')
          }
          options.onError?.(error)
        }

        ws.onclose = () => {
          if (!isMounted) return

          setIsConnected(false)
          options.onDisconnect?.()

          // Attempt to reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
            reconnectAttempts.current += 1

            // Only log on first disconnect to reduce console noise
            if (reconnectAttempts.current === 1) {
              console.log('[WebSocket] Disconnected - will retry in background')
            }

            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMounted) {
                connect()
              }
            }, delay)
          } else {
            console.warn('[WebSocket] Max reconnection attempts reached - giving up')
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('[WebSocket] Connection error:', error)
      }
    }

    connect()

    return () => {
      isMounted = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [getToken, options])

  return {
    isConnected,
  }
}
