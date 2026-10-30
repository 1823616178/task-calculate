import { initDataSource } from '../../database/data-source'
import { MetricSchema } from '../../database/entities'
import { clearMetricCache } from '../../services/ingestService'
import { requirePermission, requireSystemAccess } from '../../utils/auth'
import { firstZodMessage, metricInputSchema } from '../../utils/validation'
import { recordAudit } from '../../utils/audit'

// 更新指标（code 不可改；阈值修改后清空接收缓存，新数据立即按新规则判定）
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'metrics:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody(event)
  const parsed = metricInputSchema.omit({ code: true }).partial().safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(MetricSchema)
  const metric = await repo.findOne({ where: { id } })
  if (!metric) {
    throw createError({ statusCode: 404, statusMessage: 'metric not found' })
  }
  requireSystemAccess(admin, metric.systemId)

  const data = parsed.data
  if (data.name !== undefined) metric.name = data.name
  if (data.unit !== undefined) metric.unit = data.unit ?? null
  if (data.warnMin !== undefined) metric.warnMin = data.warnMin ?? null
  if (data.warnMax !== undefined) metric.warnMax = data.warnMax ?? null
  if (data.alarmMin !== undefined) metric.alarmMin = data.alarmMin ?? null
  if (data.alarmMax !== undefined) metric.alarmMax = data.alarmMax ?? null
  await repo.save(metric)

  clearMetricCache()
  recordAudit(admin, 'metric.update', `${metric.systemId}/${metric.code}`, { thresholds: { warnMin: metric.warnMin, warnMax: metric.warnMax, alarmMin: metric.alarmMin, alarmMax: metric.alarmMax } })
  return { metric }
})
