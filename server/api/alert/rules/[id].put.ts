import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { firstZodMessage, alertRuleSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
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

  const data = parsed.data
  if (data.notifyWarning !== undefined) rule.notifyWarning = data.notifyWarning
  if (data.notifyAlarm !== undefined) rule.notifyAlarm = data.notifyAlarm
  if (data.cooldownSeconds !== undefined) rule.cooldownSeconds = data.cooldownSeconds
  if (data.enabled !== undefined) rule.enabled = data.enabled
  await repo.save(rule)
  recordAudit(admin, 'rule.update', String(rule.id), { notifyWarning: rule.notifyWarning, notifyAlarm: rule.notifyAlarm, cooldownSeconds: rule.cooldownSeconds, enabled: rule.enabled })
  return { rule }
})
