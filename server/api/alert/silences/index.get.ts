import { initDataSource } from '../../../database/data-source'
import { SilenceRuleSchema } from '../../../database/entities'
import { requirePermission, requireSystemAccess } from '../../../utils/auth'

// 静默窗口列表；systemId 过滤：全局 + 本系统 + 本系统下指标的静默
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
    .getRepository(SilenceRuleSchema)
    .createQueryBuilder('s')
    .leftJoinAndSelect('s.system', 'sys')
    .leftJoinAndSelect('s.metric', 'm')
    .orderBy('s.startAt', 'DESC')

  if (systemId !== undefined) {
    qb.andWhere('(s.systemId = :systemId OR m.systemId = :systemId OR (s.systemId IS NULL AND s.metricId IS NULL))', { systemId })
  }
  else if (principal.kind === 'apiKey' && !principal.apiKey.allSystems) {
    if (principal.apiKey.systemIds.length === 0) {
      qb.andWhere('(s.systemId IS NULL AND s.metricId IS NULL)')
    }
    else {
      qb.andWhere('(s.systemId IN (:...systemIds) OR m.systemId IN (:...systemIds) OR (s.systemId IS NULL AND s.metricId IS NULL))', {
        systemIds: principal.apiKey.systemIds,
      })
    }
  }

  const rules = await qb.getMany()
  return { silences: rules }
})
