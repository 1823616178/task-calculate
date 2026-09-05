import { describe, expect, it } from 'vitest'
import { stringifyPayload } from '../server/utils/payload'

describe('stringifyPayload', () => {
  it('序列化原始报文', () => {
    expect(stringifyPayload({ value: 1 })).toBe('{"value":1}')
    expect(stringifyPayload(null)).toBe('null')
  })

  it('无法序列化时返回 null', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(stringifyPayload(circular)).toBeNull()
  })

  it('超长报文截断并标记', () => {
    const out = stringifyPayload({ value: 'x'.repeat(5000) }, 100)
    expect(out).not.toBeNull()
    expect(out!.length).toBe(100)
    expect(out!.endsWith('…(truncated)')).toBe(true)
  })

  it('长度足够时不截断', () => {
    expect(stringifyPayload({ a: 1 }, 4096)).toBe('{"a":1}')
  })
})
