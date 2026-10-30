import { initDataSource } from '../../database/data-source'
import { SystemSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { requireAllSystems, requirePermission } from '../../utils/auth'
import { firstZodMessage, systemInputSchema } from '../../utils/validation'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'systems:manage')
  requireAllSystems(admin)
  const body = await readBody(event)
  const parsed = systemInputSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(SystemSchema)
  const exists = await repo.findOne({ where: { code: parsed.data.code } })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: `code 已存在: ${parsed.data.code}` })
  }

  const saved = await repo.save(
    repo.create({
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      retentionDays: parsed.data.retentionDays ?? null,
    }),
  )
  clearMetricCache()
  recordAudit(admin, 'system.create', parsed.data.code)
  return { system: saved }
})
