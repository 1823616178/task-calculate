import { In } from 'typeorm'
import { initDataSource } from '../../database/data-source'
import { ApiKeySchema, SystemSchema } from '../../database/entities'
import { requireApiKeyGrant, requireApiKeyManageable, requirePermission } from '../../utils/auth'
import { firstZodMessage, apiKeyUpdateSchema } from '../../utils/validation'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'
import { disconnectDashboardApiKey } from '../../services/broadcastService'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'apiKeys:manage')
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
  requireApiKeyManageable(admin, apiKey)

  const allSystems = parsed.data.allSystems ?? apiKey.allSystems
  const systemIds = allSystems ? [] : [...new Set(parsed.data.systemIds ?? apiKey.systemIds)]
  const permissions = [...new Set(parsed.data.permissions ?? apiKey.permissions)]
  requireApiKeyGrant(admin, permissions, systemIds, allSystems)
  if (!allSystems) {
    if (systemIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'systemIds must not be empty unless allSystems is true' })
    }
    const systems = await ds.getRepository(SystemSchema).findBy({ id: In(systemIds) })
    if (systems.length !== systemIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'systemIds contains unknown system' })
    }
  }

  if (parsed.data.name !== undefined) apiKey.name = parsed.data.name
  if (parsed.data.enabled !== undefined) apiKey.enabled = parsed.data.enabled
  apiKey.systemIds = systemIds
  apiKey.allSystems = allSystems
  apiKey.permissions = permissions
  await repo.save(apiKey)
  clearApiKeyCache()
  disconnectDashboardApiKey(apiKey.id)
  recordAudit(admin, 'apiKey.update', String(apiKey.id), { name: apiKey.name, enabled: apiKey.enabled, systemIds, allSystems, permissions })
  return { apiKey: { id: apiKey.id, systemIds, allSystems, permissions, name: apiKey.name, enabled: apiKey.enabled } }
})
