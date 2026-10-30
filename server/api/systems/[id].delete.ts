import { initDataSource } from '../../database/data-source'
import { ApiKeySchema, SystemSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { disconnectDashboardApiKey } from '../../services/broadcastService'
import { requirePermission, requireSystemAccess } from '../../utils/auth'
import { clearApiKeyCache } from '../../utils/apiKey'
import { recordAudit } from '../../utils/audit'

// 删除系统：指标/记录级联删除；全局 ApiKey 保留，仅移除该系统的授权范围。
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'systems:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(SystemSchema)
  const system = await repo.findOne({ where: { id } })
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }
  requireSystemAccess(admin, system.id)

  const apiKeyRepo = ds.getRepository(ApiKeySchema)
  const affectedApiKeys = (await apiKeyRepo.find()).filter(apiKey => !apiKey.allSystems && apiKey.systemIds.includes(system.id))
  await repo.remove(system)
  for (const apiKey of affectedApiKeys) {
    await apiKeyRepo.update(apiKey.id, { systemIds: apiKey.systemIds.filter(systemId => systemId !== system.id) })
  }
  clearMetricCache()
  clearApiKeyCache()
  for (const apiKey of affectedApiKeys) disconnectDashboardApiKey(apiKey.id)
  recordAudit(admin, 'system.delete', system.code)
  return { ok: true }
})
