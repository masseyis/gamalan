'use server'

import { auth } from '@clerk/nextjs/server'
import { ApiClient } from './client'

async function buildClient(baseURL: string) {
  const client = new ApiClient({ baseURL })
  const authResult = await auth()

  if (!('getToken' in authResult) || typeof authResult.getToken !== 'function') {
    client.removeAuthToken()
    client.clearUserContext()
    return client
  }

  const token = await authResult.getToken()

  client.setUserContext({
    userId: authResult.userId,
    organizationExternalId: authResult.orgId,
  })

  if (token) {
    client.setAuthToken(token)
  } else {
    client.removeAuthToken()
    client.clearUserContext()
  }

  return client
}

export const getAuthenticatedProjectsClient = async () =>
  buildClient(process.env.NEXT_PUBLIC_PROJECTS_API_URL || 'http://localhost:8000/api/v1')

export const getAuthenticatedBacklogClient = async () =>
  buildClient(process.env.NEXT_PUBLIC_BACKLOG_API_URL || 'http://localhost:8000/api/v1')

export const getAuthenticatedReadinessClient = async () =>
  buildClient(process.env.NEXT_PUBLIC_READINESS_API_URL || 'http://localhost:8000/api/v1')

export const getAuthenticatedPromptBuilderClient = async () =>
  buildClient(process.env.NEXT_PUBLIC_PROMPT_BUILDER_API_URL || 'http://localhost:8000/api/v1')

export const getAuthenticatedOrchestratorClient = async () =>
  buildClient(
    process.env.NEXT_PUBLIC_ORCHESTRATOR_API_URL || 'http://localhost:8000/api/v1/context'
  )

export const getAuthenticatedAuthGatewayClient = async () =>
  buildClient(process.env.NEXT_PUBLIC_AUTH_GATEWAY_API_URL || 'http://localhost:8000/api/v1')
