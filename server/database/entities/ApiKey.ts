import { EntitySchema } from 'typeorm'
import type { SystemEntity } from './System'

export interface ApiKeyEntity {
  id: number
  systemId: number
  // 仅存明文 key 的 SHA-256 摘要；校验时对提交方 key 摘要后比对
  key: string
  // 明文 key 前 8 位，列表展示用（明文不再可查）
  keyPrefix: string | null
  name: string
  enabled: boolean
  lastUsedAt: Date | null
  createdAt: Date
  system?: SystemEntity
}

export const ApiKeySchema = new EntitySchema<ApiKeyEntity>({
  name: 'ApiKey',
  tableName: 'api_keys',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    systemId: { name: 'system_id', type: 'int' },
    key: { type: 'varchar', length: 64, unique: true },
    keyPrefix: { name: 'key_prefix', type: 'varchar', length: 16, nullable: true },
    name: { type: 'varchar', length: 128 },
    enabled: { type: 'boolean', default: true },
    lastUsedAt: { name: 'last_used_at', type: 'datetime', nullable: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
  relations: {
    system: {
      type: 'many-to-one',
      target: 'System',
      joinColumn: { name: 'system_id' },
      onDelete: 'CASCADE',
    },
  },
})
