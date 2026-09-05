import { EntitySchema } from 'typeorm'
import type { AlertChannelType } from '../../../shared/types'

export interface AlertChannelEntity {
  id: number
  type: AlertChannelType
  name: string
  // webhook/钉钉/企微：完整回调 URL；email：收件人邮箱（逗号分隔）
  target: string
  secret: string | null
  enabled: boolean
  createdAt: Date
}

export const AlertChannelSchema = new EntitySchema<AlertChannelEntity>({
  name: 'AlertChannel',
  tableName: 'alert_channels',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    type: { type: 'varchar', length: 16 },
    name: { type: 'varchar', length: 128 },
    target: { type: 'varchar', length: 512 },
    secret: { type: 'varchar', length: 512, nullable: true },
    enabled: { type: 'boolean', default: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
})
