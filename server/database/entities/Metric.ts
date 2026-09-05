import { EntitySchema } from 'typeorm'
import type { SystemEntity } from './System'
import type { MetricStatus } from '../../shared/types'

export interface MetricEntity {
  id: number
  systemId: number
  code: string
  name: string
  unit: string | null
  warnMin: number | null
  warnMax: number | null
  alarmMin: number | null
  alarmMax: number | null
  lastValue: number | null
  lastStatus: MetricStatus
  lastReportedAt: Date | null
  createdAt: Date
  system?: SystemEntity
}

export const MetricSchema = new EntitySchema<MetricEntity>({
  name: 'Metric',
  tableName: 'metrics',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    systemId: { name: 'system_id', type: 'int' },
    code: { type: 'varchar', length: 64 },
    name: { type: 'varchar', length: 128 },
    unit: { type: 'varchar', length: 32, nullable: true },
    warnMin: { name: 'warn_min', type: 'double', nullable: true },
    warnMax: { name: 'warn_max', type: 'double', nullable: true },
    alarmMin: { name: 'alarm_min', type: 'double', nullable: true },
    alarmMax: { name: 'alarm_max', type: 'double', nullable: true },
    lastValue: { name: 'last_value', type: 'double', nullable: true },
    lastStatus: { name: 'last_status', type: 'varchar', length: 16, default: 'none' },
    lastReportedAt: { name: 'last_reported_at', type: 'datetime', nullable: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  relations: {
    system: {
      type: 'many-to-one',
      target: 'System',
      joinColumn: { name: 'system_id' },
      onDelete: 'CASCADE',
    },
  },
  uniques: [{ name: 'UQ_metrics_system_code', columns: ['systemId', 'code'] }],
  indices: [{ name: 'IDX_metrics_system', columns: ['systemId'] }],
})
