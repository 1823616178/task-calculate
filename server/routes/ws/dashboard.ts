import { verifyAuthToken } from '../../utils/jwt'
import { AUTH_COOKIE } from '../../utils/auth'
import { registerDashboardPeer, unregisterDashboardPeer } from '../../services/broadcastService'

// WS 推送通道：/ws/dashboard。认证优先取同源握手自动携带的 httpOnly Cookie，
// 避免 token 出现在 URL 中泄漏到访问/代理日志；?token= 查询参数保留作兼容兜底。
export default defineWebSocketHandler({
  open(peer) {
    let token: string | null = null

    const req = peer.request
    const cookieHeader = req?.headers?.get('cookie')
    if (cookieHeader) {
      const matched = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${AUTH_COOKIE}=`))
      if (matched) token = decodeURIComponent(matched.slice(AUTH_COOKIE.length + 1))
    }

    if (!token) {
      try {
        token = new URL(req?.url || '', 'http://localhost').searchParams.get('token')
      }
      catch {
        token = null
      }
    }

    const user = token ? verifyAuthToken(token) : null
    if (!user) {
      // 明确告知认证失败，客户端停止重连
      peer.send(JSON.stringify({ type: 'error', code: 'unauthorized', message: 'unauthorized' }))
      peer.close()
      return
    }

    registerDashboardPeer(peer)
  },

  close(peer) {
    unregisterDashboardPeer(peer)
  },

  error(peer, error) {
    console.error('[ws:dashboard] peer error:', error)
    unregisterDashboardPeer(peer)
  },
})
