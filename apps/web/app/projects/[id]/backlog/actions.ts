'use server'

import { auth } from '@clerk/nextjs/server'
import { backlogClient, projectsClient } from '@/lib/api/client'

import { Story } from '@/lib/types/story'
import { Project } from '@/lib/types/project'

export async function getStories(projectId: string): Promise<Story[]> {
  const authResult = await auth()

  if (!('getToken' in authResult) || typeof authResult.getToken !== 'function') {
    backlogClient.removeAuthToken()
    backlogClient.clearUserContext()
    return []
  }

  const token = await authResult.getToken()

  backlogClient.setUserContext({
    userId: authResult.userId,
    organizationId: authResult.orgId,
  })

  if (token) {
    backlogClient.setAuthToken(token)
  } else {
    backlogClient.removeAuthToken()
    backlogClient.clearUserContext()
    return []
  }

  return backlogClient.get(`/projects/${projectId}/stories`)
}

export async function getProject(projectId: string): Promise<Project | null> {
  const authResult = await auth()

  if (!('getToken' in authResult) || typeof authResult.getToken !== 'function') {
    projectsClient.removeAuthToken()
    projectsClient.clearUserContext()
    return null
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
    return null
  }

  return projectsClient.get(`/projects/${projectId}`)
}
