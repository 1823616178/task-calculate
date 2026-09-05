// 进程内按 key 串行化异步临界区（per-metric ingest 互斥）。
// 同一 key 的临界区按调用顺序依次执行；不同 key 互不阻塞。
const locks = new Map<string, Promise<void>>()

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve()
  const result = prev.then(fn, fn)
  const tail = result.then(() => undefined, () => undefined)
  locks.set(key, tail)
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key)
  })
  return result
}
