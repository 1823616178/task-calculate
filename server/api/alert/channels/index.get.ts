import { initDataSource } from '../../../database/data-source'
import { AlertChannelSchema } from '../../../database/entities'
import { requireAdmin } from '../../../utils/auth'

// 通知渠道列表（管理端配置页）
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const ds = await initDataSource()
  const list = await ds.getRepository(AlertChannelSchema).find({ order: { id: 'ASC' } })
  return { channels: list }
})
