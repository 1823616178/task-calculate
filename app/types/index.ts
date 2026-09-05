import type { AlertChannelType, IngestChannel, MetricStatus, UserRole } from '../../shared/types'

export interface SystemDto {
  id: number
  code: string
  name: string
  description: string | null
  /** 记录保留天数（null=跟随全局） */
  retentionDays: number | null
  createdAt: string
}

export interface MetricDto {
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
  lastReportedAt: string | null
  createdAt: string
}

export interface SystemWithMetrics extends SystemDto {
  summary: Record<string, number>
  metrics: MetricDto[]
}

export interface RecordDto {
  id: string
  metricId: number
  value: number
  status: MetricStatus
  channel: IngestChannel
  payload: string | null
  reportedAt: string
  createdAt: string
  metric?: MetricDto
}

export interface AuthUser {
  id: number
  username: string
  role: UserRole
}

export interface AlertChannelDto {
  id: number
  type: AlertChannelType
  name: string
  target: string
  secret: string | null
  enabled: boolean
  createdAt: string
}

export interface AlertRuleDto {
  id: number
  metricId: number
  channelId: number
  notifyWarning: boolean
  notifyAlarm: boolean
  cooldownSeconds: number
  enabled: boolean
  createdAt: string
  metric?: { id: number, systemId: number, code: string, name: string }
  channel?: { id: number, type: AlertChannelType, name: string }
}

export interface SilenceRuleDto {
  id: number
  systemId: number | null
  metricId: number | null
  startAt: string
  endAt: string
  reason: string
  createdAt: string
  system?: { id: number, code: string, name: string }
  metric?: { id: number, systemId: number, code: string, name: string }
}

export interface ApiKeyDto {
  id: number
  systemId: number
  name: string
  maskedKey: string
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string
}

export interface UserDto {
  id: number
  username: string
  role: UserRole
  enabled: boolean
  createdAt: string
}
