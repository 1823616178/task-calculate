// 展示用格式化工具（全站共享，替代各页面重复实现）

export function formatDate(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === '') return '—'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  // 固定格式：toLocaleString() 随浏览器语言变化（英文环境显示 8/27/2026, 12:18:30 AM），且 SSR 与客户端可能不一致
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDateOnly(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === '') return '—'
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 相对时间："12 秒前"、"3 分钟前"；超过 30 天回落到绝对时间
export function formatRelative(input: string | null | undefined): string {
  if (!input) return '—'
  const t = new Date(input).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return '刚刚'
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day <= 30) return `${day} 天前`
  return formatDate(input)
}

// 是否长时间未上报（超过 10 分钟视为陈旧，看板标灰）
export function isStaleReportedAt(input: string | null | undefined, thresholdMs = 10 * 60_000): boolean {
  if (!input) return true
  const t = new Date(input).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > thresholdMs
}

// 阈值区间展示："20 ~ 80"、开边界显示 ±∞
export function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return '—'
  return `${min ?? '-∞'} ~ ${max ?? '+∞'}`
}
