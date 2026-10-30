import { EntitySchema } from 'typeorm'
import type { ApiPermission } from '../../../shared/types'

export interface ApiKeyEntity {
  id: number
  // 仅用于兼容历史数据；ApiKey 本身是全局实体，不归属于某个系统。
  legacySystemId: number | null
  // 实际授权范围；allSystems=true 时忽略 systemIds。
  systemIds: number[]
  allSystems: boolean
  permissions: ApiPermission[]
  // 仅存明文 key 的 SHA-256 摘要；校验时对提交方 key 摘要后比对
  key: string
  // 明文 key 前 8 位，列表展示用（明文不再可查）
  keyPrefix: string | null
  name: string
  enabled: boolean
  lastUsedAt: Date | null
  createdAt: Date
}

export const ApiKeySchema = new EntitySchema<ApiKeyEntity>({
  name: 'ApiKey',
  tableName: 'api_keys',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    legacySystemId: { name: 'system_id', type: 'int', nullable: true, select: false },
    systemIds: { name: 'system_ids', type: 'simple-json' },
    allSystems: { name: 'all_systems', type: 'boolean', default: false },
    permissions: { type: 'simple-json' },
    key: { type: 'varchar', length: 64, unique: true },
    keyPrefix: { name: 'key_prefix', type: 'varchar', length: 16, nullable: true },
    name: { type: 'varchar', length: 128 },
    enabled: { type: 'boolean', default: true },
    lastUsedAt: { name: 'last_used_at', type: 'datetime', nullable: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
})
