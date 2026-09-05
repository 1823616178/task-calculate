import { describe, expect, it } from 'vitest'
import { pickWindowSeconds } from '../server/utils/stats'
import { csvEscape, csvLine } from '../server/utils/csv'
import { effectiveRetentionDays } from '../server/services/retentionService'

describe('pickWindowSeconds', () => {
  it('短跨度选 1 分钟', () => {
    expect(pickWindowSeconds(3600)).toBe(60) // 1h → 60 点
  })

  it('按点数上限自动升级窗口', () => {
    // 24h：1m→1440 点、5m→288 点均超 240，15m→96 点命中
    expect(pickWindowSeconds(24 * 3600)).toBe(900)
    expect(pickWindowSeconds(7 * 86_400)).toBe(3600) // 7d → 1h(168 点)
    expect(pickWindowSeconds(365 * 86_400)).toBe(86_400) // 1 年 → 1d
  })

  it('非法跨度返回最小窗口', () => {
    expect(pickWindowSeconds(0)).toBe(60)
    expect(pickWindowSeconds(-10)).toBe(60)
  })

  it('自定义候选步长', () => {
    // span=1000，maxPoints=10：step 100 恰好 10 点即满足 ≤ 上限；9 点时升级到 500
    expect(pickWindowSeconds(1000, 10, [100, 500])).toBe(100)
    expect(pickWindowSeconds(1000, 9, [100, 500])).toBe(500)
  })
})

describe('csvEscape / csvLine', () => {
  it('普通值原样输出，null 输出空串', () => {
    expect(csvEscape('abc')).toBe('abc')
    expect(csvEscape(12.5)).toBe('12.5')
    expect(csvEscape(null)).toBe('')
    expect(csvEscape(undefined)).toBe('')
  })

  it('逗号/引号/换行包裹并转义', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('csvLine 拼接字段并带换行', () => {
    expect(csvLine([1, 'a', 'b,c'])).toBe('1,a,"b,c"\n')
  })
})

describe('effectiveRetentionDays', () => {
  it('系统覆盖优先于全局', () => {
    expect(effectiveRetentionDays(7, 90)).toBe(7)
    expect(effectiveRetentionDays(null, 90)).toBe(90)
    expect(effectiveRetentionDays(undefined, 90)).toBe(90)
  })

  it('系统级 0 表示永久保留（覆盖全局）', () => {
    expect(effectiveRetentionDays(0, 90)).toBe(0)
  })

  it('都未配置则不清理', () => {
    expect(effectiveRetentionDays(null, null)).toBe(0)
    expect(effectiveRetentionDays(null, undefined)).toBe(0)
  })

  it('负数视为永久', () => {
    expect(effectiveRetentionDays(-5, 90)).toBe(0)
    expect(effectiveRetentionDays(null, -1)).toBe(0)
  })
})
