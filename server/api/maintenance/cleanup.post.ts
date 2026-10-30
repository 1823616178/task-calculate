import { requireAllSystems, requirePermission } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'
import { runRetentionCleanup } from '../../services/retentionService'

// 手动触发一次保留策略清理（通常由每日定时任务自动执行）
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'maintenance:run')
  requireAllSystems(admin)
  const result = await runRetentionCleanup()
  recordAudit(admin, 'retention.cleanup', '', { cleaned: result.cleaned })
  return result
})
