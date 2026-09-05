import { initDataSource } from '../../database/data-source'
import { ApiKeySchema } from '../../database/entities'
import { requireAdmin } from '../../utils/auth'
import { maskApiKey } from '../../utils/apiKeyGen'

// ApiKey 列表（脱敏）；systemId 过滤指定系统的 Key
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const systemIdRaw = getQuery(event).systemId
  const systemId = systemIdRaw !== undefined ? Number(systemIdRaw) : undefined
  if (systemId !== undefined && (!Number.isInteger(systemId) || systemId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid systemId' })
  }

  const ds = await initDataSource()
  const list = await ds.getRepository(ApiKeySchema).find({
    where: systemId !== undefined ? { systemId } : undefined,
    order: { id: 'ASC' },
  })
  return {
    apiKeys: list.map(k => ({
      id: k.id,
      systemId: k.systemId,
      name: k.name,
      maskedKey: maskApiKey(k.key),
      enabled: k.enabled,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  }
})
