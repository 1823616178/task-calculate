import { createError } from 'h3'
import { initDataSource } from '../database/data-source'
import { MetricRecordSchema } from '../database/entities'

export interface RecordsQuery {
  metricId?: number
  systemId?: number
  systemIds?: number[]
  status?: 'normal' | 'warning' | 'alarm' | 'none'
  from?: string
  to?: string
  page: number
  pageSize: number
  beforeId?: number
}

// 历史记录：支持系统/指标/状态/时间范围筛选 + 分页。
// 分页两种模式：
//   - page/pageSize：偏移分页（兼容旧用法）
//   - beforeId：keyset 游标分页（推荐，深翻页不做 OFFSET 扫描），响应带 nextCursor
export async function queryRecords(query: RecordsQuery) {
  const { metricId, systemId, systemIds, status, from, to, page, pageSize, beforeId } = query

  const ds = await initDataSource()
  const qb = ds
    .getRepository(MetricRecordSchema)
    .createQueryBuilder('r')
    .leftJoinAndSelect('r.metric', 'm')

  if (metricId !== undefined) qb.andWhere('r.metricId = :metricId', { metricId })
  if (systemId !== undefined) qb.andWhere('m.systemId = :systemId', { systemId })
  if (systemIds !== undefined) {
    if (systemIds.length === 0) qb.andWhere('1 = 0')
    else qb.andWhere('m.systemId IN (:...systemIds)', { systemIds })
  }
  if (status !== undefined) qb.andWhere('r.status = :status', { status })
  if (from !== undefined) qb.andWhere('r.reportedAt >= :from', { from: new Date(from) })
  if (to !== undefined) qb.andWhere('r.reportedAt <= :to', { to: new Date(to) })

  qb.orderBy('r.reportedAt', 'DESC').addOrderBy('r.id', 'DESC')

  // 总数不含游标/偏移条件，两页之间保持稳定
  const total = await qb.getCount()

  let list
  if (beforeId !== undefined) {
    // 游标也必须属于当前系统/指标范围，避免系统级 ApiKey 用其他系统的
    // record id 影响分页并探测记录是否存在。
    const cursorQb = ds
      .getRepository(MetricRecordSchema)
      .createQueryBuilder('cursor')
      .leftJoin('cursor.metric', 'cursorMetric')
      .where('cursor.id = :beforeId', { beforeId })
    if (metricId !== undefined) cursorQb.andWhere('cursor.metricId = :metricId', { metricId })
    if (systemId !== undefined) cursorQb.andWhere('cursorMetric.systemId = :systemId', { systemId })
    if (systemIds !== undefined) {
      if (systemIds.length === 0) cursorQb.andWhere('1 = 0')
      else cursorQb.andWhere('cursorMetric.systemId IN (:...systemIds)', { systemIds })
    }
    const cursorRow = await cursorQb.getOne()
    if (!cursorRow) {
      throw createError({ statusCode: 400, statusMessage: 'invalid beforeId' })
    }
    qb.andWhere('(r.reportedAt < :cursorAt OR (r.reportedAt = :cursorAt AND r.id < :cursorId))', {
      cursorAt: cursorRow.reportedAt,
      cursorId: beforeId,
    })
  }
  else {
    qb.skip((page - 1) * pageSize)
  }
  // 多取一条用于判断是否还有下一页
  qb.take(pageSize + 1)
  list = await qb.getMany()

  const hasMore = list.length > pageSize
  if (hasMore) list = list.slice(0, pageSize)
  const last = list[list.length - 1]
  const nextCursor = hasMore && last ? Number(last.id) : null

  return { list, total, page, pageSize, nextCursor }
}
