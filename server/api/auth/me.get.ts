import { requireAuth } from '../../utils/auth'

export default defineEventHandler((event) => {
  const user = requireAuth(event)
  return { user: { id: user.userId, username: user.username, role: user.role } }
})
