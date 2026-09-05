import { initDataSource } from '../../../database/data-source'
import { SilenceRuleSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
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

  await repo.remove(silence)
  recordAudit(admin, 'silence.delete', String(silence.id))
  return { ok: true }
})
