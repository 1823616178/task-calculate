import { describe, expect, it } from 'vitest'
import {
  alertChannelSchema,
  alertRuleSchema,
  apiKeyCreateSchema,
  exportQuerySchema,
  loginSchema,
  metricInputSchema,
  recordsQuerySchema,
  silenceRuleSchema,
  statsQuerySchema,
  systemInputSchema,
  userCreateSchema,
} from '../server/utils/validation'

describe('recordsQuerySchema', () => {
  it('默认 page=1 pageSize=20，beforeId 缺省', () => {
    const r = recordsQuerySchema.parse({})
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(20)
    expect(r.beforeId).toBeUndefined()
  })

  it('beforeId 接受正整数字符串，拒绝非法值', () => {
    expect(recordsQuerySchema.parse({ beforeId: '123' }).beforeId).toBe(123)
    expect(recordsQuerySchema.safeParse({ beforeId: 'abc' }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ beforeId: 0 }).success).toBe(false)
  })

  it('pageSize 上限 100', () => {
    expect(recordsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
    expect(recordsQuerySchema.parse({ pageSize: '50' }).pageSize).toBe(50)
  })
})

describe('systemInputSchema', () => {
  it('code 仅允许字母/数字/下划线/中划线', () => {
    expect(systemInputSchema.safeParse({ code: 'line-1', name: 'x' }).success).toBe(true)
    expect(systemInputSchema.safeParse({ code: 'line 1', name: 'x' }).success).toBe(false)
    expect(systemInputSchema.safeParse({ code: 'line/1', name: 'x' }).success).toBe(false)
  })

  it('description 可省略、可为 null', () => {
    expect(systemInputSchema.safeParse({ code: 'a', name: 'x' }).success).toBe(true)
    expect(systemInputSchema.safeParse({ code: 'a', name: 'x', description: null }).success).toBe(true)
  })
})

describe('metricInputSchema', () => {
  const base = { code: 'temp', name: '温度' }

  it('阈值为空 / 数字 / 数字字符串均可', () => {
    expect(metricInputSchema.safeParse({ ...base, warnMin: null }).success).toBe(true)
    expect(metricInputSchema.parse({ ...base, warnMax: '70.5' }).warnMax).toBe(70.5)
  })

  it('阈值拒绝非有限数字', () => {
    expect(metricInputSchema.safeParse({ ...base, alarmMin: 'abc' }).success).toBe(false)
    expect(metricInputSchema.safeParse({ ...base, alarmMax: 'Infinity' }).success).toBe(false)
  })

  it('code 拒绝非法字符', () => {
    expect(metricInputSchema.safeParse({ ...base, code: 'te mp' }).success).toBe(false)
  })

  it('拒绝倒置的预警/告警区间', () => {
    expect(metricInputSchema.safeParse({ ...base, warnMin: 80, warnMax: 10 }).success).toBe(false)
    expect(metricInputSchema.safeParse({ ...base, alarmMin: 90, alarmMax: 50 }).success).toBe(false)
  })

  it('拒绝预警区间超出告警区间（永远 warning/alarm 的配置）', () => {
    expect(metricInputSchema.safeParse({ ...base, warnMin: 0, warnMax: 100, alarmMin: 20, alarmMax: 80 }).success).toBe(false)
    expect(metricInputSchema.safeParse({ ...base, warnMin: 20, warnMax: 80, alarmMin: 0, alarmMax: 100 }).success).toBe(true)
    // 单侧阈值同样受限
    expect(metricInputSchema.safeParse({ ...base, warnMin: 5, alarmMin: 10 }).success).toBe(false)
    expect(metricInputSchema.safeParse({ ...base, warnMax: 90, alarmMax: 80 }).success).toBe(false)
  })

  it('仅配置单边阈值时通过', () => {
    expect(metricInputSchema.safeParse({ ...base, warnMin: 10 }).success).toBe(true)
    expect(metricInputSchema.safeParse({ ...base, alarmMax: 90 }).success).toBe(true)
  })
})

describe('dateRangeSchema（records / stats / export 的 from/to）', () => {
  it('拒绝非 ISO 日期字符串', () => {
    expect(recordsQuerySchema.safeParse({ from: 'yesterday' }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ from: '2026-09-05 00:00:00' }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({ from: '2026-09-05T00:00:00Z' }).success).toBe(true)
  })

  it('from 晚于 to 拒绝', () => {
    expect(recordsQuerySchema.safeParse({
      from: '2026-09-05T10:00:00Z',
      to: '2026-09-05T09:00:00Z',
    }).success).toBe(false)
    expect(recordsQuerySchema.safeParse({
      from: '2026-09-05T09:00:00Z',
      to: '2026-09-05T10:00:00Z',
    }).success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('拒绝空用户名或空密码', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'a', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'a', password: 'x' }).success).toBe(true)
  })
})

describe('alertChannelSchema', () => {
  it('接受四种渠道类型，secret 可省略', () => {
    for (const type of ['webhook', 'dingtalk', 'wecom', 'email']) {
      expect(alertChannelSchema.safeParse({ type, name: 'x', target: 'https://example.com' }).success).toBe(true)
    }
    expect(
      alertChannelSchema.safeParse({ type: 'dingtalk', name: 'x', target: 'https://oapi.dingtalk.com', secret: 'SEC...' }).success,
    ).toBe(true)
  })

  it('拒绝未知类型与空目标', () => {
    expect(alertChannelSchema.safeParse({ type: 'sms', name: 'x', target: 'y' }).success).toBe(false)
    expect(alertChannelSchema.safeParse({ type: 'webhook', name: 'x', target: '' }).success).toBe(false)
  })
})

describe('alertRuleSchema', () => {
  it('默认通知预警+告警、冷却 300s', () => {
    const r = alertRuleSchema.parse({ metricId: 1, channelId: 2 })
    expect(r.notifyWarning).toBe(true)
    expect(r.notifyAlarm).toBe(true)
    expect(r.cooldownSeconds).toBe(300)
  })

  it('冷却上限 86400，拒绝负数', () => {
    expect(alertRuleSchema.safeParse({ metricId: 1, channelId: 2, cooldownSeconds: -1 }).success).toBe(false)
    expect(alertRuleSchema.safeParse({ metricId: 1, channelId: 2, cooldownSeconds: 86_401 }).success).toBe(false)
    expect(alertRuleSchema.safeParse({ metricId: 1, channelId: 2, cooldownSeconds: 0 }).success).toBe(true)
  })
})

describe('silenceRuleSchema', () => {
  it('接受 ISO 时间窗', () => {
    const ok = silenceRuleSchema.safeParse({
      systemId: 1,
      startAt: '2026-08-26T00:00:00.000Z',
      endAt: '2026-08-27T00:00:00.000Z',
      reason: '检修',
    })
    expect(ok.success).toBe(true)
  })

  it('endAt 早于 startAt 拒绝', () => {
    const bad = silenceRuleSchema.safeParse({
      systemId: 1,
      startAt: '2026-08-27T00:00:00.000Z',
      endAt: '2026-08-26T00:00:00.000Z',
    })
    expect(bad.success).toBe(false)
  })

  it('非时间字符串拒绝', () => {
    const bad = silenceRuleSchema.safeParse({
      metricId: 1,
      startAt: 'not-a-date',
      endAt: '2026-08-26T00:00:00.000Z',
    })
    expect(bad.success).toBe(false)
  })
})

describe('apiKeyCreateSchema / userCreateSchema', () => {
  it('ApiKey 是全局实体，但必须配置系统范围与名称', () => {
    expect(apiKeyCreateSchema.safeParse({ systemIds: [1], name: '网关' }).success).toBe(true)
    expect(apiKeyCreateSchema.safeParse({ allSystems: true, name: '全局网关' }).success).toBe(true)
    expect(apiKeyCreateSchema.safeParse({ name: '无范围网关' }).success).toBe(false)
    expect(apiKeyCreateSchema.safeParse({ systemIds: [1], name: '' }).success).toBe(false)
  })

  it('用户名格式与密码长度校验', () => {
    expect(userCreateSchema.safeParse({ username: 'op_1', password: '123456' }).success).toBe(true)
    expect(userCreateSchema.safeParse({ username: 'bad name', password: '123456' }).success).toBe(false)
    expect(userCreateSchema.safeParse({ username: 'ok', password: '12345' }).success).toBe(false)
    expect(userCreateSchema.parse({ username: 'ok', password: '123456' }).role).toBe('viewer')
  })
})

describe('statsQuerySchema / exportQuerySchema / systemInputSchema.retentionDays', () => {
  it('stats window 默认 auto，拒绝未知窗口', () => {
    expect(statsQuerySchema.parse({}).window).toBe('auto')
    expect(statsQuerySchema.safeParse({ window: '2h' }).success).toBe(false)
  })

  it('export limit 默认 1 万、上限 10 万', () => {
    expect(exportQuerySchema.parse({}).limit).toBe(10_000)
    expect(exportQuerySchema.safeParse({ limit: 100_001 }).success).toBe(false)
    expect(exportQuerySchema.safeParse({ limit: 100_000 }).success).toBe(true)
  })

  it('retentionDays 接受数字/数字字符串/null，拒绝负数', () => {
    expect(systemInputSchema.parse({ code: 'a', name: 'x', retentionDays: '30' }).retentionDays).toBe(30)
    expect(systemInputSchema.safeParse({ code: 'a', name: 'x', retentionDays: null }).success).toBe(true)
    expect(systemInputSchema.safeParse({ code: 'a', name: 'x', retentionDays: -1 }).success).toBe(false)
  })
})
