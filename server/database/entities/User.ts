import { EntitySchema } from 'typeorm'
import type { UserRole } from '../../../shared/types'

export interface UserEntity {
  id: number
  username: string
  passwordHash: string
  role: UserRole
  enabled: boolean
  createdAt: Date
}

export const UserSchema = new EntitySchema<UserEntity>({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'int', primary: true, generated: 'increment' },
    username: { type: 'varchar', length: 64, unique: true },
    passwordHash: { name: 'password_hash', type: 'varchar', length: 128 },
    role: { type: 'varchar', length: 16, default: 'viewer' },
    enabled: { type: 'boolean', default: true },
    createdAt: { name: 'created_at', type: 'datetime', createDate: true },
  },
})
