import { initDataSource } from '../../database/data-source'
import { MetricSchema, SystemSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { requireAdmin } from '../../utils/auth'
import { firstZodMessage, metricInputSchema } from '../../utils/validation'
import { z } from 'zod'
import { recordAudit } from '../../utils/audit'

const createMetricSchema = metricInputSchema.extend({
  systemId: z.coerce.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const body = await readBody(event)
  const parsed = createMetricSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const { systemId, ...data } = parsed.data

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { id: systemId } })
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }

  const repo = ds.getRepository(MetricSchema)
  const exists = await repo.findOne({ where: { systemId, code: data.code } })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: `code 已存在: ${data.code}` })
  }

  const saved = await repo.save(
    repo.create({
      systemId,
      code: data.code,
      name: data.name,
      unit: data.unit ?? null,
      warnMin: data.warnMin ?? null,
      warnMax: data.warnMax ?? null,
      alarmMin: data.alarmMin ?? null,
      alarmMax: data.alarmMax ?? null,
    }),
  )
  clearMetricCache()
  recordAudit(admin, 'metric.create', `${system.code}/${data.code}`)
  return { metric: saved }
})
