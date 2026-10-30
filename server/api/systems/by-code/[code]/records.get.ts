import { initDataSource } from '../../../../database/data-source'
import { MetricSchema, SystemSchema } from '../../../../database/entities'
import { queryRecords } from '../../../../services/recordsQuery'
import { assertSystemReadable, requireReadAccess } from '../../../../utils/readAccess'
import { codeField, firstZodMessage, recordsByCodeQuerySchema } from '../../../../utils/validation'

// 按系统编码（可选指标编码）查询历史记录，分页语义同 GET /api/records。
// 认证：JWT（可读全部系统）或具有 data:read 的 X-Api-Key（按授权系统范围）
export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const code = codeField.safeParse(getRouterParam(event, 'code'))
  if (!code.success) {
    throw createError({ statusCode: 400, statusMessage: 'invalid code' })
  }
  const parsed = recordsByCodeQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const { metricCode, ...rest } = parsed.data

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { code: code.data } })
  assertSystemReadable(principal, system)

  let metricId: number | undefined
  if (metricCode !== undefined) {
    const metric = await ds.getRepository(MetricSchema).findOne({ where: { systemId: system.id, code: metricCode } })
    if (!metric) {
      throw createError({ statusCode: 404, statusMessage: `unknown metricCode: ${metricCode} (system: ${system.code})` })
    }
    metricId = metric.id
  }

  return queryRecords({ ...rest, systemId: system.id, metricId })
})
