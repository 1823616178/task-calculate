// 登录失败限流（进程内）：同一 用户名+IP 连续失败 N 次后锁定一段时间，防止暴力破解。
// 多实例部署时需替换为 Redis 等共享存储（见 doc/ROADMAP.md）。
const MAX_FAILURES = 5
const LOCK_DURATION_MS = 15 * 60_000
const MAX_TRACKED_KEYS = 10_000

interface Attempt {
  failures: number
  lockedUntil: number
}

const attempts = new Map<string, Attempt>()

function sweep(now: number): void {
  if (attempts.size <= MAX_TRACKED_KEYS) return
  for (const [key, attempt] of attempts) {
    if (attempt.failures === 0 && attempt.lockedUntil <= now) attempts.delete(key)
  }
}

export function loginLocked(key: string, now: number = Date.now()): boolean {
  const attempt = attempts.get(key)
  return attempt !== undefined && attempt.lockedUntil > now
}

export function loginRetryAfterMs(key: string, now: number = Date.now()): number {
  const attempt = attempts.get(key)
  return attempt ? Math.max(0, attempt.lockedUntil - now) : 0
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  sweep(now)
  const attempt = attempts.get(key) ?? { failures: 0, lockedUntil: 0 }
  attempt.failures += 1
  if (attempt.failures >= MAX_FAILURES) {
    attempt.lockedUntil = now + LOCK_DURATION_MS
    attempt.failures = 0
  }
  attempts.set(key, attempt)
}

export function recordLoginSuccess(key: string): void {
  attempts.delete(key)
}

export function resetLoginGuard(): void {
  attempts.clear()
}
