import { initDataSource } from '../../database/data-source'
import { ApiKeySchema } from '../../database/entities'
import { requireAdmin } from '../../utils/auth'
import { firstZodMessage, apiKeyUpdateSchema } from '../../utils/validation'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const parsed = apiKeyUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(ApiKeySchema)
  const apiKey = await repo.findOne({ where: { id } })
  if (!apiKey) {
    throw createError({ statusCode: 404, statusMessage: 'api key not found' })
  }

  if (parsed.data.name !== undefined) apiKey.name = parsed.data.name
  if (parsed.data.enabled !== undefined) apiKey.enabled = parsed.data.enabled
  await repo.save(apiKey)
  clearApiKeyCache()
  recordAudit(admin, 'apiKey.update', String(apiKey.id), { name: apiKey.name, enabled: apiKey.enabled })
  return { ok: true }
})
