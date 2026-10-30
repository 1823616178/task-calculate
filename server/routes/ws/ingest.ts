import { resolveApiKey } from '../../utils/apiKey'
import { ingestData, IngestError } from '../../services/ingestService'
import { rateLimit } from '../../utils/rateLimit'
import { createSemaphore } from '../../utils/semaphore'

interface IngestWsContext {
  // 保存明文 key 以便每帧复核（走 resolveApiKey 缓存；管理端禁用/删除/轮换会清缓存，立即生效）
  apiKey?: string
}

// 与 HTTP/MQTT 通道对齐：单帧大小上限、全局有界并发、每 Key 速率限制
const semaphore = createSemaphore(50, 200)
const MAX_FRAME_BYTES = 64 * 1024
const RATE_PER_SEC = 20
const RATE_BURST = 50

// WS 接收通道：/ws/ingest。连接后首帧 {"apiKey":"..."} 认证，之后每帧为上报报文。
// ApiKey 需要 data:write，系统范围校验统一在 ingestData 管道内完成。
export default defineWebSocketHandler({
  open(peer) {
    peer.send(JSON.stringify({ type: 'auth.required', message: 'send {"apiKey":"..."} first' }))
  },

  async message(peer, message) {
    const ctx = peer.context as IngestWsContext

    const text = message.text()
    if (Buffer.byteLength(text) > MAX_FRAME_BYTES) {
      peer.send(JSON.stringify({ type: 'error', message: 'frame too large' }))
      return
    }

    let data: unknown
    try {
      data = JSON.parse(text)
    }
    catch {
      peer.send(JSON.stringify({ type: 'error', message: 'invalid JSON' }))
      return
    }

    if (ctx.apiKey === undefined) {
      const key = typeof data === 'object' && data !== null ? (data as Record<string, unknown>).apiKey : undefined
      const apiKey = await resolveApiKey(typeof key === 'string' ? key : undefined)
      if (!apiKey || !apiKey.permissions.includes('data:write')) {
        peer.send(JSON.stringify({ type: 'error', message: 'invalid api key' }))
        peer.close()
        return
      }
      ctx.apiKey = key as string
      peer.send(JSON.stringify({ type: 'auth.ok' }))
      return
    }

    // 已认证连接每帧复核 key，禁用/删除/轮换后断开
    const apiKey = await resolveApiKey(ctx.apiKey)
    if (!apiKey || !apiKey.permissions.includes('data:write')) {
      peer.send(JSON.stringify({ type: 'error', message: 'api key revoked' }))
      peer.close()
      return
    }

    if (!rateLimit(`ws:${apiKey.id}`, RATE_PER_SEC, RATE_BURST)) {
      peer.send(JSON.stringify({ type: 'error', message: 'rate limited' }))
      return
    }

    try {
      const result = await semaphore.run(() => ingestData(data, 'ws', {
        allowedSystemIds: apiKey.allSystems ? undefined : apiKey.systemIds,
      }))
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
