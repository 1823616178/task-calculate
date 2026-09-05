import { initDataSource } from '../../database/data-source'
import { MetricSchema, SystemSchema } from '../../database/entities'
import { requireAuth } from '../../utils/auth'

// 系统列表 + 各系统指标状态汇总（看板数据源）
export default defineEventHandler(async (event) => {
  requireAuth(event)
  const ds = await initDataSource()
  const systems = await ds.getRepository(SystemSchema).find({ order: { id: 'ASC' } })
  const metrics = await ds.getRepository(MetricSchema).find({ order: { id: 'ASC' } })

  return {
    systems: systems.map((s) => {
      const list = metrics.filter((m) => m.systemId === s.id)
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
