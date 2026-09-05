import { initDataSource } from '../../database/data-source'
import { ApiKeySchema } from '../../database/entities'
import { requireAdmin } from '../../utils/auth'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(ApiKeySchema)
  const apiKey = await repo.findOne({ where: { id } })
  if (!apiKey) {
    throw createError({ statusCode: 404, statusMessage: 'api key not found' })
  }

  await repo.remove(apiKey)
  clearApiKeyCache()
  recordAudit(admin, 'apiKey.delete', `${apiKey.systemId}/${apiKey.name}`)
  return { ok: true }
})
