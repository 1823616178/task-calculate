import { SystemSchema } from './System'
import { MetricSchema } from './Metric'
import { MetricRecordSchema } from './MetricRecord'
import { UserSchema } from './User'
import { ApiKeySchema } from './ApiKey'
import { AlertChannelSchema } from './AlertChannel'
import { AlertRuleSchema } from './AlertRule'
import { SilenceRuleSchema } from './SilenceRule'
import { AuditLogSchema } from './AuditLog'

export const entities = [
  SystemSchema,
  MetricSchema,
  MetricRecordSchema,
  UserSchema,
  ApiKeySchema,
  AlertChannelSchema,
  AlertRuleSchema,
  SilenceRuleSchema,
  AuditLogSchema,
]

export { SystemSchema } from './System'
export type { SystemEntity } from './System'
export { MetricSchema } from './Metric'
export type { MetricEntity } from './Metric'
export { MetricRecordSchema } from './MetricRecord'
export type { MetricRecordEntity } from './MetricRecord'
export { UserSchema } from './User'
export type { UserEntity } from './User'
export { ApiKeySchema } from './ApiKey'
export type { ApiKeyEntity } from './ApiKey'
export { AlertChannelSchema } from './AlertChannel'
export type { AlertChannelEntity } from './AlertChannel'
export { AlertRuleSchema } from './AlertRule'
export type { AlertRuleEntity } from './AlertRule'
export { SilenceRuleSchema } from './SilenceRule'
export type { SilenceRuleEntity } from './SilenceRule'
export { AuditLogSchema } from './AuditLog'
export type { AuditLogEntity } from './AuditLog'
