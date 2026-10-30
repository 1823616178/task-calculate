import { initDataSource } from '../../database/data-source'
import { AuditLogSchema } from '../../database/entities'
import { requirePermission } from '../../utils/auth'
import { z } from 'zod'
import { firstZodMessage } from '../../utils/validation'

const auditQuerySchema = z.object({
  username: z.string().trim().max(64).optional(),
  action: z.string().trim().max(64).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

// 审计日志查询（管理端）
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'audit:read')
  const parsed = auditQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  const { username, action, from, to, page, pageSize } = parsed.data

  const ds = await initDataSource()
  const qb = ds.getRepository(AuditLogSchema).createQueryBuilder('a')

  if (username) qb.andWhere('a.username = :username', { username })
  if (action) qb.andWhere('a.action LIKE :action', { action: `${action}%` })
  if (from !== undefined) qb.andWhere('a.createdAt >= :from', { from: new Date(from) })
  if (to !== undefined) qb.andWhere('a.createdAt <= :to', { to: new Date(to) })

  qb.orderBy('a.id', 'DESC')
    .skip((page - 1) * pageSize)
    .take(pageSize)

  const [list, total] = await qb.getManyAndCount()
  return { list, total, page, pageSize }
})
