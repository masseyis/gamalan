import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { normalizeUserId } from '@/lib/utils/uuid'
import { convertKeysToCamelCase } from '@/lib/utils/case-converter'

export interface ApiClientOptions {
  baseURL: string
  timeout?: number
  apiKey?: string
}

const DEFAULT_ORCHESTRATOR_BASE = 'http://localhost:8000/api/v1/context'

const resolveOrchestratorBaseUrl = () => {
  const configured = process.env.NEXT_PUBLIC_ORCHESTRATOR_API_URL
  if (!configured) {
    return DEFAULT_ORCHESTRATOR_BASE
  }

  const trimmed = configured.replace(/\/+$/, '')

  // Check if both /api/v1 and /context are present in the correct order
  const hasApiV1 = trimmed.includes('/api/v1')
  const hasContext = trimmed.includes('/context')
  
  if (hasApiV1 && hasContext) {
    // Both are present, return as-is
    return trimmed
  }
  
  if (hasApiV1 && !hasContext) {
    // Has /api/v1 but missing /context, append it
    return `${trimmed}/context`
  }
  
  if (!hasApiV1 && hasContext) {
    // Has /context but missing /api/v1, insert /api/v1 before /context
    const contextIndex = trimmed.indexOf('/context')
    const baseUrl = trimmed.substring(0, contextIndex)
    return `${baseUrl}/api/v1/context`
  }
  
  // Neither is present, append both
  return `${trimmed}/api/v1/context`
}

type ContextTypeHeader = 'organization' | 'personal'

declare global {
  interface Window {
    __SALUNGA_ORG_ID_MAP?: Record<string, string>
  }
}

type UserContext = {
  userId?: string | null
  organizationId?: string | null
  organizationExternalId?: string | null
  organizationName?: string | null
  contextType?: ContextTypeHeader
}

const resolveContextType = (context: UserContext): ContextTypeHeader => {
  if (context.contextType) {
    return context.contextType
  }
  return context.organizationId || context.organizationExternalId ? 'organization' : 'personal'
}

const ensureTrailingSegment = (base: string, segment: string): string => {
  const trimmed = base.replace(/\/+$/, '')
  if (trimmed === '') {
    return `/${segment}`
  }
  return `${trimmed}/${segment}`
}

const resolveServiceBaseUrl = (
  envValue: string | undefined,
  servicePath: string,
  directFallback: string
): string => {
  const fallbackGateway = `http://localhost:8000/api/v1/${servicePath}`

  if (!envValue || !envValue.trim()) {
    return fallbackGateway
  }

  const trimmed = envValue.trim().replace(/\/+$/, '')

  if (trimmed.includes(`/${servicePath}`)) {
    return trimmed
  }

  if (/\/api\/v1(\/|$)/.test(trimmed)) {
    return ensureTrailingSegment(trimmed, servicePath)
  }

  if (trimmed.includes('localhost:8000')) {
    return ensureTrailingSegment(`${trimmed}/api/v1`, servicePath)
  }

  return trimmed || directFallback
}

const applyUserContextHeaders = (headers: Record<string, any>, context: UserContext) => {
  const normalizedUserId = normalizeUserId(context.userId)
  const contextType = resolveContextType(context)

  headers['X-User-Id'] = normalizedUserId

  if (context.organizationId) {
    headers['X-Organization-Id'] = context.organizationId
  } else if ('X-Organization-Id' in headers) {
    delete headers['X-Organization-Id']
  }

  if (context.organizationExternalId) {
    headers['X-Organization-External-Id'] = context.organizationExternalId
  } else if ('X-Organization-External-Id' in headers) {
    delete headers['X-Organization-External-Id']
  }

  if (context.organizationName) {
    headers['X-Organization-Name'] = context.organizationName
  } else if ('X-Organization-Name' in headers) {
    delete headers['X-Organization-Name']
  }

  headers['X-Context-Type'] = contextType
}

const clearUserContextHeaders = (headers: Record<string, any>) => {
  if ('X-User-Id' in headers) {
    delete headers['X-User-Id']
  }
  if ('X-Organization-Id' in headers) {
    delete headers['X-Organization-Id']
  }
  if ('X-Organization-External-Id' in headers) {
    delete headers['X-Organization-External-Id']
  }
  if ('X-Organization-Name' in headers) {
    delete headers['X-Organization-Name']
  }
  if ('X-Context-Type' in headers) {
    delete headers['X-Context-Type']
  }
}

export class ApiClient {
  private client: AxiosInstance
  private apiKey?: string

  constructor(options: ApiClientOptions) {
    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()

    if (options.apiKey) {
      this.setApiKey(options.apiKey)
    }
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and organization context
    this.client.interceptors.request.use(
      async (config) => {
        // Check if we're in test mode with mock auth
        const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

        if (typeof window !== 'undefined') {
          try {
            if (isTestMode) {
              // Use mock authentication for tests
              config.headers.Authorization = 'Bearer mock-test-token'
              applyUserContextHeaders(config.headers as Record<string, any>, {
                userId: 'test-user-id',
                contextType: 'personal',
              })
            } else {
              // Use real Clerk authentication for production
              const Clerk = (window as any).Clerk
              if (Clerk && Clerk.session) {
                const token = await Clerk.session.getToken()
                if (token) {
                  config.headers.Authorization = `Bearer ${token}`
                }

                // Add organization context headers
                const user = Clerk.user
                const organization = Clerk.organization

                const contextType: ContextTypeHeader = organization ? 'organization' : 'personal'
                const orgMapping =
                  ((window as any).__SALUNGA_ORG_ID_MAP as Record<string, string> | undefined) ??
                  undefined
                const externalOrgId = organization?.id ?? null
                const internalOrgId =
                  externalOrgId && orgMapping ? (orgMapping[externalOrgId] ?? null) : null
                const organizationName = organization?.name ?? null

                applyUserContextHeaders(config.headers as Record<string, any>, {
                  userId: user?.id ?? (config.headers['X-User-Id'] as string | undefined),
                  organizationId: internalOrgId,
                  organizationExternalId: externalOrgId,
                  organizationName,
                  contextType,
                })
              }
            }
          } catch (error) {
            // Silently fail - API will return appropriate error
            console.debug('Could not get auth token:', error)
          }
        }

        if (this.apiKey) {
          const headers = config.headers as Record<string, any>
          headers['X-API-Key'] = this.apiKey
          const authHeader = headers['Authorization'] ?? headers['authorization']
          if (
            !authHeader ||
            (typeof authHeader === 'string' && !authHeader.toLowerCase().startsWith('bearer'))
          ) {
            headers['Authorization'] = `ApiKey ${this.apiKey}`
          }
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling and case conversion
    this.client.interceptors.response.use(
      (response) => {
        // Handle 204 No Content responses for void operations
        if (response.status === 204) {
          response.data = undefined
        }
        // Convert snake_case keys to camelCase for responses from Rust backend
        if (response.data) {
          response.data = convertKeysToCamelCase(response.data)
        }
        return response
      },
      (error) => {
        // Log the error for debugging but don't break the UI
        console.warn('API request failed:', error.message, 'URL:', error.config?.url)

        if (error.response?.status === 401) {
          console.warn('Unauthorized API request - this is expected if backend is not configured')
          // Don't redirect in production for demo purposes
          // window.location.href = '/sign-in'
        }

        // Check if this is a connection error (likely due to localhost URLs)
        if (error.code === 'ERR_NETWORK' || error.message.includes('localhost')) {
          console.warn('Network error - likely localhost API URLs not available in production')
          // Return empty data instead of throwing
          return Promise.resolve({ data: null, status: 404, statusText: 'Service Unavailable' })
        }

        return Promise.reject(error)
      }
    )
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config)
    return response.data
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config)
    return response.data
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config)
    return response.data
  }

  setUserContext(context?: UserContext) {
    const headers = this.client.defaults.headers.common as Record<string, any>
    if (!context) {
      clearUserContextHeaders(headers)
      return
    }
    applyUserContextHeaders(headers, context)
  }

  clearUserContext() {
    const headers = this.client.defaults.headers.common as Record<string, any>
    clearUserContextHeaders(headers)
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  clearAuthToken() {
    const headers = this.client.defaults.headers.common as Record<string, any>
    if ('Authorization' in headers) {
      delete headers['Authorization']
    }
  }

  removeAuthToken() {
    this.clearAuthToken()
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey
    const headers = this.client.defaults.headers.common as Record<string, any>
    headers['X-API-Key'] = apiKey
    const authHeader = headers['Authorization']
    if (
      !authHeader ||
      (typeof authHeader === 'string' && !authHeader.toLowerCase().startsWith('bearer'))
    ) {
      headers['Authorization'] = `ApiKey ${apiKey}`
    }
  }

  removeApiKey() {
    this.apiKey = undefined
    const headers = this.client.defaults.headers.common as Record<string, any>
    if ('X-API-Key' in headers) {
      delete headers['X-API-Key']
    }
    const authHeader = headers['Authorization']
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('apikey')) {
      delete headers['Authorization']
    }
  }
}

// Create service-specific clients
export const projectsClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_PROJECTS_API_URL || 'http://localhost:8001',
})

export const backlogClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_BACKLOG_API_URL || 'http://localhost:8002',
})

export const readinessClient = new ApiClient({
  baseURL: resolveServiceBaseUrl(
    process.env.NEXT_PUBLIC_READINESS_API_URL,
    'readiness',
    'http://localhost:8003'
  ),
})

export const promptBuilderClient = new ApiClient({
  baseURL: resolveServiceBaseUrl(
    process.env.NEXT_PUBLIC_PROMPT_BUILDER_API_URL,
    'prompt-builder',
    'http://localhost:8004'
  ),
})

export const orchestratorClient = new ApiClient({
  baseURL: resolveOrchestratorBaseUrl(),
  timeout: 15000, // Longer timeout for LLM processing
})

export const authGatewayClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_GATEWAY_API_URL || 'http://localhost:8000',
})

export const sprintClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_SPRINT_API_URL || 'http://localhost:8000/api/v1',
})

const ALL_CLIENTS = [
  projectsClient,
  backlogClient,
  readinessClient,
  promptBuilderClient,
  orchestratorClient,
  authGatewayClient,
  sprintClient,
]

const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_BATTRA_API_KEY
if (DEFAULT_API_KEY) {
  // Preconfigure API key for local dev / persona simulation
  ALL_CLIENTS.forEach((client) => client.setApiKey(DEFAULT_API_KEY))
}

export function setGlobalAuthToken(token?: string) {
  if (token) {
    ALL_CLIENTS.forEach((client) => client.setAuthToken(token))
    return
  }

  ALL_CLIENTS.forEach((client) => client.clearAuthToken())
}

export function setGlobalApiKey(apiKey?: string) {
  if (apiKey) {
    ALL_CLIENTS.forEach((client) => client.setApiKey(apiKey))
    return
  }

  ALL_CLIENTS.forEach((client) => client.removeApiKey())
}

// Function to setup authenticated clients (non-hook version)
export async function setupAuthenticatedClients() {
  if (typeof window === 'undefined') {
    // Server side, skip auth setup
    return
  }

  try {
    // Check if we're in test mode
    const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

    if (isTestMode) {
      // In test mode, set mock token on all clients
      const mockToken = 'mock-test-token'
      projectsClient.setAuthToken(mockToken)
      backlogClient.setAuthToken(mockToken)
      readinessClient.setAuthToken(mockToken)
      promptBuilderClient.setAuthToken(mockToken)
      orchestratorClient.setAuthToken(mockToken)
      authGatewayClient.setAuthToken(mockToken)
    } else {
      // In production, use Clerk via interceptors
      // The interceptor will handle auth automatically
      console.debug('Authentication will be handled by API client interceptors')
    }
  } catch (error) {
    console.error('Failed to setup auth:', error)
  }
}

// Hook to setup authenticated clients (client-side only)
// Returns a stable function reference suitable for useEffect deps
export function useApiClient() {
  return { setupClients: setupAuthenticatedClients }
}
