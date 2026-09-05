import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'

// 告警规则列表；systemId 过滤该系统下所有指标的规则
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const systemIdRaw = getQuery(event).systemId
  const systemId = systemIdRaw !== undefined ? Number(systemIdRaw) : undefined
  if (systemId !== undefined && (!Number.isInteger(systemId) || systemId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid systemId' })
  }

  const ds = await initDataSource()
  const qb = ds
    .getRepository(AlertRuleSchema)
    .createQueryBuilder('r')
    .leftJoinAndSelect('r.metric', 'm')
    .leftJoinAndSelect('r.channel', 'c')
    .orderBy('r.id', 'ASC')

  if (systemId !== undefined) {
    qb.andWhere('m.systemId = :systemId', { systemId })
  }

  const rules = await qb.getMany()
  return { rules }
})
