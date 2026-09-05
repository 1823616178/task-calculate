import { EntitySchema } from 'typeorm'
import type { SystemEntity } from './System'

export interface ApiKeyEntity {
  id: number
  systemId: number
  key: string
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
