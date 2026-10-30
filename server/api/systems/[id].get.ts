import { initDataSource } from '../../database/data-source'
import { MetricSchema, SystemSchema } from '../../database/entities'
import { assertSystemReadable, requireReadAccess } from '../../utils/readAccess'

export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const system = await ds.getRepository(SystemSchema).findOne({ where: { id } })
  assertSystemReadable(principal, system)
  const metrics = await ds.getRepository(MetricSchema).find({ where: { systemId: id }, order: { id: 'ASC' } })

  return { system, metrics }
})
