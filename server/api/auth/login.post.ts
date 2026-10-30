import bcrypt from 'bcryptjs'
import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { apiKeyLoginSchema, firstZodMessage, loginSchema } from '../../utils/validation'
import { signAuthToken } from '../../utils/jwt'
import { API_KEY_COOKIE, AUTH_COOKIE, principalView } from '../../utils/auth'
import { resolveApiKey } from '../../utils/apiKey'
import { loginLocked, loginRetryAfterMs, recordLoginFailure, recordLoginSuccess } from '../../utils/loginGuard'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const keyLogin = apiKeyLoginSchema.safeParse(body)
  if (keyLogin.success) {
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    const guardKey = `apikey@${ip}`
    if (loginLocked(guardKey)) {
      const retryAfter = Math.max(1, Math.ceil(loginRetryAfterMs(guardKey) / 1000))
      setHeader(event, 'retry-after', retryAfter)
      throw createError({ statusCode: 429, statusMessage: 'too many attempts', message: '失败次数过多，请稍后再试' })
    }
    const apiKey = await resolveApiKey(keyLogin.data.apiKey)
    if (!apiKey) {
      recordLoginFailure(guardKey)
      throw createError({ statusCode: 401, statusMessage: 'invalid api key', message: 'ApiKey 无效或已禁用' })
    }
    if (!apiKey.permissions.includes('data:read')) {
      throw createError({ statusCode: 403, statusMessage: 'console login requires data:read', message: '该 ApiKey 未授权登录控制台所需的 data:read' })
    }
    recordLoginSuccess(guardKey)
    deleteCookie(event, AUTH_COOKIE, { path: '/' })
    setCookie(event, API_KEY_COOKIE, keyLogin.data.apiKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
    return { token: null, user: principalView({ kind: 'apiKey', apiKey }) }
  }

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
    // 按实际访问协议决定：HTTP 部署（内网 / 公网 IP 直连）若带 Secure，浏览器会丢弃 Cookie，登录后所有接口 401。
    // 经 HTTPS 反向代理时通过 X-Forwarded-Proto 识别。
    secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  deleteCookie(event, API_KEY_COOKIE, { path: '/' })

  return { token, user: principalView({ kind: 'user', userId: user.id, username: user.username, role: user.role }) }
})
