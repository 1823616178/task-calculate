import type { H3Event } from 'h3'
import { createError, getRequestIP } from 'h3'
import { initDataSource } from '../database/data-source'
import { MetricSchema } from '../database/entities'
import type { MetricEntity, SystemEntity } from '../database/entities'
import type { AuthPrincipal } from './auth'
import { getAuthPrincipal, principalCanAccessSystem } from './auth'
import { rateLimit } from './rateLimit'

export type ReadPrincipal = AuthPrincipal

const READ_RATE_PER_SEC = 5
const READ_RATE_BURST = 20
const IP_RATE_PER_SEC = 20
const IP_RATE_BURST = 50

export async function requireReadAccess(event: H3Event): Promise<ReadPrincipal> {
  const principal = await getAuthPrincipal(event)
  if (!principal) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
  if (principal.kind === 'user') return principal
  if (!principal.apiKey.permissions.includes('data:read')) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }

  const ip = getRequestIP(event) ?? 'unknown'
  if (!rateLimit(`read-ip:${ip}`, IP_RATE_PER_SEC, IP_RATE_BURST)) {
    throw createError({ statusCode: 429, statusMessage: 'rate limited' })
  }
  if (!rateLimit(`read:${principal.apiKey.id}`, READ_RATE_PER_SEC, READ_RATE_BURST)) {
    throw createError({ statusCode: 429, statusMessage: 'rate limited' })
  }
  return principal
}

export function assertSystemReadable(principal: ReadPrincipal, system: SystemEntity | null): asserts system is SystemEntity {
  if (principal.kind === 'apiKey') {
    if (!system || !principalCanAccessSystem(principal, system.id)) {
      throw createError({ statusCode: 403, statusMessage: 'forbidden' })
    }
    return
  }
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }
}

export function assertMetricReadable(principal: ReadPrincipal, metric: MetricEntity | null): asserts metric is MetricEntity {
  if (principal.kind === 'apiKey') {
    if (!metric || !principalCanAccessSystem(principal, metric.systemId)) {
      throw createError({ statusCode: 403, statusMessage: 'forbidden' })
    }
    return
  }
  if (!metric) {
    throw createError({ statusCode: 404, statusMessage: 'metric not found' })
  }
}

interface SystemScopedQuery {
  systemId?: number
  systemIds?: number[]
  metricId?: number
}

export async function scopeReadQuery<T extends SystemScopedQuery>(principal: ReadPrincipal, query: T): Promise<T & { systemIds?: number[] }> {
  if (principal.kind === 'user' || principal.apiKey.allSystems) return query

  if (query.systemId !== undefined && !principal.apiKey.systemIds.includes(query.systemId)) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  if (query.metricId !== undefined) {
    const ds = await initDataSource()
    const metric = await ds.getRepository(MetricSchema).findOne({ where: { id: query.metricId } })
    assertMetricReadable(principal, metric)
  }

  return query.systemId === undefined
    ? { ...query, systemIds: principal.apiKey.systemIds }
    : query
}
