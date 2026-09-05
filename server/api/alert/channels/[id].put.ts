import { initDataSource } from '../../../database/data-source'
import { AlertChannelSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { firstZodMessage, alertChannelSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const parsed = alertChannelSchema.partial().safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(AlertChannelSchema)
  const channel = await repo.findOne({ where: { id } })
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'channel not found' })
  }

  if (parsed.data.type !== undefined) channel.type = parsed.data.type
  if (parsed.data.name !== undefined) channel.name = parsed.data.name
  if (parsed.data.target !== undefined) channel.target = parsed.data.target
  if (parsed.data.secret !== undefined) channel.secret = parsed.data.secret ?? null
  if (parsed.data.enabled !== undefined) channel.enabled = parsed.data.enabled
  await repo.save(channel)
  recordAudit(admin, 'channel.update', channel.name, { type: channel.type, enabled: channel.enabled })
  return { channel }
})
