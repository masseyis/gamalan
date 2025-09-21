// Re-export all types from a central location
export * from './story'
export * from './user'
export * from './team'
export * from './project'
export * from './ai'
export * from './assistant'

// Common utility types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Error types
export interface ApiError {
  message: string
  code?: string
  statusCode?: number
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Generic form state
export interface FormState<T> {
  data: T
  errors: Partial<Record<keyof T, string>>
  isSubmitting: boolean
  isDirty: boolean
}