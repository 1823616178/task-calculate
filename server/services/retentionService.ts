import { initDataSource } from '../database/data-source'

const BATCH_SIZE = 5000

/**
 * 生效保留天数：系统覆盖优先于全局；<=0 表示永久保留。
 */
export function effectiveRetentionDays(systemDays: number | null | undefined, globalDays: number | null | undefined): number {
  const days = systemDays ?? globalDays ?? 0
  return days > 0 ? Math.floor(days) : 0
}

async function deleteBatched(sql: string, params: unknown[]): Promise<number> {
  const ds = await initDataSource()
  let total = 0
  while (true) {
    const result = (await ds.query(sql, params)) as { affectedRows?: number }
    const affected = result.affectedRows ?? 0
    total += affected
    if (affected < BATCH_SIZE) break
  }
  return total
}

/**
 * 按保留策略清理历史记录：
 * - 全局默认 RETENTION_DAYS（env，0/未配置 = 不清理）
 * - 系统级 systems.retention_days 覆盖（0 = 永久）
 * 分批删除（LIMIT 5000）避免长事务与主从延迟。
 */
export async function runRetentionCleanup(now: Date = new Date()): Promise<{ cleaned: number, details: Array<{ systemId: number, days: number, deleted: number }> }> {
  const globalDays = Number(process.env.RETENTION_DAYS || 0) || null
  const ds = await initDataSource()
  const systems = await ds.query('SELECT id, retention_days FROM systems') as Array<{ id: number, retention_days: number | null }>

  const details: Array<{ systemId: number, days: number, deleted: number }> = []
  for (const system of systems) {
    const days = effectiveRetentionDays(system.retention_days ?? null, globalDays)
    if (days <= 0) continue
    const cutoff = new Date(now.getTime() - days * 86_400_000)
    const deleted = await deleteBatched(
      'DELETE FROM `metric_records` WHERE `metric_id` IN (SELECT `id` FROM `metrics` WHERE `system_id` = ?) AND `reported_at` < ? LIMIT ?',
      [system.id, cutoff, BATCH_SIZE],
    )
    if (deleted > 0) {
      details.push({ systemId: system.id, days, deleted })
      console.log(`[retention] system#${system.id}: removed ${deleted} records older than ${cutoff.toISOString()} (${days}d)`)
    }
  }

  return { cleaned: details.reduce((sum, d) => sum + d.deleted, 0), details }
}
