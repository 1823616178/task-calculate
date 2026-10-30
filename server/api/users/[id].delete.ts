import { Not } from 'typeorm'
import { initDataSource } from '../../database/data-source'
import { UserSchema } from '../../database/entities'
import { requirePermission } from '../../utils/auth'
import { recordAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }
  if (admin.kind === 'user' && id === admin.userId) {
    throw createError({ statusCode: 400, statusMessage: '不能删除当前登录用户' })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(UserSchema)
  const user = await repo.findOne({ where: { id } })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'user not found' })
  }

  if (user.role === 'admin' && user.enabled) {
    const otherAdmins = await repo.count({ where: { role: 'admin', enabled: true, id: Not(id) } })
    if (otherAdmins === 0) {
      throw createError({ statusCode: 400, statusMessage: '不能删除最后一个可用的管理员' })
    }
  }

  await repo.remove(user)
  recordAudit(admin, 'user.delete', user.username)
  return { ok: true }
})
