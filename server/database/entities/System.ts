import { EntitySchema } from 'typeorm'

export interface SystemEntity {
  id: number
  code: string
  name: string
  description: string | null
  retentionDays: number | null
  createdAt: Date
}

export const SystemSchema = new EntitySchema<SystemEntity>({
  name: 'System',
  tableName: 'systems',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    code: { type: 'varchar', length: 64, unique: true },
    name: { type: 'varchar', length: 128 },
    description: { type: 'varchar', length: 512, nullable: true },
    // 数据保留天数覆盖：null=跟随全局 RETENTION_DAYS，0=永久
    retentionDays: { name: 'retention_days', type: 'int', nullable: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
})
