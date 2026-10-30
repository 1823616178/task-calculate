import { describe, expect, it } from 'vitest'
import type { ApiKeyEntity } from '../server/database/entities'
import type { AuthPrincipal } from '../server/utils/auth'
import {
  hasPermission,
  principalCanAccessSystem,
  principalView,
  requireApiKeyGrant,
  requireAllSystems,
} from '../server/utils/auth'

function keyPrincipal(overrides: Partial<ApiKeyEntity> = {}): AuthPrincipal {
  return {
    kind: 'apiKey',
    apiKey: {
      id: 8,
      name: '集成服务',
      permissions: ['data:read', 'apiKeys:manage'],
      systemIds: [1, 2],
      allSystems: false,
      ...overrides,
    } as ApiKeyEntity,
  }
}

describe('ApiKey 权限与系统范围', () => {
  it('能力和系统范围分别校验', () => {
    const principal = keyPrincipal()
    expect(hasPermission(principal, 'data:read')).toBe(true)
    expect(hasPermission(principal, 'data:write')).toBe(false)
    expect(principalCanAccessSystem(principal, 1)).toBe(true)
    expect(principalCanAccessSystem(principal, 3)).toBe(false)
  })

  it('allSystems 可访问现有与未来系统', () => {
    const principal = keyPrincipal({ allSystems: true, systemIds: [] })
    expect(principalCanAccessSystem(principal, 999)).toBe(true)
    expect(() => requireAllSystems(principal)).not.toThrow()
  })

  it('Key 不能下放自身没有的权限或系统范围', () => {
    const principal = keyPrincipal()
    expect(() => requireApiKeyGrant(principal, ['data:read'], [1], false)).not.toThrow()
    expect(() => requireApiKeyGrant(principal, ['users:manage'], [1], false))
      .toThrow(expect.objectContaining({ statusCode: 403 }))
    expect(() => requireApiKeyGrant(principal, ['data:read'], [3], false))
      .toThrow(expect.objectContaining({ statusCode: 403 }))
    expect(() => requireApiKeyGrant(principal, ['data:read'], [1], true))
      .toThrow(expect.objectContaining({ statusCode: 403 }))
  })

  it('控制台身份保留 Key 的权限与系统集合', () => {
    expect(principalView(keyPrincipal())).toMatchObject({
      id: -8,
      username: '集成服务',
      authType: 'apiKey',
      role: 'admin',
      permissions: ['data:read', 'apiKeys:manage'],
      systemIds: [1, 2],
      allSystems: false,
    })
  })
})
