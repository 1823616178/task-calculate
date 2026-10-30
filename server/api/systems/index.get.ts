import { initDataSource } from '../../database/data-source'
import { In } from 'typeorm'
import { MetricSchema, SystemSchema } from '../../database/entities'
import type { MetricEntity } from '../../database/entities'
import { requireReadAccess } from '../../utils/readAccess'

// 系统列表 + 各系统指标状态汇总（看板数据源）
// 优化：指标按 systemId 一次分组（Map），再按系统取用，复杂度 O(系统数 + 指标数)，
// 避免原来“每个系统都全量 filter 一遍”的 O(系统数 × 指标数)。
export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const ds = await initDataSource()
  const limitedIds = principal.kind === 'apiKey' && !principal.apiKey.allSystems ? principal.apiKey.systemIds : null
  const systemWhere = limitedIds ? { id: In(limitedIds) } : undefined
  const metricWhere = limitedIds ? { systemId: In(limitedIds) } : undefined
  const systems = await ds.getRepository(SystemSchema).find({ where: systemWhere, order: { id: 'ASC' } })
  const metrics = await ds.getRepository(MetricSchema).find({ where: metricWhere, order: { id: 'ASC' } })

  const metricsBySystem = new Map<number, MetricEntity[]>()
  for (const m of metrics) {
    const list = metricsBySystem.get(m.systemId)
    if (list) list.push(m)
    else metricsBySystem.set(m.systemId, [m])
  }

  return {
    systems: systems.map((s) => {
      const list = metricsBySystem.get(s.id) ?? []
      const summary: Record<string, number> = { normal: 0, warning: 0, alarm: 0, none: 0 }
      for (const m of list) {
        summary[m.lastStatus] = (summary[m.lastStatus] ?? 0) + 1
      }
      return { ...s, summary, metrics: list }
    }),
    // 全局保留策略默认值（供前端展示提示；null=未启用清理）
    globalRetentionDays: Number(process.env.RETENTION_DAYS || 0) || null,
  }
})
