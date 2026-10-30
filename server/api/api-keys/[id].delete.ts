import { initDataSource } from '../../database/data-source'
import { ApiKeySchema } from '../../database/entities'
import { requireApiKeyManageable, requirePermission } from '../../utils/auth'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'
import { disconnectDashboardApiKey } from '../../services/broadcastService'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'apiKeys:manage')
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
  requireApiKeyManageable(admin, apiKey)

  await repo.remove(apiKey)
  clearApiKeyCache()
  disconnectDashboardApiKey(apiKey.id)
  recordAudit(admin, 'apiKey.delete', apiKey.name)
  return { ok: true }
})
