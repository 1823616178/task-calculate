import { initDataSource } from '../database/data-source'
import { ApiKeySchema } from '../database/entities'
import type { ApiKeyEntity } from '../database/entities'
import { hashApiKey } from './apiKeyGen'

// ApiKey 同时用于数据通道、REST 与控制台登录；权限和系统范围保存在实体中。
// 短 TTL 缓存避免每次上报都查库；管理端禁用/删除最多 TTL 后生效。
const API_KEY_TTL_MS = 30_000
// last_used_at 回写节流：60 秒内多次使用只写一次，避免写放大
const LAST_USED_THROTTLE_MS = 60_000
// 正缓存改以摘要作键（原来以明文 key 作键，内存里长期留着原始凭证），
// 并设上限：超限时按插入顺序淘汰最旧条目，避免无界增长。
const CACHE_MAX = 5000
const cache = new Map<string, { apiKey: ApiKeyEntity, expiresAt: number }>()

function cacheSet(digest: string, apiKey: ApiKeyEntity, expiresAt: number): void {
  cache.delete(digest)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(digest, { apiKey, expiresAt })
}
// 无效 key 负缓存（按摘要存储、条目有上限），防止坏 key 洪峰每次直查 DB
const NEGATIVE_TTL_MS = 10_000
const NEGATIVE_MAX = 10_000
const negativeCache = new Map<string, number>()

export function clearApiKeyCache(): void {
  cache.clear()
  negativeCache.clear()
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
  const digest = hashApiKey(key)
  const cached = cache.get(digest)
  if (cached) {
    if (cached.expiresAt > now) {
      touchLastUsed(cached.apiKey)
      return cached.apiKey
    }
    // 过期条目主动删除，不留着占位。
    cache.delete(digest)
  }

  const negativeUntil = negativeCache.get(digest)
  if (negativeUntil !== undefined) {
    if (negativeUntil > now) return null
    negativeCache.delete(digest)
  }

  const ds = await initDataSource()
  const found = await ds.getRepository(ApiKeySchema).findOne({ where: { key: digest, enabled: true } })
  if (found) {
    cacheSet(digest, found, now + API_KEY_TTL_MS)
    touchLastUsed(found)
  }
  else {
    // 未命中（含被禁用）时清掉旧条目，避免残留
    cache.delete(digest)
    if (negativeCache.size >= NEGATIVE_MAX) negativeCache.clear()
    negativeCache.set(digest, now + NEGATIVE_TTL_MS)
  }
  return found
}
