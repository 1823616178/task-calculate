import bcrypt from 'bcryptjs'
import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { requirePermission } from '../../utils/auth'
import { firstZodMessage, userCreateSchema } from '../../utils/validation'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users:manage')
  const parsed = userCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(UserSchema)
  const exists = await repo.findOne({ where: { username: parsed.data.username } })
  if (exists) {
    throw createError({ statusCode: 409, statusMessage: `用户名已存在: ${parsed.data.username}` })
  }

  const saved = await repo.save(
    repo.create({
      username: parsed.data.username,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: parsed.data.role,
      enabled: true,
    }),
  )
  recordAudit(admin, 'user.create', parsed.data.username, { role: parsed.data.role })
  return { user: { id: saved.id, username: saved.username, role: saved.role, enabled: saved.enabled, createdAt: saved.createdAt } }
})
