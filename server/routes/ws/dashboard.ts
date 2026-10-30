import { verifyAuthToken } from '../../utils/jwt'
import { API_KEY_COOKIE, AUTH_COOKIE } from '../../utils/auth'
import { resolveApiKey } from '../../utils/apiKey'
import { registerDashboardPeer, unregisterDashboardPeer } from '../../services/broadcastService'

// WS 推送通道：/ws/dashboard。认证优先取同源握手自动携带的 httpOnly Cookie，
// 避免 token 出现在 URL 中泄漏到访问/代理日志；?token= 查询参数保留作兼容兜底。
export default defineWebSocketHandler({
  async open(peer) {
    let token: string | null = null
    let apiKey: string | null = null

    const req = peer.request
    const cookieHeader = req?.headers?.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(part => part.trim())
      const authCookie = cookies.find(part => part.startsWith(`${AUTH_COOKIE}=`))
      const apiKeyCookie = cookies.find(part => part.startsWith(`${API_KEY_COOKIE}=`))
      if (authCookie) token = decodeURIComponent(authCookie.slice(AUTH_COOKIE.length + 1))
      if (apiKeyCookie) apiKey = decodeURIComponent(apiKeyCookie.slice(API_KEY_COOKIE.length + 1))
    }

    try {
      const query = new URL(req?.url || '', 'http://localhost').searchParams
      if (!token) token = query.get('token')
      apiKey = req?.headers?.get('x-api-key') || query.get('apiKey') || apiKey
    }
    catch {
      token = null
      apiKey = null
    }

    const user = token ? verifyAuthToken(token) : null
    if (user) {
      registerDashboardPeer(peer)
      return
    }

    const resolved = await resolveApiKey(apiKey ?? undefined)
    if (resolved?.permissions.includes('data:read')) {
      registerDashboardPeer(peer, resolved.allSystems ? null : resolved.systemIds, resolved.id)
      return
    }

    // 明确告知认证失败，客户端停止重连
    peer.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'unauthorized' }))
    peer.close()
  },

  // 心跳：客户端每 30s 发 {"type":"ping"}，服务端回 {"type":"pong"}。
  // 原来没有任何心跳，代理 / NAT 静默掐断后的“半开连接”客户端察觉不到，
  // 看板会一直显示“已连接”却收不到推送；现在靠 pong 超时触发重连。
  message(peer, message) {
    let text = ''
    try {
      text = message.text()
    }
    catch {
      return
    }
    if (text === '{"type":"ping"}' || text === 'ping') {
      peer.send(JSON.stringify({ type: 'pong' }))
    }
  },

  close(peer) {
    unregisterDashboardPeer(peer)
  },

  error(peer, error) {
    console.error('[ws:dashboard] peer error:', error)
    unregisterDashboardPeer(peer)
  },
})
