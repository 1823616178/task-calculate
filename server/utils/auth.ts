import type { H3Event } from 'h3'
import { createError, getCookie, getHeader } from 'h3'
import type { ApiPermission, UserRole } from '../../shared/types'
import type { ApiKeyEntity } from '../database/entities'
import { resolveApiKey } from './apiKey'
import { verifyAuthToken } from './jwt'
import type { AuthTokenPayload } from './jwt'

export const AUTH_COOKIE = 'tc_token'
export const API_KEY_COOKIE = 'tc_api_key'

export type AuthPrincipal =
  | ({ kind: 'user' } & AuthTokenPayload)
  | { kind: 'apiKey', apiKey: ApiKeyEntity }

export interface AuthUserView {
  id: number
  username: string
  role: UserRole
  authType: 'user' | 'apiKey'
  permissions: ApiPermission[]
  systemIds: number[]
  allSystems: boolean
}

export function getAuthUser(event: H3Event): AuthTokenPayload | null {
  const cookieToken = getCookie(event, AUTH_COOKIE)
  const header = getHeader(event, 'authorization')
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null)
  if (!token) return null
  return verifyAuthToken(token)
}

export function getPresentedApiKey(event: H3Event): string | undefined {
  return getHeader(event, 'x-api-key') || getCookie(event, API_KEY_COOKIE)
}

export async function getAuthPrincipal(event: H3Event): Promise<AuthPrincipal | null> {
  const user = getAuthUser(event)
  if (user) return { kind: 'user', ...user }

  const apiKey = await resolveApiKey(getPresentedApiKey(event))
  return apiKey ? { kind: 'apiKey', apiKey } : null
}

export async function requireAuth(event: H3Event): Promise<AuthPrincipal> {
  const principal = await getAuthPrincipal(event)
  if (!principal) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
  return principal
}

export function hasPermission(principal: AuthPrincipal, permission: ApiPermission): boolean {
  if (principal.kind === 'user') {
    return principal.role === 'admin' || permission === 'data:read'
  }
  return principal.apiKey.permissions.includes(permission)
}

export async function requirePermission(event: H3Event, permission: ApiPermission): Promise<AuthPrincipal> {
  const principal = await requireAuth(event)
  if (!hasPermission(principal, permission)) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  return principal
}

export function principalCanAccessSystem(principal: AuthPrincipal, systemId: number): boolean {
  return principal.kind === 'user'
    || principal.apiKey.allSystems
    || principal.apiKey.systemIds.includes(systemId)
}

export function requireSystemAccess(principal: AuthPrincipal, systemId: number): void {
  if (!principalCanAccessSystem(principal, systemId)) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
}

export function requireAllSystems(principal: AuthPrincipal): void {
  if (principal.kind === 'apiKey' && !principal.apiKey.allSystems) {
    throw createError({ statusCode: 403, statusMessage: 'all-systems permission required' })
  }
}

export function requireApiKeyGrant(
  principal: AuthPrincipal,
  permissions: ApiPermission[],
  systemIds: number[],
  allSystems: boolean,
): void {
  if (principal.kind === 'user') return
  if (permissions.some(permission => !principal.apiKey.permissions.includes(permission))) {
    throw createError({ statusCode: 403, statusMessage: 'cannot grant permissions not held by current api key' })
  }
  if (allSystems && !principal.apiKey.allSystems) {
    throw createError({ statusCode: 403, statusMessage: 'cannot grant all-systems scope' })
  }
  if (!allSystems && !principal.apiKey.allSystems && systemIds.some(id => !principal.apiKey.systemIds.includes(id))) {
    throw createError({ statusCode: 403, statusMessage: 'cannot grant systems outside current api key scope' })
  }
}

export function requireApiKeyManageable(principal: AuthPrincipal, target: ApiKeyEntity): void {
  requireApiKeyGrant(principal, target.permissions, target.systemIds, target.allSystems)
}

export function principalView(principal: AuthPrincipal): AuthUserView {
  if (principal.kind === 'user') {
    return {
      id: principal.userId,
      username: principal.username,
      role: principal.role,
      authType: 'user',
      permissions: [],
      systemIds: [],
      allSystems: true,
    }
  }
  const permissions = principal.apiKey.permissions
  const hasManagement = permissions.some(permission => permission !== 'data:read' && permission !== 'data:write')
  return {
    id: -principal.apiKey.id,
    username: principal.apiKey.name,
    role: hasManagement ? 'admin' : 'viewer',
    authType: 'apiKey',
    permissions,
    systemIds: principal.apiKey.systemIds,
    allSystems: principal.apiKey.allSystems,
  }
}
