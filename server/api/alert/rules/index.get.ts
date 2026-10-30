import { initDataSource } from '../../../database/data-source'
import { AlertRuleSchema } from '../../../database/entities'
import { requirePermission, requireSystemAccess } from '../../../utils/auth'

// 告警规则列表；systemId 过滤该系统下所有指标的规则
export default defineEventHandler(async (event) => {
  const principal = await requirePermission(event, 'alerts:manage')
  const systemIdRaw = getQuery(event).systemId
  const systemId = systemIdRaw !== undefined ? Number(systemIdRaw) : undefined
  if (systemId !== undefined && (!Number.isInteger(systemId) || systemId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid systemId' })
  }
  if (systemId !== undefined) requireSystemAccess(principal, systemId)

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
  else if (principal.kind === 'apiKey' && !principal.apiKey.allSystems) {
    if (principal.apiKey.systemIds.length === 0) qb.andWhere('1 = 0')
    else qb.andWhere('m.systemId IN (:...systemIds)', { systemIds: principal.apiKey.systemIds })
  }

  const rules = await qb.getMany()
  return { rules }
})
