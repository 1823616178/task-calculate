import { initDataSource } from '../database/data-source'
import { isMqttConnected } from '../services/mqttService'
import { dashboardPeerCount } from '../services/broadcastService'

export default defineEventHandler(async (event) => {
  let db = false
  try {
    const ds = await initDataSource()
    await ds.query('SELECT 1')
    db = true
  }
  catch (err) {
    console.error('[health] db check failed:', err)
  }

  const mqtt = isMqttConnected()
  const ok = db && mqtt
  // 不健康时返回 503（保留 JSON body 便于排查），避免 Docker/编排探针把已断连容器判为 healthy
  setResponseStatus(event, ok ? 200 : 503)
  return {
    ok,
    db,
    mqtt,
    dashboardPeers: dashboardPeerCount(),
    time: new Date().toISOString(),
  }
})
