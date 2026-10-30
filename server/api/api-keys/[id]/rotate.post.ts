import { initDataSource } from '../../../database/data-source'
import { ApiKeySchema } from '../../../database/entities'
import { disconnectDashboardApiKey } from '../../../services/broadcastService'
import { API_KEY_COOKIE, requireApiKeyManageable, requirePermission } from '../../../utils/auth'
import { generateApiKey, hashApiKey } from '../../../utils/apiKeyGen'
import { clearApiKeyCache } from '../../../utils/apiKey'
import { recordAudit } from '../../../utils/audit'

// 轮换：生成新 key，旧 key 立即失效；完整新 key 仅本次响应返回一次
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'apiKeys:manage')
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
  requireApiKeyManageable(admin, apiKey)

  const plainKey = generateApiKey()
  apiKey.key = hashApiKey(plainKey)
  apiKey.keyPrefix = plainKey.slice(0, 8)
  await repo.save(apiKey)
  clearApiKeyCache()
  disconnectDashboardApiKey(apiKey.id)
  if (admin.kind === 'apiKey' && admin.apiKey.id === apiKey.id) {
    setCookie(event, API_KEY_COOKIE, plainKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getRequestProtocol(event, { xForwardedProto: true }) === 'https',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }
  recordAudit(admin, 'apiKey.rotate', apiKey.name)
  return { apiKey: { id: apiKey.id, key: plainKey } }
})
