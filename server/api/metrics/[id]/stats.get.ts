import { initDataSource } from '../../../database/data-source'
import { MetricSchema } from '../../../database/entities'
import { assertMetricReadable, requireReadAccess } from '../../../utils/readAccess'
import { WINDOW_SECONDS, firstZodMessage, statsQuerySchema } from '../../../utils/validation'
import { pickWindowSeconds } from '../../../utils/stats'

interface StatRow {
  bucket: string | Date
  minV: number
  maxV: number
  avgV: number
  cnt: number | string
}

// 聚合统计：按时间窗口分组的 min/max/avg/count，供趋势图使用。
// window=auto 时按时间跨度自动选窗口（约 ≤240 点）。
export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const parsed = statsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const { window, from, to } = parsed.data

  const ds = await initDataSource()
  const metric = await ds.getRepository(MetricSchema).findOne({ where: { id } })
  assertMetricReadable(principal, metric)

  // 默认最近 24 小时
  const toTime = to ? new Date(to).getTime() : Date.now()
  const fromTime = from ? new Date(from).getTime() : toTime - 24 * 3600_000
  if (fromTime >= toTime) {
    throw createError({ statusCode: 400, statusMessage: 'from 必须早于 to' })
  }
  if (toTime - fromTime > 366 * 86_400_000) {
    throw createError({ statusCode: 400, statusMessage: '时间范围最长一年' })
  }

  const windowSeconds = window === 'auto' ? pickWindowSeconds((toTime - fromTime) / 1000) : WINDOW_SECONDS[window]

  // 按窗口对齐 epoch 秒分组（FLOOR 分桶），与连接时区一致
  const rows = (await ds.query(
    `SELECT FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(r.reported_at) / ?) * ?) AS bucket,
            MIN(r.value) AS minV, MAX(r.value) AS maxV, AVG(r.value) AS avgV, COUNT(*) AS cnt
     FROM \`metric_records\` r
     WHERE r.\`metric_id\` = ? AND r.\`reported_at\` > ? AND r.\`reported_at\` <= ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [windowSeconds, windowSeconds, id, new Date(fromTime), new Date(toTime)],
  )) as StatRow[]

  return {
    metric: { id: metric.id, code: metric.code, name: metric.name, unit: metric.unit },
    windowSeconds,
    from: new Date(fromTime).toISOString(),
    to: new Date(toTime).toISOString(),
    points: rows.map(row => ({
      t: new Date(row.bucket as string).toISOString(),
      min: Number(row.minV),
      max: Number(row.maxV),
      avg: Number(row.avgV),
      count: Number(row.cnt),
    })),
  }
})
