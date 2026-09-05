import { initDataSource } from '../database/data-source'
import { isMqttConnected } from '../services/mqttService'
import { dashboardPeerCount } from '../services/broadcastService'

export default defineEventHandler(async () => {
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
  return {
    ok: db && mqtt,
    db,
    mqtt,
    dashboardPeers: dashboardPeerCount(),
    time: new Date().toISOString(),
  }
})
