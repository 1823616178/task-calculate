import { startMqttSubscriber, stopMqttSubscriber } from '../services/mqttService'

// 02 开头保证在 01.typeorm（数据库就绪）之后启动
export default defineNitroPlugin((nitroApp) => {
  startMqttSubscriber()

  // 优雅停机：断开 MQTT 连接
  nitroApp.hooks.hook('close', () => {
    stopMqttSubscriber()
    console.log('[mqtt] subscriber stopped')
  })
})
