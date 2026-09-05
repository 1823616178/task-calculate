import { beforeEach, describe, expect, it } from 'vitest'
import {
  loginLocked,
  loginRetryAfterMs,
  recordLoginFailure,
  recordLoginSuccess,
  resetLoginGuard,
} from '../server/utils/loginGuard'

const T = 1_000_000

describe('loginGuard', () => {
  beforeEach(() => resetLoginGuard())

  it('连续失败 4 次不锁定', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('u@a', T)
    expect(loginLocked('u@a', T)).toBe(false)
  })

  it('连续失败 5 次锁定 15 分钟', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure('u@a', T)
    expect(loginLocked('u@a', T)).toBe(true)
    expect(loginLocked('u@a', T + 15 * 60_000 - 1)).toBe(true)
    expect(loginLocked('u@a', T + 15 * 60_000)).toBe(false)
    expect(loginRetryAfterMs('u@a', T)).toBe(15 * 60_000)
  })

  it('锁定过期后失败次数重新计数', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure('u@a', T)
    recordLoginFailure('u@a', T + 16 * 60_000)
    expect(loginLocked('u@a', T + 16 * 60_000)).toBe(false)
  })

  it('登录成功清空失败计数', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure('u@a', T)
    recordLoginSuccess('u@a')
    recordLoginFailure('u@a', T + 1)
    expect(loginLocked('u@a', T + 1)).toBe(false)
  })

  it('不同 key 相互独立', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure('u@a', T)
    expect(loginLocked('u@b', T)).toBe(false)
  })
})
