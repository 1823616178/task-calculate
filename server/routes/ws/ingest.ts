import { resolveApiKey } from '../../utils/apiKey'
import { ingestData, IngestError } from '../../services/ingestService'

interface IngestWsContext {
  authed?: boolean
  systemId?: number
}

// WS 接收通道：/ws/ingest。连接后首帧 {"apiKey":"..."} 认证，之后每帧为上报报文。
// ApiKey 绑定系统，系统绑定校验统一在 ingestData 管道内完成。
export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ type: 'auth.required', message: 'send {"apiKey":"..."} first' }))
  },

  async message(peer, message) {
    const ctx = peer.context as IngestWsContext

    let data: unknown
    try {
      data = JSON.parse(message.text())
    }
    catch {
      peer.send(JSON.stringify({ type: 'error', message: 'invalid JSON' }))
      return
    }

    if (!ctx.authed) {
      const key = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).apiKey : undefined
      const apiKey = await resolveApiKey(typeof key === 'string' ? key : undefined)
      if (!apiKey) {
        peer.send(JSON.stringify({ type: 'error', message: 'invalid api key' }))
        peer.close()
        return
      }
      ctx.authed = true
      ctx.systemId = apiKey.systemId
      peer.send(JSON.stringify({ type: 'auth.ok' }))
      return
    }

    try {
      const result = await ingestData(data, 'ws', { expectedSystemId: ctx.systemId })
      peer.send(JSON.stringify({ type: 'ingest.ok', ...result }))
    }
    catch (err) {
      if (err instanceof IngestError) {
        peer.send(JSON.stringify({ type: 'error', message: err.message }))
      }
      else {
        console.error('[ws:ingest] unexpected error:', err)
        peer.send(JSON.stringify({ type: 'error', message: 'internal ingest error' }))
      }
    }
  },
})
