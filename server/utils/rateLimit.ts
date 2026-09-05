// 进程内令牌桶限流：按 key（如 apiKey id / 客户端 IP）限制速率，防止有效凭据下的洪峰写入。
// 桶惰性创建、超时回收，避免长期运行的内存膨胀。
interface Bucket {
  tokens: number
  lastAt: number
}

const buckets = new Map<string, Bucket>()
const SWEEP_THRESHOLD = 10_000
const IDLE_MS = 10 * 60_000

function sweep(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return
  for (const [key, b] of buckets) {
    if (now - b.lastAt > IDLE_MS) buckets.delete(key)
  }
}

/**
 * 尝试消费一个令牌：true=放行，false=超限。
 * @param key 限流维度标识
 * @param ratePerSec 每秒补充令牌数
 * @param burst 桶容量（最大突发）
 */
export function rateLimit(key: string, ratePerSec: number, burst: number): boolean {
  const now = Date.now()
  sweep(now)
  const b = buckets.get(key)
  if (!b) {
    buckets.set(key, { tokens: burst - 1, lastAt: now })
    return true
  }
  const elapsed = (now - b.lastAt) / 1000
  b.tokens = Math.min(burst, b.tokens + elapsed * ratePerSec)
  b.lastAt = now
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}

export function resetRateLimiter(): void {
  buckets.clear()
}
