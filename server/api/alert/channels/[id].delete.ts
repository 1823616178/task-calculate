import { initDataSource } from '../../../database/data-source'
import { AlertChannelSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { recordAudit } from '../../../utils/audit'

// 删除渠道：关联的告警规则级联删除
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(AlertChannelSchema)
  const channel = await repo.findOne({ where: { id } })
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'channel not found' })
  }

  await repo.remove(channel)
  recordAudit(admin, 'channel.delete', channel.name)
  return { ok: true }
})
