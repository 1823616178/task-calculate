import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema, MetricSchema } from '../../../database/entities'
import { requirePermission, requireSystemAccess } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'alerts:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(AlertRuleSchema)
  const rule = await repo.findOne({ where: { id } })
  if (!rule) {
    throw createError({ statusCode: 404, statusMessage: 'rule not found' })
  }
  const metric = await ds.getRepository(MetricSchema).findOne({ where: { id: rule.metricId } })
  if (!metric) throw createError({ statusCode: 404, statusMessage: 'metric not found' })
  requireSystemAccess(admin, metric.systemId)

  await repo.remove(rule)
  recordAudit(admin, 'rule.delete', String(rule.id))
  return { ok: true }
})
