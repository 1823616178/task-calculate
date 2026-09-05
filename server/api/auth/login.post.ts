import bcrypt from 'bcryptjs'
import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { firstZodMessage, loginSchema } from '../../utils/validation'
import { signAuthToken } from '../../utils/jwt'
import { AUTH_COOKIE } from '../../utils/auth'
import { loginLocked, loginRetryAfterMs, recordLoginFailure, recordLoginSuccess } from '../../utils/loginGuard'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  // 按 用户名+IP 限流：连续失败锁定，防暴力破解
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const guardKey = `${parsed.data.username.toLowerCase()}@${ip}`
  if (loginLocked(guardKey)) {
    const retryAfter = Math.max(1, Math.ceil(loginRetryAfterMs(guardKey) / 1000))
    setHeader(event, 'retry-after', retryAfter)
    throw createError({ statusCode: 429, statusMessage: 'too many attempts', message: '失败次数过多，请稍后再试' })
  }

  const ds = await initDataSource()
  const user = await ds.getRepository(UserSchema).findOne({ where: { username: parsed.data.username } })
  const passwordOk = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
  if (!user || !passwordOk) {
    recordLoginFailure(guardKey)
    throw createError({ statusCode: 401, statusMessage: 'invalid credentials', message: '用户名或密码错误' })
  }
  if (!user.enabled) {
    recordLoginFailure(guardKey)
    throw createError({ statusCode: 403, statusMessage: 'user disabled', message: '账号已被禁用，请联系管理员' })
  }

  recordLoginSuccess(guardKey)
  const token = signAuthToken({ userId: user.id, username: user.username, role: user.role })
  setCookie(event, AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return { token, user: { id: user.id, username: user.username, role: user.role } }
})
