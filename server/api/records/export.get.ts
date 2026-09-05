import { Readable } from 'node:stream'
import { sendStream } from 'h3'
import { initDataSource } from '../../database/data-source'
import { MetricRecordSchema } from '../../database/entities'
import { requireAuth } from '../../utils/auth'
import { csvLine } from '../../utils/csv'
import { firstZodMessage, exportQuerySchema } from '../../utils/validation'


const BATCH_SIZE = 1000

// 历史记录导出 CSV：与 /api/records 相同的筛选参数，流式分批输出（上限 limit 条，默认 1 万）。
// 带 BOM 头，Excel 打开中文不乱码。
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const parsed = exportQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const { metricId, systemId, status, from, to, limit } = parsed.data

  const ds = await initDataSource()
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(/[-:T]/g, '')
  setHeaders(event, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="records-${stamp}.csv"`,
  })

  async function* generate(): AsyncGenerator<string> {
    yield '\uFEFF' + csvLine(['id', 'system', 'metric', 'value', 'unit', 'status', 'channel', 'reported_at'])

    let sent = 0
    let lastReportedAt: Date | null = null
    let lastId = 0

    while (sent < limit) {
      const qb = ds
        .getRepository(MetricRecordSchema)
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.metric', 'm')
        .leftJoinAndSelect('m.system', 's')
        .orderBy('r.reportedAt', 'ASC')
        .addOrderBy('r.id', 'ASC')

      if (metricId !== undefined) qb.andWhere('r.metricId = :metricId', { metricId })
      if (systemId !== undefined) qb.andWhere('m.systemId = :systemId', { systemId })
      if (status !== undefined) qb.andWhere('r.status = :status', { status })
      if (from !== undefined) qb.andWhere('r.reportedAt >= :from', { from: new Date(from) })
      if (to !== undefined) qb.andWhere('r.reportedAt <= :to', { to: new Date(to) })

      // keyset 分批：按 (reportedAt, id) 正向推进，不做 OFFSET 扫描
      if (lastReportedAt) {
        qb.andWhere('(r.reportedAt > :lastAt OR (r.reportedAt = :lastAt AND r.id > :lastId))', {
          lastAt: lastReportedAt,
          lastId,
        })
      }
      qb.take(Math.min(BATCH_SIZE, limit - sent))
      const rows = await qb.getMany()
      if (rows.length === 0) break

      for (const r of rows) {
        yield csvLine([
          r.id,
          r.metric?.system?.code ?? '',
          `${r.metric?.name ?? ''}(${r.metric?.code ?? ''})`,
          r.value,
          r.metric?.unit ?? '',
          r.status,
          r.channel,
          r.reportedAt instanceof Date ? r.reportedAt.toISOString() : r.reportedAt,
        ])
      }
      sent += rows.length
      const lastRow = rows[rows.length - 1]
      lastReportedAt = lastRow.reportedAt instanceof Date ? lastRow.reportedAt : new Date(lastRow.reportedAt)
      lastId = Number(lastRow.id)
      if (rows.length < BATCH_SIZE) break
    }
  }

  return sendStream(event, Readable.from(generate()))
})
