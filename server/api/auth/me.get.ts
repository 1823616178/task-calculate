import { principalView, requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const principal = await requireAuth(event)
  if (principal.kind === 'apiKey' && !principal.apiKey.permissions.includes('data:read')) {
    throw createError({ statusCode: 403, statusMessage: 'console login requires data:read' })
  }
  return { user: principalView(principal) }
})
