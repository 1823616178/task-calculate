import { EntitySchema } from 'typeorm'
import type { MetricEntity } from './Metric'
import type { AlertChannelEntity } from './AlertChannel'

export interface AlertRuleEntity {
  id: number
  metricId: number
  channelId: number
  notifyWarning: boolean
  notifyAlarm: boolean
  cooldownSeconds: number
  enabled: boolean
  createdAt: Date
  metric?: MetricEntity
  channel?: AlertChannelEntity
}

export const AlertRuleSchema = new EntitySchema<AlertRuleEntity>({
  name: 'AlertRule',
  tableName: 'alert_rules',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    metricId: { name: 'metric_id', type: 'int' },
    channelId: { name: 'channel_id', type: 'int' },
    notifyWarning: { name: 'notify_warning', type: 'boolean', default: true },
    notifyAlarm: { name: 'notify_alarm', type: 'boolean', default: true },
    cooldownSeconds: { name: 'cooldown_seconds', type: 'int', default: 300 },
    enabled: { type: 'boolean', default: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  relations: {
    metric: {
      type: 'many-to-one',
      target: 'Metric',
      joinColumn: { name: 'metric_id' },
      onDelete: 'CASCADE',
    },
    channel: {
      type: 'many-to-one',
      target: 'AlertChannel',
      joinColumn: { name: 'channel_id' },
      onDelete: 'CASCADE',
    },
  },
  uniques: [{ name: 'UQ_alert_rules_metric_channel', columns: ['metricId', 'channelId'] }],
  indices: [{ name: 'IDX_alert_rules_metric', columns: ['metricId'] }],
})
