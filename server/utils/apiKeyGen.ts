import { randomBytes } from 'node:crypto'
import type { ApiKeyEntity } from '../database/entities'

export function generateApiKey(): string {
  return `dk_${randomBytes(12).toString('hex')}`
}

// 列表展示用掩码：保留前缀与尾 4 位
export function maskApiKey(key: string): string {
  if (key.length <= 12) return key
  return `${key.slice(0, 8)}…${key.slice(-4)}`
}

export type { ApiKeyEntity }
