import { resolveApiKey } from '../../utils/apiKey'
import { ingestData, IngestError } from '../../services/ingestService'
import { rateLimit } from '../../utils/rateLimit'
import { createSemaphore } from '../../utils/semaphore'

interface IngestWsContext {
  authed?: boolean
  systemId?: number
  apiKeyId?: number
}

// 与 HTTP/MQTT 通道对齐：单帧大小上限、全局有界并发、每 Key 速率限制
const semaphore = createSemaphore(50, 200)
const MAX_FRAME_BYTES = 64 * 1024
const RATE_PER_SEC = 20
const RATE_BURST = 50

// WS 接收通道：/ws/ingest。连接后首帧 {"apiKey":"..."} 认证，之后每帧为上报报文。
// ApiKey 绑定系统，系统绑定校验统一在 ingestData 管道内完成。
export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ type: 'auth.required', message: 'send {"apiKey":"..."} first' }))
  },

  async message(peer, message) {
    const ctx = peer.context as IngestWsContext

    const bytes = message.text().length
    if (bytes > MAX_FRAME_BYTES) {
      peer.send(JSON.stringify({ type: 'error', message: 'frame too large' }))
      return
    }

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
      ctx.apiKeyId = apiKey.id
      peer.send(JSON.stringify({ type: 'auth.ok' }))
      return
    }

    if (!rateLimit(`ws:${ctx.apiKeyId}`, RATE_PER_SEC, RATE_BURST)) {
      peer.send(JSON.stringify({ type: 'error', message: 'rate limited' }))
      return
    }

    try {
      const result = await semaphore.run(() => ingestData(data, 'ws', { expectedSystemId: ctx.systemId }))
      if (result === null) {
        peer.send(JSON.stringify({ type: 'error', message: 'too many concurrent requests' }))
        return
      }
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
