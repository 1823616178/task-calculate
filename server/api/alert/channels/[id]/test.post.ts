import { initDataSource } from '../../../../database/data-source'
import { AlertChannelSchema } from '../../../../database/entities'
import { requireAdmin } from '../../../../utils/auth'
import { sendToChannel } from '../../../../services/alertingService'
import type { AlertEventInfo } from '../../../../services/alertingService'
import { recordAudit } from '../../../../utils/audit'

// 发送测试通知：验证渠道配置是否可用
export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const ds = await initDataSource()
  const channel = await ds.getRepository(AlertChannelSchema).findOne({ where: { id } })
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'channel not found' })
  }

  const now = new Date()
  const info: AlertEventInfo = {
    systemCode: 'test',
    systemName: '测试系统',
    metricCode: 'test',
    metricName: '测试指标',
    unit: null,
    value: 0,
    status: 'alarm',
    prevStatus: 'normal',
    warnMin: 10,
    warnMax: 70,
    alarmMin: 0,
    alarmMax: 90,
    reportedAt: now,
  }

  try {
    await sendToChannel(channel, info)
    recordAudit(admin, 'channel.test', channel.name)
    return { ok: true }
  }
  catch (err) {
    console.error('[alert] test send failed:', err)
    throw createError({ statusCode: 502, statusMessage: `发送失败: ${err instanceof Error ? err.message : 'unknown'}` })
  }
})
