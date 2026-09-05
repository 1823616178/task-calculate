import { z } from 'zod'

// 统一数据上报报文校验（HTTP / MQTT / WS 三通道一致）
export const ingestSchema = z.object({
  systemCode: z.string().trim().min(1).max(64),
  metricCode: z.string().trim().min(1).max(64),
  value: z.coerce.number().refine(Number.isFinite, 'value must be a finite number'),
  timestamp: z.string().max(40).optional(),
})

export type IngestInput = z.infer<typeof ingestSchema>

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
})

export const systemInputSchema = z.object({
  code: z.string().trim().min(1).max(64).regex(/^[\w-]+$/, 'code 仅允许字母/数字/下划线/中划线'),
  name: z.string().trim().min(1).max(128),
  description: z.string().trim().max(512).nullish(),
  // 数据保留天数覆盖：null/省略=跟随全局默认，0=永久保留
  retentionDays: z.coerce.number().int().min(0).max(36_500).nullish(),
})

// 趋势统计查询
export const statsQuerySchema = z.object({
  window: z.enum(['auto', '1m', '5m', '15m', '1h', '1d']).default('auto'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

// 记录导出查询
export const exportQuerySchema = z.object({
  metricId: z.coerce.number().int().positive().optional(),
  systemId: z.coerce.number().int().positive().optional(),
  status: z.enum(['normal', 'warning', 'alarm', 'none']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100_000).default(10_000),
})

export const WINDOW_SECONDS: Record<'1m' | '5m' | '15m' | '1h' | '1d', number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '1d': 86_400,
}

const thresholdField = z.coerce.number().refine(Number.isFinite, '阈值必须是有限数字').nullish()

export const metricInputSchema = z.object({
  code: z.string().trim().min(1).max(64).regex(/^[\w-]+$/, 'code 仅允许字母/数字/下划线/中划线'),
  name: z.string().trim().min(1).max(128),
  unit: z.string().trim().max(32).nullish(),
  warnMin: thresholdField,
  warnMax: thresholdField,
  alarmMin: thresholdField,
  alarmMax: thresholdField,
})

export const recordsQuerySchema = z.object({
  metricId: z.coerce.number().int().positive().optional(),
  systemId: z.coerce.number().int().positive().optional(),
  status: z.enum(['normal', 'warning', 'alarm', 'none']).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // keyset 游标分页：取上一页最后一条记录的 id，避免深分页 OFFSET 扫描
  beforeId: z.coerce.number().int().positive().optional(),
})

export function firstZodMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
}

// ---- 告警通知 ----

export const alertChannelSchema = z.object({
  type: z.enum(['webhook', 'dingtalk', 'wecom', 'email']),
  name: z.string().trim().min(1).max(128),
  target: z.string().trim().min(1).max(512),
  secret: z.string().trim().max(512).nullish(),
  enabled: z.boolean().optional(),
})

export const alertRuleSchema = z.object({
  metricId: z.coerce.number().int().positive(),
  channelId: z.coerce.number().int().positive(),
  notifyWarning: z.coerce.boolean().default(true),
  notifyAlarm: z.coerce.boolean().default(true),
  // 冷却间隔：0 表示每次跃迁都通知
  cooldownSeconds: z.coerce.number().int().min(0).max(86_400).default(300),
  enabled: z.boolean().optional(),
})

const isoDate = z.string().datetime({ offset: true })

export const silenceRuleSchema = z
  .object({
    systemId: z.coerce.number().int().positive().nullish(),
    metricId: z.coerce.number().int().positive().nullish(),
    startAt: isoDate,
    endAt: isoDate,
    reason: z.string().trim().max(255).default(''),
  })
  .refine(v => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: 'endAt 必须晚于 startAt',
    path: ['endAt'],
  })

// ---- ApiKey 管理 ----

export const apiKeyCreateSchema = z.object({
  systemId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(128),
})

export const apiKeyUpdateSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
})

// ---- 用户管理 ----

export const userCreateSchema = z.object({
  username: z.string().trim().min(1).max(64).regex(/^[\w-]+$/, '用户名仅允许字母/数字/下划线/中划线'),
  password: z.string().min(6).max(128),
  role: z.enum(['admin', 'viewer']).default('viewer'),
})

export const userUpdateSchema = z.object({
  password: z.string().min(6).max(128).optional(),
  role: z.enum(['admin', 'viewer']).optional(),
  enabled: z.boolean().optional(),
})
