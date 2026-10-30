import { ingestData, IngestError } from '../services/ingestService'
import { resolveApiKey } from '../utils/apiKey'
import { rateLimit } from '../utils/rateLimit'
import { createSemaphore } from '../utils/semaphore'

// 与 MQTT 通道对齐的并发保护：全局有界并发 + 有界等待队列，溢出返回 429
const semaphore = createSemaphore(50, 200)
// 请求体上限：超过直接 413（截断发生在完整读入内存之后，必须在入口拒绝）
const MAX_BODY_BYTES = 64 * 1024
// 每 ApiKey 速率：20/s，突发 50
const RATE_PER_SEC = 20
const RATE_BURST = 50
// 每客户端 IP 速率（鉴权前）：限制无效 key 反复查库
const IP_RATE_PER_SEC = 50
const IP_RATE_BURST = 100

// HTTP 接收通道：POST /api/ingest，头 X-Api-Key。
// ApiKey 需要 data:write，系统范围校验统一在 ingestData 管道内完成。
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event) ?? 'unknown'
  if (!rateLimit(`http-ip:${ip}`, IP_RATE_PER_SEC, IP_RATE_BURST)) {
    throw createError({ statusCode: 429, statusMessage: 'rate limited' })
  }

  // 必须带 Content-Length：chunked 请求无法在读入前判断大小，readBody 会把整个请求体读进内存
  const contentLength = getHeader(event, 'content-length')
  if (contentLength === undefined) {
    throw createError({ statusCode: 411, statusMessage: 'content-length required' })
  }
  const length = Number(contentLength)
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'payload too large' })
  }

  const apiKey = await resolveApiKey(getHeader(event, 'x-api-key'))
  if (!apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'invalid api key' })
  }
  if (!apiKey.permissions.includes('data:write')) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' })
  }
  if (!rateLimit(`http:${apiKey.id}`, RATE_PER_SEC, RATE_BURST)) {
    throw createError({ statusCode: 429, statusMessage: 'rate limited' })
  }

  const body = await readBody(event)

  try {
    const result = await semaphore.run(() => ingestData(body, 'http', {
      allowedSystemIds: apiKey.allSystems ? undefined : apiKey.systemIds,
    }))
    if (result === null) {
      throw new IngestError('too many concurrent requests', 429)
    }
    return result
  }
  catch (err) {
    if (err instanceof IngestError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    console.error('[ingest:http] unexpected error:', err)
    throw createError({ statusCode: 500, statusMessage: 'internal ingest error' })
  }
})
