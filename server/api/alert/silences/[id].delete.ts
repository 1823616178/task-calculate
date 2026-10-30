import { initDataSource } from '../../../database/data-source'
import { MetricSchema, SilenceRuleSchema } from '../../../database/entities'
import { requireAllSystems, requirePermission, requireSystemAccess } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'alerts:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(SilenceRuleSchema)
  const silence = await repo.findOne({ where: { id } })
  if (!silence) {
    throw createError({ statusCode: 404, statusMessage: 'silence not found' })
  }
  if (silence.metricId !== null) {
    const metric = await ds.getRepository(MetricSchema).findOne({ where: { id: silence.metricId } })
    if (!metric) throw createError({ statusCode: 404, statusMessage: 'metric not found' })
    requireSystemAccess(admin, metric.systemId)
  }
  else if (silence.systemId !== null) {
    requireSystemAccess(admin, silence.systemId)
  }
  else {
    requireAllSystems(admin)
  }

  await repo.remove(silence)
  recordAudit(admin, 'silence.delete', String(silence.id))
  return { ok: true }
})
