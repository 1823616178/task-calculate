import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { requirePermission } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'users:manage')
  const ds = await initDataSource()
  const users = await ds.getRepository(UserSchema).find({ order: { id: 'ASC' } })
  return {
    users: users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      enabled: u.enabled,
      createdAt: u.createdAt,
    })),
    currentUserId: user.kind === 'user' ? user.userId : null,
  }
})
