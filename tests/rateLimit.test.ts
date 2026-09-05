import { afterEach, describe, expect, it } from 'vitest'
import { rateLimit, resetRateLimiter } from '../server/utils/rateLimit'

afterEach(() => {
  resetRateLimiter()
})

describe('rateLimit 令牌桶', () => {
  it('突发额度内全部放行', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('k', 1, 5)).toBe(true)
    }
  })

  it('超过突发容量后拒绝', () => {
    for (let i = 0; i < 5; i++) rateLimit('k', 1, 5)
    expect(rateLimit('k', 1, 5)).toBe(false)
  })

  it('时间推移后按速率补充令牌', async () => {
    for (let i = 0; i < 2; i++) rateLimit('k', 10, 2)
    expect(rateLimit('k', 10, 2)).toBe(false)
    // 等待 150ms，按 10/s 应补充 ~1.5 个令牌
    await new Promise(r => setTimeout(r, 150))
    expect(rateLimit('k', 10, 2)).toBe(true)
  })

  it('不同 key 相互独立', () => {
    for (let i = 0; i < 3; i++) rateLimit('a', 1, 3)
    expect(rateLimit('a', 1, 3)).toBe(false)
    expect(rateLimit('b', 1, 3)).toBe(true)
  })

  it('重置后恢复', () => {
    for (let i = 0; i < 3; i++) rateLimit('r', 1, 3)
    expect(rateLimit('r', 1, 3)).toBe(false)
    resetRateLimiter()
    expect(rateLimit('r', 1, 3)).toBe(true)
  })
})
