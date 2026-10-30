import { initDataSource } from '../../database/data-source'
import { SystemSchema } from '../../database/entities'
import { requirePermission, requireSystemAccess } from '../../utils/auth'
import { firstZodMessage, systemInputSchema } from '../../utils/validation'
import { recordAudit } from '../../utils/audit'

// 更新系统（code 是提交方使用的标识，不允许修改）
export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'systems:manage')
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const body = await readBody(event)
  const parsed = systemInputSchema.omit({ code: true }).partial().safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }

  const ds = await initDataSource()
  const repo = ds.getRepository(SystemSchema)
  const system = await repo.findOne({ where: { id } })
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }
  requireSystemAccess(admin, system.id)

  if (parsed.data.name !== undefined) system.name = parsed.data.name
  if (parsed.data.description !== undefined) system.description = parsed.data.description ?? null
  if (parsed.data.retentionDays !== undefined) system.retentionDays = parsed.data.retentionDays ?? null
  await repo.save(system)

  recordAudit(admin, 'system.update', system.code, { name: system.name, retentionDays: system.retentionDays })
  return { system }
})
