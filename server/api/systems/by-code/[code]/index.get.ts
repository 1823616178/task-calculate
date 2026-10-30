import { initDataSource } from '../../../../database/data-source'
import { MetricSchema, SystemSchema } from '../../../../database/entities'
import { assertSystemReadable, requireReadAccess } from '../../../../utils/readAccess'
import { codeField } from '../../../../utils/validation'

// 按系统编码获取系统信息 + 各指标当前值与状态。
// 认证：JWT（可读全部系统）或具有 data:read 的 X-Api-Key（按授权系统范围）
export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const parsed = codeField.safeParse(getRouterParam(event, 'code'))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'invalid code' })
  }

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { code: parsed.data } })
  assertSystemReadable(principal, system)
  const metrics = await ds.getRepository(MetricSchema).find({ where: { systemId: system.id }, order: { id: 'ASC' } })

  return { system, metrics }
})
