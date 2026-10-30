import { In } from 'typeorm'
import { initDataSource } from '../../database/data-source'
import { ApiKeySchema, SystemSchema } from '../../database/entities'
import { requireApiKeyGrant, requirePermission } from '../../utils/auth'
import { firstZodMessage, apiKeyCreateSchema } from '../../utils/validation'
import { generateApiKey, hashApiKey } from '../../utils/apiKeyGen'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'

// 创建 ApiKey：完整 key 仅本次响应返回一次
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'apiKeys:manage')
  const parsed = apiKeyCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const allSystems = parsed.data.allSystems
  const systemIds = allSystems ? [] : [...new Set(parsed.data.systemIds)]
  const permissions = [...new Set(parsed.data.permissions)]
  requireApiKeyGrant(admin, permissions, systemIds, allSystems)
  if (!allSystems) {
    const count = await ds.getRepository(SystemSchema).countBy({ id: In(systemIds) })
    if (count !== systemIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'systemIds contains unknown system' })
    }
  }

  const repo = ds.getRepository(ApiKeySchema)
  const plainKey = generateApiKey()
  const saved = await repo.save(
    repo.create({
      legacySystemId: null,
      systemIds,
      allSystems,
      permissions,
      key: hashApiKey(plainKey),
      keyPrefix: plainKey.slice(0, 8),
      name: parsed.data.name,
      enabled: true,
    }),
  )
  clearApiKeyCache()
  recordAudit(admin, 'apiKey.create', parsed.data.name, { systemIds, allSystems, permissions })
  return {
    apiKey: {
      id: saved.id,
      systemIds: saved.systemIds,
      allSystems: saved.allSystems,
      permissions: saved.permissions,
      name: saved.name,
      enabled: saved.enabled,
      key: plainKey,
    },
  }
})
