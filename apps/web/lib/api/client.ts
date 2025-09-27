import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export interface ApiClientOptions {
  baseURL: string
  timeout?: number
}

class ApiClient {
  private client: AxiosInstance

  constructor(options: ApiClientOptions) {
    this.client = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
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
              config.headers['X-User-Id'] = 'test-user-id'
              config.headers['X-Context-Type'] = 'personal'
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

                if (organization) {
                  config.headers['X-Organization-Id'] = organization.id
                  config.headers['X-Context-Type'] = 'organization'
                } else if (user) {
                  config.headers['X-User-Id'] = user.id
                  config.headers['X-Context-Type'] = 'personal'
                }
              }
            }
          } catch (error) {
            // Silently fail - API will return appropriate error
            console.debug('Could not get auth token:', error)
          }
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Handle 204 No Content responses for void operations
        if (response.status === 204) {
          response.data = undefined
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

  setAuthToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  removeAuthToken() {
    delete this.client.defaults.headers.common['Authorization']
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
  baseURL: process.env.NEXT_PUBLIC_READINESS_API_URL || 'http://localhost:8003',
})

export const promptBuilderClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_PROMPT_BUILDER_API_URL || 'http://localhost:8004',
})

export const orchestratorClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_ORCHESTRATOR_API_URL || 'http://localhost:8005',
  timeout: 15000, // Longer timeout for LLM processing
})

export const authGatewayClient = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_GATEWAY_API_URL || 'http://localhost:8000',
})

// Function to setup authenticated clients (non-hook version)
export async function setupAuthenticatedClients() {
  if (typeof window === 'undefined') {
    // Server side, skip auth setup
    return
  }

  try {
    // Auth setup is handled by the API client interceptors
    console.log('Auth setup skipped - handled by interceptors')
  } catch (error) {
    console.error('Failed to setup auth:', error)
  }
}

// Hook to setup authenticated clients (client-side only)
export function useApiClient() {
  const setupClients = async () => {
    if (typeof window === 'undefined') {
      // Server side, skip
      return
    }

    try {
      // Check if we're in test mode
      const isTestMode = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true'

      if (isTestMode) {
        // In test mode, set mock token
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

  return { setupClients }
}

