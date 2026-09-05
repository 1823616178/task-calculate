import { initDataSource } from '../database/data-source'
import { AuditLogSchema } from '../database/entities'
import type { AuthTokenPayload } from './jwt'

// 管理操作审计：fire-and-forget 写入，失败只记日志不影响主流程
export function recordAudit(user: Pick<AuthTokenPayload, 'userId' | 'username'> | null, action: string, target = '', detail?: unknown): void {
  void initDataSource()
    .then((ds) => {
      const repo = ds.getRepository(AuditLogSchema)
      return repo.save(
        repo.create({
          userId: user?.userId ?? null,
          username: user?.username ?? 'system',
          action,
          target,
          detail: detail === undefined ? null : JSON.stringify(detail),
        }),
      )
    })
    .catch((err) => {
      console.error(`[audit] failed to record "${action}":`, err)
    })
}
