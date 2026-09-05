import { createHash, randomBytes } from 'node:crypto'
import type { ApiKeyEntity } from '../database/entities'

export function generateApiKey(): string {
  return `dk_${randomBytes(12).toString('hex')}`
}

// 明文 key 只在创建/轮换时返回一次；库内仅存 SHA-256 摘要，校验时比对摘要
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// 列表展示用掩码：基于入库时保存的前缀（如 dk_ab12…）
export function maskApiKey(prefix: string | null): string {
  if (!prefix) return '—'
  return `${prefix}…`
}

export type { ApiKeyEntity }
