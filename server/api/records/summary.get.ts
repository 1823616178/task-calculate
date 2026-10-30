import { queryRecordsSummary } from '../../services/recordsQuery'
import { requireReadAccess, scopeReadQuery } from '../../utils/readAccess'
import { firstZodMessage, recordsQuerySchema } from '../../utils/validation'

// 历史记录状态分布：与 /api/records 同筛选口径（忽略 status 本身），
// 供记录页顶部“全部 / 正常 / 预警 / 告警”计数使用。
export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const parsed = recordsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const scoped = await scopeReadQuery(principal, parsed.data)
  const { metricId, systemId, systemIds, status: _status, from, to } = scoped
  return queryRecordsSummary({ metricId, systemId, systemIds, from, to })
})
