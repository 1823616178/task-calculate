import { initDataSource } from '../../../database/data-source'
import { MetricSchema, SilenceRuleSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { firstZodMessage, silenceRuleSchema } from '../../../utils/validation'
import { recordAudit } from '../../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const parsed = silenceRuleSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const data = parsed.data

  const ds = await initDataSource()
  // 指标级静默：metricId 必须存在；systemId 需与指标归属一致（或不传，由指标推导）
  if (data.metricId !== undefined && data.metricId !== null) {
    const metric = await ds.getRepository(MetricSchema).findOne({ where: { id: data.metricId } })
    if (!metric) {
      throw createError({ statusCode: 404, statusMessage: 'metric not found' })
    }
    if (data.systemId !== undefined && data.systemId !== null && data.systemId !== metric.systemId) {
      throw createError({ statusCode: 400, statusMessage: 'metricId 不属于该系统' })
    }
  }

  const repo = ds.getRepository(SilenceRuleSchema)
  const saved = await repo.save(
    repo.create({
      systemId: data.systemId ?? null,
      metricId: data.metricId ?? null,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      reason: data.reason,
    }),
  )
  recordAudit(admin, 'silence.create', `metric=${data.metricId ?? 'any'}/system=${data.systemId ?? 'any'}`, { startAt: data.startAt, endAt: data.endAt, reason: data.reason })
  return { silence: saved }
})
