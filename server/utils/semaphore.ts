// 简单异步信号量：限制并发 + 有界等待队列，队列满时丢弃（run 返回 null）
export interface Semaphore {
  readonly active: number
  readonly queued: number
  run<T>(fn: () => Promise<T>): Promise<T | null>
}

export function createSemaphore(limit: number, maxQueue: number = Number.POSITIVE_INFINITY): Semaphore {
  if (limit < 1) throw new Error('limit must be >= 1')
  let active = 0
  const waiters: Array<() => void> = []

  function release(): void {
    active -= 1
    const next = waiters.shift()
    if (next) {
      active += 1
      next()
    }
  }

  return {
    get active() {
      return active
    },
    get queued() {
      return waiters.length
    },
    async run<T>(fn: () => Promise<T>): Promise<T | null> {
      if (active >= limit) {
        if (waiters.length >= maxQueue) return null
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
        })
      }
      else {
        active += 1
      }
      try {
        return await fn()
      }
      finally {
        release()
      }
    },
  }
}
