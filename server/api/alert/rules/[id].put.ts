import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema, MetricSchema } from '../../../database/entities'
import { requirePermission, requireSystemAccess } from '../../../utils/auth'
import { firstZodMessage, alertRuleSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'alerts:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const parsed = alertRuleSchema.omit({ metricId: true, channelId: true }).partial().safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
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

  const data = parsed.data
  if (data.notifyWarning !== undefined) rule.notifyWarning = data.notifyWarning
  if (data.notifyAlarm !== undefined) rule.notifyAlarm = data.notifyAlarm
  if (data.cooldownSeconds !== undefined) rule.cooldownSeconds = data.cooldownSeconds
  if (data.enabled !== undefined) rule.enabled = data.enabled
  await repo.save(rule)
  recordAudit(admin, 'rule.update', String(rule.id), { notifyWarning: rule.notifyWarning, notifyAlarm: rule.notifyAlarm, cooldownSeconds: rule.cooldownSeconds, enabled: rule.enabled })
  return { rule }
})
