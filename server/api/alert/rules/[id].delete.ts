import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
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

  await repo.remove(rule)
  recordAudit(admin, 'rule.delete', String(rule.id))
  return { ok: true }
})
