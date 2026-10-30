// 应用与服务端共享的类型与常量（通过相对路径或 #shared 引用）
export type MetricStatus = 'normal' | 'warning' | 'alarm' | 'none'

export type IngestChannel = 'http' | 'mqtt' | 'ws'

export type UserRole = 'admin' | 'viewer'

export type AlertChannelType = 'webhook' | 'dingtalk' | 'wecom' | 'email'

// ApiKey 能力采用白名单授权；系统范围由 allSystems / systemIds 单独控制。
export const API_PERMISSIONS = [
  'data:read',
  'data:write',
  'systems:manage',
  'metrics:manage',
  'apiKeys:manage',
  'alerts:manage',
  'users:manage',
  'audit:read',
  'maintenance:run',
] as const

export type ApiPermission = typeof API_PERMISSIONS[number]

export const METRIC_STATUSES: MetricStatus[] = ['normal', 'warning', 'alarm', 'none']

export const ALERT_CHANNEL_TYPES: AlertChannelType[] = ['webhook', 'dingtalk', 'wecom', 'email']

// 统一数据上报报文（HTTP / MQTT / WS 三通道一致）
export interface IngestPayload {
  systemCode: string
  metricCode: string
  value: number
  timestamp?: string
}

// WS 推送到前端的事件
export interface MetricUpdateEvent {
  type: 'metric.update'
  data: {
    systemId: number
    systemCode: string
    metricId: number
    metricCode: string
    metricName: string
    unit: string | null
    value: number
    status: MetricStatus
    reportedAt: string
  }
}
