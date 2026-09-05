import { initDataSource } from '../database/data-source'
import { ApiKeySchema } from '../database/entities'
import type { ApiKeyEntity } from '../database/entities'

// 数据提交方凭 ApiKey 调用 HTTP / WS 接收通道；ApiKey 绑定到某个系统。
// 短 TTL 缓存避免每次上报都查库；管理端禁用/删除最多 TTL 后生效。
const API_KEY_TTL_MS = 30_000
// last_used_at 回写节流：60 秒内多次使用只写一次，避免写放大
const LAST_USED_THROTTLE_MS = 60_000
const cache = new Map<string, { apiKey: ApiKeyEntity, expiresAt: number }>()

export function clearApiKeyCache(): void {
  cache.clear()
}

function touchLastUsed(apiKey: ApiKeyEntity): void {
  const now = Date.now()
  const last = apiKey.lastUsedAt ? apiKey.lastUsedAt.getTime() : 0
  if (now - last < LAST_USED_THROTTLE_MS) return
  apiKey.lastUsedAt = new Date(now)
  void initDataSource()
    .then(ds => ds.getRepository(ApiKeySchema).update(apiKey.id, { lastUsedAt: apiKey.lastUsedAt }))
    .catch(() => undefined)
}

export async function resolveApiKey(key: string | undefined): Promise<ApiKeyEntity | null> {
  if (!key) return null

  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) {
    touchLastUsed(cached.apiKey)
    return cached.apiKey
  }

  const ds = await initDataSource()
  const found = await ds.getRepository(ApiKeySchema).findOne({ where: { key, enabled: true } })
  if (found) {
    cache.set(key, { apiKey: found, expiresAt: now + API_KEY_TTL_MS })
    touchLastUsed(found)
  }
  else {
    // 未命中（含被禁用）时清掉旧条目，避免残留
    cache.delete(key)
  }
  return found
}
