import { ingestData, IngestError } from '../services/ingestService'
import { resolveApiKey } from '../utils/apiKey'

// HTTP 接收通道：POST /api/ingest，头 X-Api-Key。
// ApiKey 绑定系统，系统绑定校验统一在 ingestData 管道内完成。
export default defineEventHandler(async (event) => {
  const apiKey = await resolveApiKey(getHeader(event, 'x-api-key'))
  if (!apiKey) {
    throw createError({ statusCode: 401, statusMessage: 'invalid api key' })
  }

  const body = await readBody(event)

  try {
    return await ingestData(body, 'http', { expectedSystemId: apiKey.systemId })
  }
  catch (err) {
    if (err instanceof IngestError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    console.error('[ingest:http] unexpected error:', err)
    throw createError({ statusCode: 500, statusMessage: 'internal ingest error' })
  }
})
