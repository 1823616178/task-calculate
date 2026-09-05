import bcrypt from 'bcryptjs'
import { Not } from 'typeorm'
import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { requireAdmin } from '../../utils/auth'
import { firstZodMessage, userUpdateSchema } from '../../utils/validation'
import { recordAudit } from '../../utils/audit'

async function countOtherAdmins(ds: Awaited<ReturnType<typeof initDataSource>>, userId: number): Promise<number> {
  return ds.getRepository(UserSchema).count({ where: { role: 'admin', enabled: true, id: Not(userId) } })
}

export default defineEventHandler(async (event) => {
  const current = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const parsed = userUpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const data = parsed.data

  const ds = await initDataSource()
  const repo = ds.getRepository(UserSchema)
  const user = await repo.findOne({ where: { id } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'user not found' })
  }

  const losingAdmin = user.role === 'admin' && user.enabled
    && ((data.role === 'viewer') || data.enabled === false)
  if (losingAdmin && (await countOtherAdmins(ds, id)) === 0) {
    throw createError({ statusCode: 400, statusMessage: '不能禁用或降级最后一个可用的管理员' })
  }
  if (id === current.userId && data.enabled === false) {
    throw createError({ statusCode: 400, statusMessage: '不能禁用当前登录用户' })
  }

  if (data.password !== undefined) user.passwordHash = await bcrypt.hash(data.password, 10)
  if (data.role !== undefined) user.role = data.role
  if (data.enabled !== undefined) user.enabled = data.enabled
  await repo.save(user)
  recordAudit(current, 'user.update', user.username, { role: user.role, enabled: user.enabled, passwordReset: data.password !== undefined })
  return { user: { id: user.id, username: user.username, role: user.role, enabled: user.enabled } }
})
