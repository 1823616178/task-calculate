import type { MetricStatus } from '../../shared/types'

export interface Thresholds {
  warnMin: number | null
  warnMax: number | null
  alarmMin: number | null
  alarmMax: number | null
}

function isOutside(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return true
  if (max !== null && value > max) return true
  return false
}

/**
 * 阈值判定（纯函数）：
 * - 未配置任何阈值 → none（只记录不判定）
 * - 超出 alarm 区间 → alarm
 * - 超出 warn 区间（但在 alarm 区间内）→ warning
 * - 其余 → normal
 */
export function evaluateStatus(value: number, thresholds: Thresholds): MetricStatus {
  const hasWarn = thresholds.warnMin !== null || thresholds.warnMax !== null
  const hasAlarm = thresholds.alarmMin !== null || thresholds.alarmMax !== null

  if (!hasWarn && !hasAlarm) return 'none'
  if (hasAlarm && isOutside(value, thresholds.alarmMin, thresholds.alarmMax)) return 'alarm'
  if (hasWarn && isOutside(value, thresholds.warnMin, thresholds.warnMax)) return 'warning'
  return 'normal'
}
