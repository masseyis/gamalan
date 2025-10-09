'use server'

import { auth } from '@clerk/nextjs/server'
import { projectsClient } from '@/lib/api/client'

import { Project } from '@/lib/types/project'

export async function getProjects(): Promise<Project[]> {
  const authResult = await auth()

  if (!('getToken' in authResult) || typeof authResult.getToken !== 'function') {
    projectsClient.removeAuthToken()
    projectsClient.clearUserContext()
    return []
  }

  const token = await authResult.getToken()

  projectsClient.setUserContext({
    userId: authResult.userId,
    organizationId: authResult.orgId,
  })

  if (token) {
    projectsClient.setAuthToken(token)
  } else {
    projectsClient.removeAuthToken()
    projectsClient.clearUserContext()
    return []
  }

  return projectsClient.get('/projects')
}
