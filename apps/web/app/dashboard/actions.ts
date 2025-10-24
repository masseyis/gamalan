'use server'

import { auth } from '@clerk/nextjs/server'
import { projectsClient, backlogClient } from '@/lib/api/client'

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
    organizationExternalId: authResult.orgId,
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

import { Story } from '@/lib/types/story'

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
    organizationExternalId: authResult.orgId,
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
