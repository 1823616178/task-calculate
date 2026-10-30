import { initDataSource } from '../database/data-source'
import { AuditLogSchema } from '../database/entities'
import type { AuthPrincipal } from './auth'

interface AuditActor { userId: number | null, username: string }

function auditActor(subject: AuditActor | AuthPrincipal | null): AuditActor | null {
  if (!subject) return null
  if (!('kind' in subject)) return subject
  return subject.kind === 'user'
    ? { userId: subject.userId, username: subject.username }
    : { userId: null, username: `apikey:${subject.apiKey.name}`.slice(0, 64) }
}

// 管理操作审计：fire-and-forget 写入，失败只记日志不影响主流程
export function recordAudit(subject: AuditActor | AuthPrincipal | null, action: string, target = '', detail?: unknown): void {
  const user = auditActor(subject)
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
