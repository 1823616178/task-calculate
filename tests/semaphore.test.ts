import { describe, expect, it } from 'vitest'
import { createSemaphore } from '../server/utils/semaphore'

describe('createSemaphore', () => {
  it('限制并发不超过 limit', async () => {
    const sem = createSemaphore(2)
    let active = 0
    let peak = 0
    const task = async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
    }
    await Promise.all(Array.from({ length: 8 }, () => sem.run(task)))
    expect(peak).toBe(2)
  })

  it('等待队列满时丢弃（返回 null）', async () => {
    const sem = createSemaphore(1, 1)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = sem.run(() => gate)
    const queued = sem.run(async () => 1)
    const dropped = await sem.run(async () => 2)
    expect(dropped).toBeNull()
    release()
    expect(await first).toBeUndefined()
    expect(await queued).toBe(1)
  })

  it('任务抛异常也会释放槽位', async () => {
    const sem = createSemaphore(1)
    const boom = sem.run(async () => {
      throw new Error('boom')
    }).catch(() => 'caught')
    const next = sem.run(async () => 'ok')
    expect(await boom).toBe('caught')
    expect(await next).toBe('ok')
    expect(sem.active).toBe(0)
  })
})
