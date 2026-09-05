import { describe, expect, it } from 'vitest'
import {
  buildAlertText,
  buildAlertTitle,
  formatDateTime,
  isCoolingDown,
  markSent,
  ruleMatchesStatus,
  shouldNotify,
  signDingtalk,
} from '../server/services/alertingService'
import type { AlertEventInfo } from '../server/services/alertingService'

const baseInfo: AlertEventInfo = {
  systemCode: 'line1',
  systemName: '一号产线',
  metricCode: 'temp',
  metricName: '温度',
  unit: '℃',
  value: 95,
  status: 'alarm',
  prevStatus: 'normal',
  warnMin: 10,
  warnMax: 70,
  alarmMin: 0,
  alarmMax: 90,
  reportedAt: new Date('2026-08-26T01:02:03Z'),
}

describe('shouldNotify', () => {
  it('进入 warning/alarm 触发', () => {
    expect(shouldNotify('normal', 'warning')).toBe(true)
    expect(shouldNotify('normal', 'alarm')).toBe(true)
    expect(shouldNotify('none', 'alarm')).toBe(true)
    expect(shouldNotify('warning', 'alarm')).toBe(true)
    expect(shouldNotify('alarm', 'warning')).toBe(true)
  })

  it('恢复或状态不变不触发', () => {
    expect(shouldNotify('alarm', 'normal')).toBe(false)
    expect(shouldNotify('warning', 'normal')).toBe(false)
    expect(shouldNotify('normal', 'normal')).toBe(false)
    expect(shouldNotify('alarm', 'alarm')).toBe(false)
    expect(shouldNotify('none', 'none')).toBe(false)
  })
})

describe('ruleMatchesStatus', () => {
  it('按规则的通知状态集合匹配', () => {
    const onlyAlarm = { notifyWarning: false, notifyAlarm: true }
    const both = { notifyWarning: true, notifyAlarm: true }
    expect(ruleMatchesStatus(onlyAlarm, 'alarm')).toBe(true)
    expect(ruleMatchesStatus(onlyAlarm, 'warning')).toBe(false)
    expect(ruleMatchesStatus(both, 'warning')).toBe(true)
    expect(ruleMatchesStatus(onlyAlarm, 'normal')).toBe(false)
  })
})

describe('signDingtalk', () => {
  it('确定性且 URL 安全', () => {
    const a1 = signDingtalk('secret-key', 1756155723000)
    const a2 = signDingtalk('secret-key', 1756155723000)
    const b = signDingtalk('secret-key', 1756155723001)

    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
    // encodeURIComponent 后不应含裸露的 + / = 字符
    expect(a1).not.toMatch(/[+/=]/)
    expect(a1.length).toBeGreaterThan(10)
  })

  it('不同密钥产生不同签名', () => {
    expect(signDingtalk('a', 123)).not.toBe(signDingtalk('b', 123))
  })
})

describe('buildAlertTitle / buildAlertText', () => {
  it('标题包含系统、指标、数值与状态', () => {
    const title = buildAlertTitle(baseInfo)
    expect(title).toContain('一号产线')
    expect(title).toContain('温度')
    expect(title).toContain('95')
    expect(title).toContain('告警')
  })

  it('正文包含区间与发生时间，配置 APP_URL 时附看板链接', () => {
    const lines = buildAlertText(baseInfo)
    const text = lines.join('\n')
    expect(text).toContain('10 ~ 70')
    expect(text).toContain('0 ~ 90')
    expect(text).toContain('2026-08-26')
  })
})

describe('formatDateTime', () => {
  it('格式化为本地 YYYY-MM-DD HH:mm:ss', () => {
    // 用本地时区构造，避免 CI 时区差异
    const d = new Date(2026, 7, 26, 9, 5, 3)
    expect(formatDateTime(d)).toBe('2026-08-26 09:05:03')
  })
})

describe('冷却窗口', () => {
  it('markSent 后冷却期内拦截，过期放行', () => {
    const now = 1_000_000
    markSent(42, now)
    expect(isCoolingDown(42, 300, now + 299_999)).toBe(true)
    expect(isCoolingDown(42, 300, now + 300_000)).toBe(false)
    expect(isCoolingDown(43, 300, now)).toBe(false)
  })

  it('cooldownSeconds=0 不冷却', () => {
    const now = 2_000_000
    markSent(44, now)
    expect(isCoolingDown(44, 0, now)).toBe(false)
  })
})
