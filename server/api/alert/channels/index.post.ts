import { initDataSource } from '../../../database/data-source'
import { AlertChannelSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { firstZodMessage, alertChannelSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const parsed = alertChannelSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(AlertChannelSchema)
  const saved = await repo.save(
    repo.create({
      type: parsed.data.type,
      name: parsed.data.name,
      target: parsed.data.target,
      secret: parsed.data.secret ?? null,
      enabled: parsed.data.enabled ?? true,
    }),
  )
  recordAudit(admin, 'channel.create', parsed.data.name, { type: parsed.data.type })
  return { channel: saved }
})
