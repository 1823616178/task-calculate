import { initDataSource } from '../../database/data-source'
import { ApiKeySchema, SystemSchema } from '../../database/entities'
import { requireAdmin } from '../../utils/auth'
import { firstZodMessage, apiKeyCreateSchema } from '../../utils/validation'
import { generateApiKey, hashApiKey } from '../../utils/apiKeyGen'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'

// 创建 ApiKey：完整 key 仅本次响应返回一次
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const parsed = apiKeyCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { id: parsed.data.systemId } })
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }

  const repo = ds.getRepository(ApiKeySchema)
  const plainKey = generateApiKey()
  const saved = await repo.save(
    repo.create({
      systemId: system.id,
      key: hashApiKey(plainKey),
      keyPrefix: plainKey.slice(0, 8),
      name: parsed.data.name,
      enabled: true,
    }),
  )
  clearApiKeyCache()
  recordAudit(admin, 'apiKey.create', `${system.code}/${parsed.data.name}`)
  return { apiKey: { id: saved.id, systemId: saved.systemId, name: saved.name, enabled: saved.enabled, key: plainKey } }
})
