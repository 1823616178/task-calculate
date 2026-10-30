import { initDataSource } from '../../database/data-source'
import { ApiKeySchema } from '../../database/entities'
import { requireApiKeyManageable, requirePermission, requireSystemAccess } from '../../utils/auth'
import { maskApiKey } from '../../utils/apiKeyGen'

// ApiKey 列表（脱敏）；systemId 过滤指定系统的 Key
export default defineEventHandler(async (event) => {
  const principal = await requirePermission(event, 'apiKeys:manage')
  const systemIdRaw = getQuery(event).systemId
  const systemId = systemIdRaw !== undefined ? Number(systemIdRaw) : undefined
  if (systemId !== undefined && (!Number.isInteger(systemId) || systemId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid systemId' })
  }
  if (systemId !== undefined) requireSystemAccess(principal, systemId)

  const ds = await initDataSource()
  const all = await ds.getRepository(ApiKeySchema).find({ order: { id: 'ASC' } })
  const list = all.filter((key) => {
    if (systemId !== undefined && !key.allSystems && !key.systemIds.includes(systemId)) return false
    try {
      requireApiKeyManageable(principal, key)
      return true
    }
    catch {
      return false
    }
  })
  return {
    apiKeys: list.map(k => ({
      id: k.id,
      systemIds: k.systemIds,
      allSystems: k.allSystems,
      permissions: k.permissions,
      name: k.name,
      maskedKey: maskApiKey(k.keyPrefix),
      enabled: k.enabled,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  }
})
