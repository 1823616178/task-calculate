import { EntitySchema } from 'typeorm'
import type { SystemEntity } from './System'
import type { MetricEntity } from './Metric'

export interface SilenceRuleEntity {
  id: number
  // 作用域：metricId 非空 → 指标级；仅 systemId 非空 → 系统级；两者皆空 → 全局
  systemId: number | null
  metricId: number | null
  startAt: Date
  endAt: Date
  reason: string
  createdAt: Date
  system?: SystemEntity
  metric?: MetricEntity
}

export const SilenceRuleSchema = new EntitySchema<SilenceRuleEntity>({
  name: 'SilenceRule',
  tableName: 'silence_rules',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    systemId: { name: 'system_id', type: 'int', nullable: true },
    metricId: { name: 'metric_id', type: 'int', nullable: true },
    startAt: { name: 'start_at', type: 'datetime' },
    endAt: { name: 'end_at', type: 'datetime' },
    reason: { type: 'varchar', length: 255 },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  relations: {
    system: {
      type: 'many-to-one',
      target: 'System',
      joinColumn: { name: 'system_id' },
      onDelete: 'CASCADE',
    },
    metric: {
      type: 'many-to-one',
      target: 'Metric',
      joinColumn: { name: 'metric_id' },
      onDelete: 'CASCADE',
    },
  },
  indices: [{ name: 'IDX_silence_rules_time', columns: ['startAt', 'endAt'] }],
})
