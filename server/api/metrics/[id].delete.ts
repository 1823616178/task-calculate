import { initDataSource } from '../../database/data-source'
import { MetricSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { requireAdmin } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(MetricSchema)
  const metric = await repo.findOne({ where: { id } })
  if (!metric) {
    throw createError({ statusCode: 404, statusMessage: 'metric not found' })
  }

  await repo.remove(metric)
  clearMetricCache()
  recordAudit(admin, 'metric.delete', `${metric.systemId}/${metric.code}`)
  return { ok: true }
})
