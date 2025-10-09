import { auth } from '@clerk/nextjs/server'
import { normalizeUserId } from '@/lib/utils/uuid'

export async function getAuthHeaders() {
  const authResult = await auth()
  if (!('getToken' in authResult) || typeof authResult.getToken !== 'function') {
    return new Headers()
  }

  const token = await authResult.getToken()
  const { userId, orgId } = authResult

  const headers = new Headers()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const contextType = orgId ? 'organization' : 'personal'
  headers.set('X-Context-Type', contextType)

  if (orgId) {
    headers.set('X-Organization-Id', orgId)
  }

  headers.set('X-User-Id', normalizeUserId(userId))

  return headers
}
