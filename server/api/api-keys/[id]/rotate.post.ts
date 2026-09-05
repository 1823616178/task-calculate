import { initDataSource } from '../../../database/data-source'
import { ApiKeySchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'
import { generateApiKey } from '../../../utils/apiKeyGen'
import { clearApiKeyCache } from '../../../utils/apiKey'
import { recordAudit } from '../../../utils/audit'

// 轮换：生成新 key，旧 key 立即失效；完整新 key 仅本次响应返回一次
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(ApiKeySchema)
  const apiKey = await repo.findOne({ where: { id } })
  if (!apiKey) {
    throw createError({ statusCode: 404, statusMessage: 'api key not found' })
  }

  apiKey.key = generateApiKey()
  await repo.save(apiKey)
  clearApiKeyCache()
  recordAudit(admin, 'apiKey.rotate', `${apiKey.systemId}/${apiKey.name}`)
  return { apiKey: { id: apiKey.id, key: apiKey.key } }
})
