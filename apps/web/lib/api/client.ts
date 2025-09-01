import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuth } from '@clerk/nextjs'

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
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        // Token will be added by the hook wrapper
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          window.location.href = '/sign-in'
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

// Hook to setup authenticated clients
export function useApiClient() {
  const { getToken } = useAuth()

  const setupClients = async () => {
    const token = await getToken()
    if (token) {
      projectsClient.setAuthToken(token)
      backlogClient.setAuthToken(token)
      readinessClient.setAuthToken(token)
      promptBuilderClient.setAuthToken(token)
      orchestratorClient.setAuthToken(token)
    }
  }

  return { setupClients }
}