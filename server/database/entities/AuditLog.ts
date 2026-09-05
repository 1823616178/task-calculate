import { EntitySchema } from 'typeorm'

export interface AuditLogEntity {
  id: number
  userId: number | null
  username: string
  action: string
  target: string
  detail: string | null
  createdAt: Date
}

// 管理操作审计日志；username 做快照，用户删除后仍可追溯
export const AuditLogSchema = new EntitySchema<AuditLogEntity>({
  name: 'AuditLog',
  tableName: 'audit_logs',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    userId: { name: 'user_id', type: 'int', nullable: true },
    username: { type: 'varchar', length: 64 },
    action: { type: 'varchar', length: 64 },
    target: { type: 'varchar', length: 128 },
    detail: { type: 'text', nullable: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  indices: [
    { name: 'IDX_audit_logs_created', columns: ['createdAt'] },
    { name: 'IDX_audit_logs_action', columns: ['action'] },
  ],
})
