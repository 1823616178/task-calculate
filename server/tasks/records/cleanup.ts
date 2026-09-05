import { runRetentionCleanup } from '../../services/retentionService'

// 每日 03:05 按保留策略清理过期历史记录（RETENTION_DAYS / systems.retention_days）
export default defineTask({
  meta: { name: 'records:cleanup' },
  async run() {
    try {
      const result = await runRetentionCleanup()
      console.log(`[task:records:cleanup] removed ${result.cleaned} records`)
      return { result: `removed ${result.cleaned} records` }
    }
    catch (err) {
      console.error('[task:records:cleanup] failed:', err)
      return { result: 'failed' }
    }
  },
})
