import { queryRecords } from '../services/recordsQuery'
import { requireReadAccess, scopeReadQuery } from '../utils/readAccess'
import { firstZodMessage, recordsQuerySchema } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const principal = await requireReadAccess(event)
  const parsed = recordsQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: firstZodMessage(parsed.error) })
  }
  return queryRecords(await scopeReadQuery(principal, parsed.data))
})
