import { EntitySchema } from 'typeorm'
import type { MetricEntity } from './Metric'
import type { IngestChannel, MetricStatus } from '../../shared/types'

export interface MetricRecordEntity {
  id: number
  metricId: number
  value: number
  status: MetricStatus
  channel: IngestChannel
  payload: string | null
  reportedAt: Date
  createdAt: Date
  metric?: MetricEntity
}

export const MetricRecordSchema = new EntitySchema<MetricRecordEntity>({
  name: 'MetricRecord',
  tableName: 'metric_records',
  columns: {
    id: { type: 'bigint', primary: true, generated: 'increment' },
    metricId: { name: 'metric_id', type: 'int' },
    value: { type: 'double' },
    status: { type: 'varchar', length: 16 },
    channel: { type: 'varchar', length: 8 },
    payload: { type: 'text', nullable: true },
    reportedAt: { name: 'reported_at', type: 'datetime' },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  relations: {
    metric: {
      type: 'many-to-one',
      target: 'Metric',
      joinColumn: { name: 'metric_id' },
      onDelete: 'CASCADE',
    },
  },
  indices: [
    { name: 'IDX_records_metric_reported', columns: ['metricId', 'reportedAt'] },
    { name: 'IDX_records_status_reported', columns: ['status', 'reportedAt'] },
  ],
})
