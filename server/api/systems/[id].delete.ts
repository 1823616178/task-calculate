import { initDataSource } from '../../database/data-source'
import { SystemSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { requireAdmin } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'

// 删除系统：指标/记录/ApiKey 级联删除
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
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

  await repo.remove(system)
  clearMetricCache()
  recordAudit(admin, 'system.delete', system.code)
  return { ok: true }
})
