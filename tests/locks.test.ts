import { describe, expect, it, vi } from 'vitest'
import { withLock } from '../server/utils/locks'

describe('withLock 同 key 串行化', () => {
  it('同一 key 的临界区按调用顺序执行', async () => {
    const order: number[] = []
    const release: Array<() => void> = []
    const gate = (i: number) => new Promise<void>((resolve) => {
      release[i] = resolve
    })

    const p1 = withLock('k', async () => {
      order.push(1)
      await gate(0)
      order.push(2)
    })
    const p2 = withLock('k', async () => {
      order.push(3)
    })

    // p2 必须等 p1 释放后才执行
    await Promise.resolve()
    expect(order).toEqual([1])
    release[0]!()
    await Promise.all([p1, p2])
    expect(order).toEqual([1, 2, 3])
  })

  it('不同 key 互不阻塞', async () => {
    const order: number[] = []
    const a = withLock('a', async () => {
      await new Promise(r => setTimeout(r, 20))
      order.push('a')
    })
    const b = withLock('b', async () => {
      order.push('b')
    })
    await Promise.all([a, b])
    expect(order).toEqual(['b', 'a'])
  })

  it('前一个临界区失败不阻塞后续', async () => {
    const calls: string[] = []
    const p1 = withLock('k', async () => {
      calls.push('first')
      throw new Error('boom')
    })
    const p2 = withLock('k', async () => {
      calls.push('second')
    })
    await expect(p1).rejects.toThrow('boom')
    await p2
    expect(calls).toEqual(['first', 'second'])
  })

  it('锁完成后清理 map，避免长期运行内存泄漏', async () => {
    await withLock('cleanup', async () => undefined)
    // 触发一次微任务让清理逻辑执行
    await new Promise(r => setTimeout(r, 0))
    // 重新加锁仍可用（内部 map 已清理，无法直接断言；此用例确保无死锁）
    await expect(withLock('cleanup', async () => 1)).resolves.toBe(1)
  })

  it('并发计数正确性（100 个任务全部完成）', async () => {
    let done = 0
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => withLock('bulk', async () => {
        done += 1
        expect(done).toBeLessThanOrEqual(i + 1)
      })),
    )
    expect(done).toBe(100)
  })
})

describe('withLock 返回值', () => {
  it('透传临界区返回值', async () => {
    const r = await withLock('v', async () => ({ x: 42 }))
    expect(r).toEqual({ x: 42 })
  })

  it('不被并发写入方观察到中间态', async () => {
    let value = 0
    const results: number[] = []
    await Promise.all(
      Array.from({ length: 10 }, () => withLock('shared', async () => {
        const snapshot = value
        await new Promise(r => setTimeout(r, 1))
        value = snapshot + 1
        results.push(value)
      })),
    )
    expect(value).toBe(10)
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('vi 时空转不报错', async () => {
    const spy = vi.fn()
    await withLock('spy', spy as never)
    expect(spy).toHaveBeenCalledOnce()
  })
})
