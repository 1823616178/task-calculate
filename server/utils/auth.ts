import type { H3Event } from 'h3'
import { createError, getCookie, getHeader } from 'h3'
import { verifyAuthToken } from './jwt'
import type { AuthTokenPayload } from './jwt'

export const AUTH_COOKIE = 'tc_token'

export function getAuthUser(event: H3Event): AuthTokenPayload | null {
  const cookieToken = getCookie(event, AUTH_COOKIE)
  const header = getHeader(event, 'authorization')
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null)
  if (!token) return null
  return verifyAuthToken(token)
}

export function requireAuth(event: H3Event): AuthTokenPayload {
  const user = getAuthUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
  return user
}

export function requireAdmin(event: H3Event): AuthTokenPayload {
  const user = requireAuth(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  return user
}
