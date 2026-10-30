import { ingestBatchData, IngestError, MAX_BATCH_ITEMS } from '../../services/ingestService'
import { resolveApiKey } from '../../utils/apiKey'
import { rateLimit } from '../../utils/rateLimit'
import { createSemaphore } from '../../utils/semaphore'

// HTTP 批量接收通道：POST /api/ingest/batch，头 X-Api-Key，请求体为单条报文数组。
// 与单条通道一致的保护：Content-Length 必填、64KB 上限、每 ApiKey 令牌桶、
// 全局有界并发；批量不绕过限流——每条报文各消费一个令牌。
const semaphore = createSemaphore(20, 50)
const MAX_BODY_BYTES = 64 * 1024
const RATE_PER_SEC = 20
const RATE_BURST = 50
const IP_RATE_PER_SEC = 50
const IP_RATE_BURST = 100

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event) ?? 'unknown'
  if (!rateLimit(`http-ip:${ip}`, IP_RATE_PER_SEC, IP_RATE_BURST)) {
    throw createError({ statusCode: 429, statusMessage: 'rate limited' })
  }

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

  const body = await readBody(event)
  if (!Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'batch payload must be an array' })
  }
  if (body.length === 0 || body.length > MAX_BATCH_ITEMS) {
    throw createError({ statusCode: 400, statusMessage: `batch size must be between 1 and ${MAX_BATCH_ITEMS}` })
  }
  for (let i = 0; i < body.length; i++) {
    if (!rateLimit(`http:${apiKey.id}`, RATE_PER_SEC, RATE_BURST)) {
      throw createError({ statusCode: 429, statusMessage: 'rate limited' })
    }
  }

  try {
    const result = await semaphore.run(() => ingestBatchData(body, 'http', {
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
    console.error('[ingest:http-batch] unexpected error:', err)
    throw createError({ statusCode: 500, statusMessage: 'internal ingest error' })
  }
})
