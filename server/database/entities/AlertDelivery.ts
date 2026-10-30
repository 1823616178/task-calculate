import { EntitySchema } from 'typeorm'
import type { MetricStatus } from '../../../shared/types'

export type AlertDeliveryStatus = 'sent' | 'failed'

export interface AlertDeliveryEntity {
  id: number
  ruleId: number
  channelId: number
  metricId: number
  prevStatus: MetricStatus
  newStatus: MetricStatus
  value: number
  status: AlertDeliveryStatus
  error: string | null
  reportedAt: Date
  createdAt: Date
}

// 告警发送记录：每次规则触发的发送结果都落库（成功 / 失败 + 错误信息），
// 进程重启不再丢“发没发出去”这件事；失败记录可直接用 SQL / 审计口径复查，
// 不再只依赖进程日志。
export const AlertDeliverySchema = new EntitySchema<AlertDeliveryEntity>({
  name: 'AlertDelivery',
  tableName: 'alert_deliveries',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    ruleId: { name: 'rule_id', type: 'int' },
    channelId: { name: 'channel_id', type: 'int' },
    metricId: { name: 'metric_id', type: 'int' },
    prevStatus: { name: 'prev_status', type: 'varchar', length: 16 },
    newStatus: { name: 'new_status', type: 'varchar', length: 16 },
    value: { type: 'double' },
    status: { type: 'varchar', length: 16 },
    error: { type: 'varchar', length: 512, nullable: true },
    reportedAt: { name: 'reported_at', type: 'datetime' },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  indices: [
    { name: 'IDX_alert_deliveries_rule_created', columns: ['ruleId', 'createdAt'] },
    { name: 'IDX_alert_deliveries_metric_created', columns: ['metricId', 'createdAt'] },
  ],
})
