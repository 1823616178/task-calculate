import { API_KEY_COOKIE, AUTH_COOKIE } from '../../utils/auth'

export default defineEventHandler((event) => {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
  deleteCookie(event, API_KEY_COOKIE, { path: '/' })
  return { ok: true }
})
