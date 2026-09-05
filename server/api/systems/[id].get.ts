import { initDataSource } from '../../database/data-source'
import { MetricSchema, SystemSchema } from '../../database/entities'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { id } })
  if (!system) {
    throw createError({ statusCode: 404, statusMessage: 'system not found' })
  }
  const metrics = await ds.getRepository(MetricSchema).find({ where: { systemId: id }, order: { id: 'ASC' } })

  return { system, metrics }
})
