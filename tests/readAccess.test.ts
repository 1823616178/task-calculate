import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import type { ApiKeyEntity, MetricEntity, SystemEntity } from '../server/database/entities'
import type { AuthPrincipal } from '../server/utils/auth'

const getAuthPrincipal = vi.hoisted(() => vi.fn())
const metricRows = vi.hoisted(() => new Map<number, { id: number, systemId: number }>())
vi.mock('../server/utils/auth', () => ({
  getAuthPrincipal,
  principalCanAccessSystem: (principal: AuthPrincipal, systemId: number) => principal.kind === 'user'
    || principal.apiKey.allSystems
    || principal.apiKey.systemIds.includes(systemId),
}))
vi.mock('../server/database/data-source', () => ({
  initDataSource: async () => ({
    getRepository: () => ({
      findOne: async ({ where }: { where: { id: number } }) => metricRows.get(where.id) ?? null,
    }),
  }),
}))
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRequestIP: () => '127.0.0.1',
  }
})

const { assertMetricReadable, assertSystemReadable, requireReadAccess, scopeReadQuery } = await import('../server/utils/readAccess')
const { resetRateLimiter } = await import('../server/utils/rateLimit')

function event(): H3Event {
  return {} as H3Event
}

function keyPrincipal(systemIds = [1, 2], allSystems = false, permissions: ApiKeyEntity['permissions'] = ['data:read']): AuthPrincipal {
  return {
    kind: 'apiKey',
    apiKey: { id: 3, systemIds, allSystems, permissions } as ApiKeyEntity,
  }
}

const userPrincipal: AuthPrincipal = { kind: 'user', userId: 7, username: 'u', role: 'viewer' }
const line1 = { id: 1, code: 'line1' } as SystemEntity
const line2 = { id: 2, code: 'line2' } as SystemEntity
const line3 = { id: 3, code: 'line3' } as SystemEntity

beforeEach(() => {
  getAuthPrincipal.mockReset().mockResolvedValue(null)
  metricRows.clear()
  metricRows.set(10, { id: 10, systemId: 1 })
  metricRows.set(20, { id: 20, systemId: 2 })
  metricRows.set(30, { id: 30, systemId: 3 })
  resetRateLimiter()
})

describe('requireReadAccess', () => {
  it('登录用户可读', async () => {
    getAuthPrincipal.mockResolvedValue(userPrincipal)
    await expect(requireReadAccess(event())).resolves.toBe(userPrincipal)
  })

  it('无有效凭证返回 401', async () => {
    await expect(requireReadAccess(event())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('ApiKey 缺少 data:read 返回 403', async () => {
    getAuthPrincipal.mockResolvedValue(keyPrincipal([1], false, ['data:write']))
    await expect(requireReadAccess(event())).rejects.toMatchObject({ statusCode: 403 })
  })

  it('有效 ApiKey 返回包含权限和多系统范围的身份', async () => {
    const principal = keyPrincipal([1, 2])
    getAuthPrincipal.mockResolvedValue(principal)
    await expect(requireReadAccess(event())).resolves.toBe(principal)
  })

  it('ApiKey 超出读速率返回 429', async () => {
    getAuthPrincipal.mockResolvedValue(keyPrincipal([1]))
    for (let i = 0; i < 20; i++) await requireReadAccess(event())
    await expect(requireReadAccess(event())).rejects.toMatchObject({ statusCode: 429 })
  })
})

describe('assertSystemReadable', () => {
  it('ApiKey 可读授权系统，不可读范围外系统', () => {
    const principal = keyPrincipal([1, 2])
    expect(() => assertSystemReadable(principal, line1)).not.toThrow()
    expect(() => assertSystemReadable(principal, line2)).not.toThrow()
    expect(() => assertSystemReadable(principal, line3)).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('ApiKey 查询不存在系统同样返回 403，防止探测', () => {
    expect(() => assertSystemReadable(keyPrincipal(), null)).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('allSystems Key 和登录用户可读任意系统', () => {
    expect(() => assertSystemReadable(keyPrincipal([], true), line3)).not.toThrow()
    expect(() => assertSystemReadable(userPrincipal, line3)).not.toThrow()
    expect(() => assertSystemReadable(userPrincipal, null)).toThrow(expect.objectContaining({ statusCode: 404 }))
  })
})

describe('ApiKey 读取范围', () => {
  it('指标必须属于 Key 授权系统', () => {
    const principal = keyPrincipal([1, 2])
    expect(() => assertMetricReadable(principal, { id: 10, systemId: 1 } as MetricEntity)).not.toThrow()
    expect(() => assertMetricReadable(principal, { id: 20, systemId: 2 } as MetricEntity)).not.toThrow()
    expect(() => assertMetricReadable(principal, { id: 30, systemId: 3 } as MetricEntity)).toThrow(expect.objectContaining({ statusCode: 403 }))
    expect(() => assertMetricReadable(principal, null)).toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('记录查询未指定系统时自动追加系统集合', async () => {
    await expect(scopeReadQuery(keyPrincipal([1, 2]), { page: 1, pageSize: 20 })).resolves.toEqual({
      page: 1,
      pageSize: 20,
      systemIds: [1, 2],
    })
  })

  it('显式访问范围外系统或指标返回 403', async () => {
    const principal = keyPrincipal([1, 2])
    await expect(scopeReadQuery(principal, { systemId: 3 })).rejects.toMatchObject({ statusCode: 403 })
    await expect(scopeReadQuery(principal, { metricId: 30 })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('allSystems Key 与 JWT 用户的查询条件保持不变', async () => {
    const query = { systemId: 3, metricId: 30, page: 1 }
    await expect(scopeReadQuery(keyPrincipal([], true), query)).resolves.toBe(query)
    await expect(scopeReadQuery(userPrincipal, query)).resolves.toBe(query)
  })
})
