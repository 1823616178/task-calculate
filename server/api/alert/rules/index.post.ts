import { initDataSource } from '../../../database/data-source'
import { AlertChannelSchema, AlertRuleSchema, MetricSchema } from '../../../database/entities'
import { requirePermission, requireSystemAccess } from '../../../utils/auth'
import { firstZodMessage, alertRuleSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'alerts:manage')
  const parsed = alertRuleSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const data = parsed.data

  const ds = await initDataSource()
  const metric = await ds.getRepository(MetricSchema).findOne({ where: { id: data.metricId } })
  if (!metric) {
    throw createError({ statusCode: 404, statusMessage: 'metric not found' })
  }
  requireSystemAccess(admin, metric.systemId)
  const channel = await ds.getRepository(AlertChannelSchema).findOne({ where: { id: data.channelId } })
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'channel not found' })
  }

  const repo = ds.getRepository(AlertRuleSchema)
  const exists = await repo.findOne({ where: { metricId: data.metricId, channelId: data.channelId } })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: '该指标与渠道的规则已存在' })
  }

  const saved = await repo.save(
    repo.create({
      metricId: data.metricId,
      channelId: data.channelId,
      notifyWarning: data.notifyWarning,
      notifyAlarm: data.notifyAlarm,
      cooldownSeconds: data.cooldownSeconds,
      enabled: data.enabled ?? true,
    }),
  )
  recordAudit(admin, 'rule.create', `${metric.code} → ${channel.name}`, { notifyWarning: data.notifyWarning, notifyAlarm: data.notifyAlarm, cooldownSeconds: data.cooldownSeconds })
  return { rule: saved }
})
