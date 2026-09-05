import { describe, expect, it } from 'vitest'
import { evaluateStatus } from '../server/services/statusService'
import { ingestSchema } from '../server/utils/validation'

const full = { warnMin: 10, warnMax: 70, alarmMin: 0, alarmMax: 90 }

describe('evaluateStatus', () => {
  it('未配置阈值返回 none', () => {
    expect(evaluateStatus(50, { warnMin: null, warnMax: null, alarmMin: null, alarmMax: null })).toBe('none')
  })

  it('warn 区间内返回 normal', () => {
    expect(evaluateStatus(50, full)).toBe('normal')
  })

  it('边界值算区间内（闭区间）', () => {
    expect(evaluateStatus(10, full)).toBe('normal')
    expect(evaluateStatus(70, full)).toBe('normal')
    expect(evaluateStatus(0, full)).toBe('warning')
    expect(evaluateStatus(90, full)).toBe('warning')
  })

  it('超出 warn 但在 alarm 区间内返回 warning', () => {
    expect(evaluateStatus(75, full)).toBe('warning')
    expect(evaluateStatus(5, full)).toBe('warning')
  })

  it('超出 alarm 区间返回 alarm', () => {
    expect(evaluateStatus(91, full)).toBe('alarm')
    expect(evaluateStatus(-1, full)).toBe('alarm')
  })

  it('只配置上限', () => {
    const t = { warnMin: null, warnMax: 70, alarmMin: null, alarmMax: 90 }
    expect(evaluateStatus(-9999, t)).toBe('normal')
    expect(evaluateStatus(80, t)).toBe('warning')
    expect(evaluateStatus(91, t)).toBe('alarm')
  })

  it('只配置下限', () => {
    const t = { warnMin: 10, warnMax: null, alarmMin: 0, alarmMax: null }
    expect(evaluateStatus(9999, t)).toBe('normal')
    expect(evaluateStatus(5, t)).toBe('warning')
    expect(evaluateStatus(-1, t)).toBe('alarm')
  })

  it('只配置 alarm 区间：区间内 normal，区间外 alarm', () => {
    const t = { warnMin: null, warnMax: null, alarmMin: 0, alarmMax: 90 }
    expect(evaluateStatus(50, t)).toBe('normal')
    expect(evaluateStatus(100, t)).toBe('alarm')
  })

  it('只配置 warn 区间：区间内 normal，区间外 warning', () => {
    const t = { warnMin: 10, warnMax: 70, alarmMin: null, alarmMax: null }
    expect(evaluateStatus(50, t)).toBe('normal')
    expect(evaluateStatus(100, t)).toBe('warning')
  })
})

describe('ingestSchema', () => {
  it('接受标准报文', () => {
    const r = ingestSchema.safeParse({ systemCode: 'line1', metricCode: 'temp', value: 87.5 })
    expect(r.success).toBe(true)
  })

  it('value 接受数字字符串', () => {
    const r = ingestSchema.safeParse({ systemCode: 'line1', metricCode: 'temp', value: '87.5' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.value).toBe(87.5)
  })

  it('拒绝缺字段 / 非有限数', () => {
    expect(ingestSchema.safeParse({ metricCode: 'temp', value: 1 }).success).toBe(false)
    expect(ingestSchema.safeParse({ systemCode: 'line1', metricCode: 'temp', value: 'abc' }).success).toBe(false)
    expect(ingestSchema.safeParse({ systemCode: 'line1', metricCode: 'temp', value: Infinity }).success).toBe(false)
  })

  it('timestamp 可选', () => {
    const r = ingestSchema.safeParse({
      systemCode: 'line1',
      metricCode: 'temp',
      value: 1,
      timestamp: '2026-08-24T15:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })
})
